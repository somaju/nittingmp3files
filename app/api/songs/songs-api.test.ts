import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as artwork } from "@/app/api/songs/artwork/route";
import { GET as lyrics } from "@/app/api/songs/lyrics/route";
import { GET as search } from "@/app/api/songs/search/route";

afterEach(() => vi.unstubAllGlobals());

const req = (path: string) => new Request(`http://localhost${path}`);

describe("곡 정보 중계 경로", () => {
  it("검색어 없이 검색하면 400을 돌려준다", async () => {
    expect((await search(req("/api/songs/search"))).status).toBe(400);
  });

  it("iTunes 검색 결과를 후보로 돌려준다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ results: [{ trackName: "Good Day", artistName: "IU" }] }),
      ),
    );
    const body = await (await search(req("/api/songs/search?q=IU+Good+Day"))).json();
    expect(body.candidates[0]).toMatchObject({ title: "Good Day", artist: "IU" });
  });

  it("제목과 가수 없이 가사를 요청하면 400을 돌려준다", async () => {
    expect((await lyrics(req("/api/songs/lyrics?title=x"))).status).toBe(400);
  });

  it("허용되지 않은 주소의 앨범아트는 받아 오지 않는다", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await artwork(req("/api/songs/artwork?url=https://evil.example/a.jpg"));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
