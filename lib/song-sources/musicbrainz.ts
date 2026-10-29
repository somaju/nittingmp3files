import type { SongCandidate } from "./index";

type Fetcher = typeof fetch;

type MbRecording = {
  title?: string;
  "artist-credit"?: { name?: string; joinphrase?: string }[];
  "first-release-date"?: string;
  releases?: { id: string; title?: string; date?: string }[];
};

// MusicBrainz는 초당 1건 요청 제한과 식별 가능한 User-Agent를 요구한다.
const USER_AGENT = "mp3-organizer/0.1 (personal mp3 tag organizer)";
let lastCall = 0;

async function throttle(ms: number) {
  const wait = lastCall + ms - Date.now();
  lastCall = Math.max(Date.now(), lastCall + ms);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function searchMusicBrainz(
  text: string,
  fetcher: Fetcher = fetch,
  options: { throttleMs?: number } = {},
): Promise<SongCandidate[]> {
  await throttle(options.throttleMs ?? 1100);
  const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(text)}&fmt=json&limit=10`;
  try {
    const res = await fetcher(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    const data = (await res.json()) as { recordings?: MbRecording[] };
    return (data.recordings ?? []).flatMap((r) => {
      const artist = (r["artist-credit"] ?? [])
        .map((a) => `${a.name ?? ""}${a.joinphrase ?? ""}`)
        .join("")
        .trim();
      if (!r.title || !artist) return [];
      const release = r.releases?.[0];
      const date = r["first-release-date"] || release?.date;
      const year = date ? Number(date.slice(0, 4)) : undefined;
      return [
        {
          title: r.title,
          artist,
          ...(release?.title ? { album: release.title } : {}),
          ...(year && !Number.isNaN(year) ? { year } : {}),
          ...(release
            ? { artworkUrl: `https://coverartarchive.org/release/${release.id}/front-500` }
            : {}),
          source: "musicbrainz" as const,
        },
      ];
    });
  } catch {
    return [];
  }
}
