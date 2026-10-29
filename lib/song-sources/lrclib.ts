import type { LyricsResult } from "./index";

type Fetcher = typeof fetch;

export async function fetchLyrics(
  title: string,
  artist: string,
  fetcher: Fetcher = fetch,
): Promise<LyricsResult> {
  const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
  try {
    const res = await fetcher(url);
    if (!res.ok) return null;
    const rows = (await res.json()) as { plainLyrics?: string | null }[];
    const hit = rows.find((row) => row.plainLyrics?.trim());
    return hit ? { plain: hit.plainLyrics!.trim() } : null;
  } catch {
    return null;
  }
}
