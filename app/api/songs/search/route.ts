import { searchItunes } from "@/lib/song-sources/itunes";
import { searchMusicBrainz } from "@/lib/song-sources/musicbrainz";

// 브라우저 대신 곡 정보 서비스에 검색 요청을 보내는 중계 경로다.
// 음원 파일은 받지 않고 검색어만 받는다.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const source = params.get("source") ?? "itunes";
  if (!q) return Response.json({ error: "q is required" }, { status: 400 });
  if (source !== "itunes" && source !== "musicbrainz") {
    return Response.json({ error: "unknown source" }, { status: 400 });
  }
  const candidates =
    source === "itunes" ? await searchItunes(q) : await searchMusicBrainz(q);
  return Response.json({ candidates });
}
