import { describe, expect, it } from "vitest"

import type { SongOutcome } from "@/lib/organizer"
import {
  describeSession,
  planResume,
  stripPicture,
  type SavedSession,
} from "@/lib/session-store"

const handle = { name: "x", values: async function* () {}, getFileHandle: async () => ({}) as never }

const ok: SongOutcome = { status: "ok", fileName: "a.mp3", tags: {}, hasArtwork: true }
const session = (over: Partial<SavedSession> = {}): SavedSession => ({
  version: 1,
  input: { name: "입력", handle },
  output: { name: "정리됨", handle },
  entryNames: ["a.mp3", "b.mp3", "c.mp3", "d.mp3"],
  records: [
    { name: "a.mp3", outcome: ok },
    { name: "b.mp3", outcome: { status: "failed", reason: "not-found" } },
  ],
  ...over,
})

describe("describeSession", () => {
  it("남은 곡과 처리하지 못한 곡을 센다", () => {
    expect(describeSession(session())).toMatchObject({
      total: 4,
      done: 2,
      remaining: 2,
      ok: 1,
      fail: 1,
      need: 0,
      hasWork: true,
    })
  })

  it("모두 완료되었고 남은 것이 없으면 할 일이 없다", () => {
    const done = session({
      entryNames: ["a.mp3"],
      records: [{ name: "a.mp3", outcome: ok }],
    })
    expect(describeSession(done).hasWork).toBe(false)
  })

  it("끝까지 처리했어도 처리하지 못한 곡이 있으면 할 일이 있다", () => {
    const s = session({
      entryNames: ["b.mp3"],
      records: [{ name: "b.mp3", outcome: { status: "failed", reason: "garbled" } }],
    })
    expect(describeSession(s).hasWork).toBe(true)
  })
})

describe("planResume", () => {
  it("이미 끝낸 곡은 건너뛰고 멈춘 곳부터 이어서 처리한다", () => {
    expect(planResume(session(), ["a.mp3", "b.mp3", "c.mp3", "d.mp3"])).toEqual({
      todo: ["c.mp3", "d.mp3"],
      missing: [],
    })
  })

  it("입력 폴더에서 사라진 곡은 따로 알린다", () => {
    expect(planResume(session(), ["a.mp3", "b.mp3", "d.mp3"])).toEqual({
      todo: ["d.mp3"],
      missing: ["c.mp3"],
    })
  })
})

describe("stripPicture", () => {
  it("저장할 때 앨범아트 바이트를 뺀다", () => {
    const withPicture: SongOutcome = {
      ...ok,
      picture: { data: new Uint8Array([1, 2]), mime: "image/jpeg" },
    }
    expect(stripPicture(withPicture)).not.toHaveProperty("picture")
    expect(stripPicture({ status: "failed", reason: "garbled" })).toEqual({
      status: "failed",
      reason: "garbled",
    })
  })
})
