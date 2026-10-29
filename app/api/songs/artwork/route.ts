import { isAllowedArtworkUrl } from "@/lib/song-sources/artwork";

// 앨범아트 서버가 브라우저의 직접 요청을 허용하지 않을 수 있어 이미지를 대신 받아 전달한다.
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isAllowedArtworkUrl(url)) {
    return Response.json({ error: "url is not allowed" }, { status: 400 });
  }
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return new Response(null, { status: 404 });
    return new Response(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
