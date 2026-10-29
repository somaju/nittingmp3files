import type { SongCandidate } from "@/lib/song-sources";

export type SongGuess = { title: string; artist?: string; artistPart?: boolean };
// text는 기본 검색어, extra는 가수가 둘 이상일 때 가수별로 만든 추가 검색어다.
export type SearchQuery = { text: string; extra: string[]; guesses: SongGuess[] };
export type ExistingTags = { title?: string; artist?: string };

export type MatchResult =
  | { kind: "single"; candidate: SongCandidate }
  | { kind: "ambiguous"; candidates: SongCandidate[] }
  | { kind: "none" };

const NOISE_WORDS = [
  "official",
  "music video",
  "lyric video",
  "lyrics",
  "audio",
  "video",
  "mv",
  "hd",
  "4k",
  "mr",
  "full",
  "가사포함",
  "가사",
  "고음질",
  "풀버전",
  "공식",
];

function stripExtension(name: string) {
  return name.replace(/\.mp3$/i, "");
}

function cleanSegment(raw: string) {
  let text = raw
    .replace(/(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/[([{【［（][^)\]}】］）]*[)\]}】］）]/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\d{2,4}\s?kbps\b/gi, " ")
    .replace(/\b(?:1080|720|480)p\b/gi, " ");
  for (const word of NOISE_WORDS) {
    const pattern = /^[a-z0-9 ]+$/.test(word)
      ? new RegExp(`(?<![a-z0-9])${word}(?![a-z0-9])`, "gi")
      : new RegExp(word, "g");
    text = text.replace(pattern, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

const ARTIST_SEPARATOR = /\s*(?:,|;|&|\/|\bfeat\.?|\bft\.?|\bwith\b|\band\b|\bx\b)\s*/i;

export function splitArtists(artist: string): string[] {
  const parts = artist
    .split(ARTIST_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [];
}

// 가수가 둘 이상이면 전체 이름 추측에 더해 가수 한 명씩의 추측과 검색어도 만든다.
function withArtistParts(base: SongGuess[], text: string): Pick<SearchQuery, "extra" | "guesses"> {
  const guesses = [...base]
  const extra: string[] = []
  for (const g of base) {
    if (!g.artist) continue
    for (const part of splitArtists(g.artist)) {
      guesses.push({ title: g.title, artist: part, artistPart: true })
      const q = `${part} ${g.title}`
      if (q !== text && !extra.includes(q)) extra.push(q)
    }
  }
  return { guesses, extra }
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 제목 앞이나 뒤에 가수 이름이 붙어 있으면 지워서 가수 이름이 한 번만 나오게 한다.
export function stripArtistName(title: string, artist?: string): string {
  if (!artist) return title;
  let result = title.trim();
  for (const name of [artist, ...splitArtists(artist)]) {
    const escaped = escapeRegExp(name.trim());
    if (!escaped) continue;
    const next = result
      .replace(new RegExp(`^${escaped}(?=[\\s\\-–—:]+\\S)[\\s\\-–—:]+`, "i"), "")
      .replace(new RegExp(`(?<=\\S)[\\s\\-–—:]+${escaped}$`, "i"), "")
      .trim();
    if (next.length >= 2) result = next;
  }
  return result;
}

// "제목 - 가수"처럼 가수 이름이 섞여 들어간 태그 제목에서 가수 부분을 지운다.
export function cleanTagTitle(title: string, artist?: string): string {
  const cleaned = cleanSegment(title);
  if (!artist) return cleaned;
  const parts = cleaned
    .split(/\s+[-–—]\s*|\s*[-–—]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return stripArtistName(cleaned, artist);
  const names = [artist, ...splitArtists(artist)].map(normalizeText);
  const rest = parts.filter((p) => !names.includes(normalizeText(p)));
  const title2 = rest.length >= 1 && rest.length < parts.length ? rest.join(" - ") : cleaned;
  return stripArtistName(title2, artist);
}

function queryFromName(base: string): SearchQuery {
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const first = cleanSegment(parts[0]);
    const second = cleanSegment(parts.slice(1).join(" - "));
    if (first && second) {
      // 제목에 가수 이름이 또 들어 있으면 한 번만 남긴다.
      const titleFirst = stripArtistName(first, second);
      const titleSecond = stripArtistName(second, first);
      const text = `${titleFirst} ${second}`;
      return {
        text,
        ...withArtistParts(
          // "제목 - 가수" 순서를 먼저 추측한다. 두 순서 모두 후보와 맞춰 본다.
          [
            { title: titleFirst, artist: second },
            { title: titleSecond, artist: first },
          ],
          text,
        ),
      };
    }
  }
  const only = cleanSegment(base);
  return { text: only, extra: [], guesses: only ? [{ title: only }] : [] };
}

export function buildSearchQuery(input: {
  fileName: string;
  tags?: ExistingTags;
}): SearchQuery {
  const tagTitle = input.tags?.title?.trim();
  const tagArtist = input.tags?.artist?.trim();
  if (tagTitle && tagArtist) {
    const title = cleanTagTitle(tagTitle, tagArtist);
    const text = `${tagArtist} ${title}`;
    return { text, ...withArtistParts([{ title, artist: tagArtist }], text) };
  }
  // 가수 태그가 없으면 태그 제목도 파일명처럼 "제목 - 가수"로 읽는다.
  if (tagTitle) return queryFromName(tagTitle.replace(/_/g, " "));
  return queryFromName(stripExtension(input.fileName).replace(/_/g, " "));
}

export function isGarbledName(fileName: string): boolean {
  const base = stripExtension(fileName).replace(/[\s_\-.()[\]]/g, "");
  if (!base) return false;
  const chars = [...base];
  const suspect = chars.filter((ch) => {
    const code = ch.codePointAt(0)!;
    return (
      code === 0xfffd ||
      (code >= 0x80 && code <= 0xff) ||
      (code >= 0x100 && code <= 0x2ff) ||
      (code >= 0x2010 && code <= 0x2122)
    );
  });
  return suspect.length >= 3 && suspect.length / chars.length > 0.4;
}

export function normalizeText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function groupKey(c: SongCandidate) {
  return `${normalizeText(c.title)}|${normalizeText(c.artist)}`;
}

function isExact(c: SongCandidate, guesses: SongGuess[]) {
  const title = normalizeText(c.title);
  const artist = normalizeText(c.artist);
  return guesses.some((g) => {
    const want = normalizeText(g.title);
    if (g.artistPart) {
      const part = normalizeText(g.artist ?? "");
      return title === want && part.length >= 2 && artist.includes(part);
    }
    if (g.artist) return title === want && artist === normalizeText(g.artist);
    // 구분자 없이 "가수 제목" 또는 "제목 가수"로 적힌 이름도 같은 곡으로 본다.
    return want === title || want === artist + title || want === title + artist;
  });
}

const HANGUL = /[\u3131-\u318e\uac00-\ud7a3]/;

const KOREAN_GENRE = /k-?pop|k-?indie|k-?rock|k-?hip|k-?r&b|korean|trot|국악|가요/i;

// 서비스의 장르를 근거로 외국 가수인지 판단한다. 장르가 없으면 알 수 없으므로 외국으로 보지 않는다.
export function isForeign(candidate: SongCandidate): boolean {
  return Boolean(candidate.genre) && !KOREAN_GENRE.test(candidate.genre!) && !hasHangul(candidate.title);
}

export const hasHangul = (text: string) => HANGUL.test(text);

// 사용자가 한글로 적은 제목과 가수는 서비스가 영어로 돌려줘도 그대로 둔다.
// 앨범, 장르, 출시년도, 앨범아트는 서비스 값을 쓴다.
export function preferOriginalNames(
  guesses: SongGuess[],
  candidate: SongCandidate,
): SongCandidate {
  const named = guesses.filter((g) => g.artist && !g.artistPart);
  if (named.length === 0) return candidate;
  const score = (g: SongGuess) =>
    Number(normalizeText(g.title) === normalizeText(candidate.title)) +
    Number(normalizeText(g.artist!) === normalizeText(candidate.artist));
  const best = named.reduce((a, b) => (score(b) > score(a) ? b : a));
  const title = hasHangul(best.title) && !hasHangul(candidate.title) ? best.title : candidate.title;
  // 외국 가수는 영문 이름으로 바꾼다. 장르가 있고 한국 장르가 아닐 때만 외국 가수로 본다.
  const keepArtist =
    hasHangul(best.artist!) && !hasHangul(candidate.artist) && !isForeign(candidate);
  const artist = keepArtist ? best.artist! : candidate.artist;
  if (title === candidate.title && artist === candidate.artist) return candidate;
  return {
    ...candidate,
    title,
    artist,
    sourceTitle: candidate.title,
    sourceArtist: candidate.artist,
  };
}

function isSameTitleOtherScript(c: SongCandidate, guesses: SongGuess[]) {
  return guesses.some(
    (g) =>
      Boolean(g.artist) &&
      normalizeText(c.title) === normalizeText(g.title) &&
      HANGUL.test(g.artist!) !== HANGUL.test(c.artist),
  );
}

function mergeGroup(members: SongCandidate[]): SongCandidate {
  const sorted = [...members].sort(
    (a, b) => (a.year ?? Infinity) - (b.year ?? Infinity),
  );
  const merged: SongCandidate = { ...sorted[0] };
  for (const other of sorted.slice(1)) {
    merged.album ??= other.album;
    merged.genre ??= other.genre;
    merged.year ??= other.year;
    merged.artworkUrl ??= other.artworkUrl;
  }
  return merged;
}

function groupBy(candidates: SongCandidate[]) {
  const groups = new Map<string, SongCandidate[]>();
  for (const c of candidates) {
    const key = groupKey(c);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.values()];
}

export function classifyMatch(
  guesses: SongGuess[],
  candidates: SongCandidate[],
): MatchResult {
  if (candidates.length === 0) return { kind: "none" };
  const exact = groupBy(candidates.filter((c) => isExact(c, guesses)));
  if (exact.length === 1) return { kind: "single", candidate: mergeGroup(exact[0]) };
  if (exact.length === 0) {
    // 제목은 같은데 가수만 한글/영문 표기가 다른 경우: 이런 곡이 하나뿐이면 같은 곡으로 본다.
    const bySong = groupBy(candidates.filter((c) => isSameTitleOtherScript(c, guesses)));
    if (bySong.length === 1) return { kind: "single", candidate: mergeGroup(bySong[0]) };
  }
  const pool = exact.length > 1 ? exact : groupBy(candidates);
  return { kind: "ambiguous", candidates: pool.slice(0, 5).map(mergeGroup) };
}
