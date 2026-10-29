import type { Picture } from "@/lib/mp3-tags";
import type { SongCandidate } from "@/lib/song-sources";

import type { SongDeps } from "./index";

// 서버에는 검색어와 앨범아트 주소만 보낸다. 음원 파일은 보내지 않는다.
export function apiSongDeps(
  fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
): SongDeps {
  return {
    async search(text, source) {
      try {
        const res = await fetcher(
          `/api/songs/search?q=${encodeURIComponent(text)}&source=${source}`,
        );
        if (!res.ok) return [];
        const body = (await res.json()) as { candidates?: SongCandidate[] };
        return body.candidates ?? [];
      } catch {
        return [];
      }
    },
    async lyrics(title, artist) {
      try {
        const res = await fetcher(
          `/api/songs/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
        );
        if (!res.ok) return null;
        const body = (await res.json()) as { lyrics?: { plain: string } | null };
        return body.lyrics?.plain ?? null;
      } catch {
        return null;
      }
    },
    async artwork(url): Promise<Picture | null> {
      try {
        const res = await fetcher(`/api/songs/artwork?url=${encodeURIComponent(url)}`);
        if (!res.ok) return null;
        const mime = res.headers.get("content-type") ?? "image/jpeg";
        return { data: new Uint8Array(await res.arrayBuffer()), mime };
      } catch {
        return null;
      }
    },
  };
}
