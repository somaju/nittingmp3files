import type { SongCandidate } from "./index";

type Fetcher = typeof fetch;

type ItunesTrack = {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
};

export async function searchItunes(
  text: string,
  fetcher: Fetcher = fetch,
): Promise<SongCandidate[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(text)}&entity=song&limit=10`;
  try {
    const res = await fetcher(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: ItunesTrack[] };
    return (data.results ?? [])
      .filter((t) => t.trackName && t.artistName)
      .map((t) => ({
        title: t.trackName!,
        artist: t.artistName!,
        ...(t.collectionName ? { album: t.collectionName } : {}),
        ...(t.primaryGenreName ? { genre: t.primaryGenreName } : {}),
        ...(t.releaseDate ? { year: Number(t.releaseDate.slice(0, 4)) } : {}),
        ...(t.artworkUrl100
          ? { artworkUrl: t.artworkUrl100.replace("100x100bb", "600x600bb") }
          : {}),
        source: "itunes" as const,
      }));
  } catch {
    return [];
  }
}
