import type { Mp3Entry, OutputFolder } from "@/lib/folder-access";
import { readTags, writeTags, type Picture, type TagValues } from "@/lib/mp3-tags";
import {
  buildSearchQuery,
  classifyMatch,
  cleanTagTitle,
  isGarbledName,
  normalizeText,
  preferOriginalNames,
  type SearchQuery,
} from "@/lib/song-identity";
import type { SongCandidate } from "@/lib/song-sources";

import { songFileName, songTitle } from "./file-names";

export type SongDeps = {
  search(text: string, source: "itunes" | "musicbrainz"): Promise<SongCandidate[]>;
  lyrics(title: string, artist: string): Promise<string | null>;
  artwork(url: string): Promise<Picture | null>;
};

export type FieldKey = "title" | "artist" | "album" | "genre" | "year";
export type ConflictField = { field: FieldKey; existing: string; found: string };
export type ConflictChoices = Partial<Record<FieldKey, "existing" | "found">>;

export type SongHint = { title?: string; artist?: string };

export type FailureReason = "garbled" | "not-found" | "no-artist" | "error";

export type SongOutcome =
  | { status: "ok"; fileName: string; tags: TagValues; hasArtwork: boolean; picture?: Picture }
  // 출력 폴더에 같은 이름의 파일이 이미 있어서 만들지 않고 건너뛴 곡.
  | { status: "skipped"; fileName: string }
  | { status: "review"; kind: "candidates"; candidates: SongCandidate[] }
  | { status: "review"; kind: "conflict"; candidate: SongCandidate; conflicts: ConflictField[] }
  | { status: "failed"; reason: FailureReason; title?: string };

export type SongRecord = { entry: Mp3Entry; outcome: SongOutcome };

const FIELDS: FieldKey[] = ["title", "artist", "album", "genre", "year"];

function valueOf(source: TagValues | SongCandidate, field: FieldKey): string | undefined {
  const v = source[field];
  return v === undefined || v === "" ? undefined : String(v);
}

// 태그 제목에 가수 이름이 섞여 있어도(예: "제목 - 가수") 정리하면 찾은 제목과 같으면 같은 제목으로 본다.
function isPollutedTitle(existing: TagValues, found: SongCandidate): boolean {
  if (!existing.title) return false;
  return (
    normalizeText(existing.title) !== normalizeText(found.title) &&
    normalizeText(cleanTagTitle(existing.title, found.artist)) === normalizeText(found.title)
  );
}

function findConflicts(existing: TagValues, found: SongCandidate): ConflictField[] {
  return FIELDS.flatMap((field) => {
    if (field === "title" && isPollutedTitle(existing, found)) return [];
    const a = valueOf(existing, field);
    const b = valueOf(found, field);
    if (!a || !b) return [];
    const same = field === "year" ? a === b : normalizeText(a) === normalizeText(b);
    return same ? [] : [{ field, existing: a, found: b }];
  });
}

function mergeTags(
  existing: TagValues,
  found: SongCandidate,
  choices: ConflictChoices,
): TagValues {
  const merged: TagValues = { ...existing };
  for (const field of FIELDS) {
    const a = valueOf(existing, field);
    const b = valueOf(found, field);
    const useFound =
      !a ||
      (b !== undefined && choices[field] === "found") ||
      (field === "title" && isPollutedTitle(existing, found));
    if (useFound && b !== undefined) {
      if (field === "year") merged.year = Number(b);
      else merged[field] = b;
    }
  }
  return merged;
}

const UNKNOWN_ARTISTS = new Set(["variousartists", "va", "unknown", "unknownartist"]);

async function finish(
  entry: Mp3Entry,
  output: OutputFolder,
  deps: SongDeps,
  candidate: SongCandidate,
  choices: ConflictChoices | undefined,
  replaceFileName?: string,
): Promise<SongOutcome> {
  const file = await entry.getFile();
  const { tags: existing, picture: existingPicture } = await readTags(file);
  const conflicts = findConflicts(existing, candidate);
  if (conflicts.length > 0 && !choices) {
    return { status: "review", kind: "conflict", candidate, conflicts };
  }

  const tags = mergeTags(existing, candidate, choices ?? {});
  if (!tags.title || !tags.artist) return { status: "failed", reason: "no-artist", title: tags.title };
  const fileName = songFileName(tags.title, tags.artist);
  if ((await output.has(fileName)) && fileName !== replaceFileName) {
    return { status: "skipped", fileName };
  }
  const remove = replaceFileName !== fileName ? output.remove : undefined;
  if (replaceFileName && replaceFileName !== fileName && !remove) {
    throw new Error("이 폴더에서는 기존 결과 파일을 교체할 수 없습니다.");
  }
  if (!tags.lyrics) {
    const lyrics =
      (await deps.lyrics(tags.title, tags.artist)) ??
      (candidate.sourceTitle && candidate.sourceArtist
        ? await deps.lyrics(candidate.sourceTitle, candidate.sourceArtist)
        : null);
    if (lyrics) tags.lyrics = lyrics;
  }
  const picture =
    existingPicture ?? (candidate.artworkUrl ? await deps.artwork(candidate.artworkUrl) : null);

  // 제목 태그는 "노래이름 - 가수이름"이고 파일명과 같다.
  tags.title = songTitle(tags.title, tags.artist);
  const data = await writeTags(file, tags, picture ?? undefined);
  await output.write(fileName, data);
  if (remove && replaceFileName) await remove(replaceFileName);
  return {
    status: "ok",
    fileName,
    tags,
    hasArtwork: Boolean(picture),
    ...(picture ? { picture } : {}),
  };
}

function queryFromHint(entry: Mp3Entry, tags: TagValues, hint: SongHint): SearchQuery {
  const base = buildSearchQuery({ fileName: entry.name, tags });
  const title = hint.title ?? base.guesses[0]?.title;
  if (!title) return { text: "", extra: [], guesses: [] };
  return {
    text: [hint.artist, title].filter(Boolean).join(" "),
    extra: [],
    guesses: [{ title, ...(hint.artist ? { artist: hint.artist } : {}) }],
  };
}

export async function processSong(
  entry: Mp3Entry,
  output: OutputFolder,
  deps: SongDeps,
  hint?: SongHint,
): Promise<SongOutcome> {
  const file = await entry.getFile();
  const { tags } = await readTags(file);

  if (!hint && !tags.title && isGarbledName(entry.name)) {
    return { status: "failed", reason: "garbled" };
  }

  const query = hint ? queryFromHint(entry, tags, hint) : buildSearchQuery({ fileName: entry.name, tags });
  if (!query.text) return { status: "failed", reason: "not-found" };

  // 가수가 둘 이상이면 전체 이름과 가수 한 명씩 모두 검색해 후보를 합친다.
  let candidates: SongCandidate[] = [];
  for (const text of [query.text, ...query.extra]) {
    candidates = [...candidates, ...(await deps.search(text, "itunes"))];
  }
  let match = classifyMatch(query.guesses, candidates);
  if (match.kind !== "single") {
    candidates = [...candidates, ...(await deps.search(query.text, "musicbrainz"))];
    match = classifyMatch(query.guesses, candidates);
  }

  if (match.kind === "none") return { status: "failed", reason: "not-found" };
  if (match.kind === "ambiguous") {
    return {
      status: "review",
      kind: "candidates",
      candidates: match.candidates.map((c) => preferOriginalNames(query.guesses, c)),
    };
  }

  const knownArtist = query.guesses.some((g) => g.artist) || Boolean(tags.artist);
  if (!knownArtist && UNKNOWN_ARTISTS.has(normalizeText(match.candidate.artist))) {
    return { status: "failed", reason: "no-artist", title: match.candidate.title };
  }
  return finish(entry, output, deps, preferOriginalNames(query.guesses, match.candidate), undefined);
}

// 사용자가 후보 중 하나를 골랐을 때: 기존 태그와 다른 값은 여전히 사용자 선택이 필요하다.
export function chooseCandidate(
  entry: Mp3Entry,
  output: OutputFolder,
  deps: SongDeps,
  candidate: SongCandidate,
  replaceFileName?: string,
): Promise<SongOutcome> {
  return finish(entry, output, deps, candidate, undefined, replaceFileName);
}

export function resolveConflicts(
  entry: Mp3Entry,
  output: OutputFolder,
  deps: SongDeps,
  candidate: SongCandidate,
  choices: ConflictChoices,
  replaceFileName?: string,
): Promise<SongOutcome> {
  return finish(entry, output, deps, candidate, choices, replaceFileName);
}

export async function runOrganizer(options: {
  entries: Mp3Entry[];
  output: OutputFolder;
  deps: SongDeps;
  onStart?: (name: string, index: number, total: number) => void;
  onDone?: (record: SongRecord, index: number, total: number) => void;
}): Promise<SongRecord[]> {
  const { entries, output, deps } = options;
  const records: SongRecord[] = [];
  for (const [index, entry] of entries.entries()) {
    options.onStart?.(entry.name, index, entries.length);
    let outcome: SongOutcome;
    try {
      outcome = await processSong(entry, output, deps);
    } catch {
      outcome = { status: "failed", reason: "error" };
    }
    const record = { entry, outcome };
    records.push(record);
    options.onDone?.(record, index, entries.length);
  }
  return records;
}

export type ManualValues = {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: number;
  lyrics?: string;
};

// 사용자가 직접 고친 값을 그대로 쓴다. 제목과 가수는 꼭 있어야 한다.
// 앨범아트와 가사는 파일에 이미 있으면 그것을 쓰고, 없으면 찾아 본다.
export async function saveManual(
  entry: Mp3Entry,
  output: OutputFolder,
  deps: SongDeps,
  values: ManualValues,
  artworkUrl?: string,
  replaceFileName?: string,
): Promise<SongOutcome> {
  const title = values.title.trim();
  const artist = values.artist.trim();
  if (!title || !artist) return { status: "failed", reason: "no-artist", title: title || undefined };

  const fileName = songFileName(title, artist);
  if ((await output.has(fileName)) && fileName !== replaceFileName) {
    return { status: "skipped", fileName };
  }
  const remove = replaceFileName !== fileName ? output.remove : undefined;
  if (replaceFileName && replaceFileName !== fileName && !remove) {
    throw new Error("이 폴더에서는 기존 결과 파일을 교체할 수 없습니다.");
  }

  const file = await entry.getFile();
  const { tags: existing, picture: existingPicture } = await readTags(file);
  const tags: TagValues = { title: songTitle(title, artist), artist };
  if (values.album?.trim()) tags.album = values.album.trim();
  if (values.genre?.trim()) tags.genre = values.genre.trim();
  if (values.year && Number.isFinite(values.year)) tags.year = values.year;
  const lyrics = values.lyrics?.trim() || existing.lyrics || (await deps.lyrics(title, artist));
  if (lyrics) tags.lyrics = lyrics;
  const picture = existingPicture ?? (artworkUrl ? await deps.artwork(artworkUrl) : null);

  const data = await writeTags(file, tags, picture ?? undefined);
  await output.write(fileName, data);
  if (remove && replaceFileName) await remove(replaceFileName);
  return {
    status: "ok",
    fileName,
    tags,
    hasArtwork: Boolean(picture),
    ...(picture ? { picture } : {}),
  };
}
