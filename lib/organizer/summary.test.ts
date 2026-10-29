import { describe, expect, it } from "vitest";

import type { SongRecord } from "@/lib/organizer";
import { countRecords, filterRecords, parseHint } from "@/lib/organizer/summary";

const rec = (status: "ok" | "review" | "failed"): SongRecord => ({
  entry: { name: status, getFile: async () => new Blob() },
  outcome:
    status === "ok"
      ? { status, fileName: "a.mp3", tags: {}, hasArtwork: false }
      : status === "review"
        ? { status, kind: "candidates", candidates: [] }
        : { status, reason: "not-found" },
});

describe("결과 집계", () => {
  const records = [rec("ok"), rec("review"), rec("failed"), rec("ok")];

  it("분류별 곡 수를 센다", () => {
    expect(countRecords(records)).toEqual({ all: 4, ok: 2, need: 1, fail: 1 });
  });

  it("분류로 거르면서 원래 순서 번호를 유지한다", () => {
    expect(filterRecords(records, "ok").map((r) => r.index)).toEqual([0, 3]);
    expect(filterRecords(records, "fail").map((r) => r.index)).toEqual([2]);
  });

  it("입력을 제목 또는 가수-제목으로 해석한다", () => {
    expect(parseHint("푸른 새벽")).toEqual({ title: "푸른 새벽" });
    expect(parseHint("하늘고래 - 푸른 새벽")).toEqual({ artist: "하늘고래", title: "푸른 새벽" });
    expect(parseHint("  ")).toEqual({});
  });
});
