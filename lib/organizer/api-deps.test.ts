import { describe, expect, it, vi } from "vitest";

import { apiSongDeps } from "@/lib/organizer/api-deps";

describe("apiSongDeps", () => {
  it("서버로 가는 요청은 검색어와 주소뿐이고 본문이 없다", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ candidates: [], lyrics: null }),
    );
    const deps = apiSongDeps(fetcher);
    await deps.search("IU Good Day", "itunes");
    await deps.lyrics("Good Day", "IU");
    for (const [url, init] of fetcher.mock.calls) {
      expect(String(url)).toMatch(/^\/api\/songs\//);
      expect(init?.body).toBeUndefined();
      expect(init?.method ?? "GET").toBe("GET");
    }
  });

  it("서버 오류는 빈 결과로 바꾼다", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network"));
    const deps = apiSongDeps(fetcher);
    expect(await deps.search("x", "itunes")).toEqual([]);
    expect(await deps.lyrics("x", "y")).toBeNull();
    expect(await deps.artwork("https://coverartarchive.org/a")).toBeNull();
  });
});
