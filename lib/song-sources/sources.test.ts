import { describe, expect, it, vi } from "vitest";

import { searchItunes } from "@/lib/song-sources/itunes";
import { fetchLyrics } from "@/lib/song-sources/lrclib";
import { searchMusicBrainz } from "@/lib/song-sources/musicbrainz";
import { isAllowedArtworkUrl } from "@/lib/song-sources/artwork";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("searchItunes", () => {
  it("곡 정보를 후보로 바꾸고 앨범아트를 큰 크기 주소로 바꾼다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        resultCount: 1,
        results: [
          {
            trackName: "Good Day",
            artistName: "IU",
            collectionName: "Real",
            primaryGenreName: "K-Pop",
            releaseDate: "2010-12-09T08:00:00Z",
            artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg",
          },
        ],
      }),
    );
    const result = await searchItunes("IU Good Day", fetcher);
    expect(result).toEqual([
      {
        title: "Good Day",
        artist: "IU",
        album: "Real",
        genre: "K-Pop",
        year: 2010,
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/a/600x600bb.jpg",
        source: "itunes",
      },
    ]);
    expect(String(fetcher.mock.calls[0][0])).toContain("term=IU%20Good%20Day");
  });

  it("서비스가 실패하면 빈 목록을 돌려준다", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({}, 503));
    expect(await searchItunes("x", fetcher)).toEqual([]);
  });
});

describe("searchMusicBrainz", () => {
  it("녹음 정보를 후보로 바꾸고 식별 가능한 User-Agent를 보낸다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        recordings: [
          {
            title: "Good Day",
            "artist-credit": [{ name: "IU" }],
            "first-release-date": "2010-12-09",
            releases: [{ id: "rel-1", title: "Real", date: "2010-12-09" }],
          },
        ],
      }),
    );
    const result = await searchMusicBrainz("IU Good Day", fetcher, { throttleMs: 0 });
    expect(result).toEqual([
      {
        title: "Good Day",
        artist: "IU",
        album: "Real",
        year: 2010,
        artworkUrl: "https://coverartarchive.org/release/rel-1/front-500",
        source: "musicbrainz",
      },
    ]);
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/mp3-organizer/);
  });
});

describe("fetchLyrics", () => {
  it("일반 텍스트 가사가 있는 첫 결과를 돌려준다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json([
        { plainLyrics: null },
        { plainLyrics: "첫 줄\n둘째 줄" },
      ]),
    );
    expect(await fetchLyrics("Good Day", "IU", fetcher)).toEqual({
      plain: "첫 줄\n둘째 줄",
    });
  });

  it("가사가 없으면 null을 돌려준다", async () => {
    const fetcher = vi.fn().mockResolvedValue(json([]));
    expect(await fetchLyrics("x", "y", fetcher)).toBeNull();
  });
});

describe("isAllowedArtworkUrl", () => {
  it("허용된 앨범아트 서버의 https 주소만 통과시킨다", () => {
    expect(isAllowedArtworkUrl("https://is1-ssl.mzstatic.com/a.jpg")).toBe(true);
    expect(isAllowedArtworkUrl("https://coverartarchive.org/release/x/front-500")).toBe(true);
    expect(isAllowedArtworkUrl("http://is1-ssl.mzstatic.com/a.jpg")).toBe(false);
    expect(isAllowedArtworkUrl("https://evil.example/a.jpg")).toBe(false);
    expect(isAllowedArtworkUrl("not a url")).toBe(false);
  });
});
