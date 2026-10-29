import { fetchLyrics } from "@/lib/song-sources/lrclib";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim();
  const artist = params.get("artist")?.trim();
  if (!title || !artist) {
    return Response.json({ error: "title and artist are required" }, { status: 400 });
  }
  return Response.json({ lyrics: await fetchLyrics(title, artist) });
}
