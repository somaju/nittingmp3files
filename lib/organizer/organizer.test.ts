// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { memoryInputFolder, memoryOutputFolder } from "@/lib/folder-access/memory";
import { makeMp3 } from "@/lib/mp3-tags/fixture";
import { readTags, writeTags } from "@/lib/mp3-tags";
import {
  chooseCandidate,
  processSong,
  resolveConflicts,
  runOrganizer,
  saveManual,
  type SongDeps,
} from "@/lib/organizer";
import type { SongCandidate } from "@/lib/song-sources";

const pixel = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

const goodDay: SongCandidate = {
  title: "푸른 새벽",
  artist: "하늘고래",
  album: "새벽의 지도",
  genre: "인디 팝",
  year: 2021,
  artworkUrl: "https://is1-ssl.mzstatic.com/a.jpg",
  source: "itunes",
};

function deps(over: Partial<SongDeps> = {}): SongDeps {
  return {
    search: vi.fn().mockResolvedValue([goodDay]),
    lyrics: vi.fn().mockResolvedValue("첫 줄\n둘째 줄"),
    artwork: vi.fn().mockResolvedValue({ data: pixel, mime: "image/jpeg" }),
    ...over,
  };
}

async function oneEntry(fileName: string, bytes = makeMp3()) {
  const input = memoryInputFolder("입력", { [fileName]: bytes });
  const [entry] = await input.listMp3();
  return { input, entry };
}

describe("processSong", () => {
  it("곡이 하나로 정해지면 노래명 - 가수.mp3로 태그를 채워 출력 폴더에 만든다", async () => {
    const { entry } = await oneEntry("하늘고래 - 푸른 새벽 (Official MV) [4K].mp3");
    const output = memoryOutputFolder();
    const outcome = await processSong(entry, output, deps());

    expect(outcome).toMatchObject({ status: "ok", fileName: "푸른 새벽 - 하늘고래.mp3", hasArtwork: true });
    const written = output.files.get("푸른 새벽 - 하늘고래.mp3")!;
    const { tags, picture } = await readTags(written);
    expect(tags).toEqual({
      title: "푸른 새벽 - 하늘고래",
      artist: "하늘고래",
      album: "새벽의 지도",
      genre: "인디 팝",
      year: 2021,
      lyrics: "첫 줄\n둘째 줄",
    });
    expect(picture?.mime).toBe("image/jpeg");
  });

  it("기존 태그와 같은 값은 그대로 두고 비어 있는 항목만 채운다", async () => {
    const tagged = await writeTags(new Blob([makeMp3() as BlobPart]), {
      title: "푸른 새벽",
      artist: "하늘고래",
      genre: "인디 팝",
    });
    const bytes = new Uint8Array(await tagged.arrayBuffer());
    const { entry } = await oneEntry("track01.mp3", bytes);
    const output = memoryOutputFolder();
    const outcome = await processSong(entry, output, deps());
    expect(outcome.status).toBe("ok");
    const { tags } = await readTags(output.files.get("푸른 새벽 - 하늘고래.mp3")!);
    expect(tags.genre).toBe("인디 팝");
    expect(tags.album).toBe("새벽의 지도");
  });

  it("태그 제목에 가수가 섞여 있어도 충돌로 보지 않고 깨끗한 제목으로 바꾼다", async () => {
    const tagged = await writeTags(new Blob([makeMp3() as BlobPart]), {
      title: "푸른 새벽 - 하늘고래",
      artist: "하늘고래",
    });
    const { entry } = await oneEntry("a.mp3", new Uint8Array(await tagged.arrayBuffer()));
    const output = memoryOutputFolder();
    const outcome = await processSong(entry, output, deps());
    expect(outcome).toMatchObject({ status: "ok", fileName: "푸른 새벽 - 하늘고래.mp3" });
    const { tags } = await readTags(output.files.get("푸른 새벽 - 하늘고래.mp3")!);
    expect(tags.title).toBe("푸른 새벽 - 하늘고래");
  });

  it("기존 태그와 검색 결과가 다르면 쓰지 않고 확인 필요로 둔다", async () => {
    const tagged = await writeTags(new Blob([makeMp3() as BlobPart]), {
      title: "푸른 새벽",
      artist: "하늘고래",
      year: 2014,
    });
    const { entry } = await oneEntry("a.mp3", new Uint8Array(await tagged.arrayBuffer()));
    const output = memoryOutputFolder();
    const outcome = await processSong(entry, output, deps());
    expect(outcome).toMatchObject({
      status: "review",
      kind: "conflict",
      conflicts: [{ field: "year", existing: "2014", found: "2021" }],
    });
    expect(output.files.size).toBe(0);
  });

  it("충돌을 항목별로 고르면 그 값으로 만든다", async () => {
    const tagged = await writeTags(new Blob([makeMp3() as BlobPart]), {
      title: "푸른 새벽",
      artist: "하늘고래",
      year: 2014,
    });
    const { entry } = await oneEntry("a.mp3", new Uint8Array(await tagged.arrayBuffer()));
    const output = memoryOutputFolder();
    const outcome = await resolveConflicts(entry, output, deps(), goodDay, { year: "found" });
    expect(outcome.status).toBe("ok");
    const { tags } = await readTags(output.files.get("푸른 새벽 - 하늘고래.mp3")!);
    expect(tags.year).toBe(2021);
  });

  it("후보가 여럿이면 후보를 돌려주고 출력 폴더에는 쓰지 않는다", async () => {
    const other = { ...goodDay, artist: "다른 가수" };
    const { entry } = await oneEntry("푸른 새벽.mp3");
    const output = memoryOutputFolder();
    const outcome = await processSong(
      entry,
      output,
      deps({ search: vi.fn().mockResolvedValue([goodDay, other]) }),
    );
    expect(outcome).toMatchObject({ status: "review", kind: "candidates" });
    expect(output.files.size).toBe(0);
  });

  it("후보를 고르면 그 곡만 출력 폴더에 만든다", async () => {
    const { entry } = await oneEntry("푸른 새벽.mp3");
    const output = memoryOutputFolder();
    const outcome = await chooseCandidate(entry, output, deps(), goodDay);
    expect(outcome.status).toBe("ok");
    expect([...output.files.keys()]).toEqual(["푸른 새벽 - 하늘고래.mp3"]);
  });

  it("파일명이 깨져 있고 태그도 없으면 검색하지 않고 처리 못함으로 둔다", async () => {
    const { entry } = await oneEntry("í•˜ëŠ˜ê³ ëž˜_ìƒˆë²½_07.mp3");
    const d = deps();
    const outcome = await processSong(entry, memoryOutputFolder(), d);
    expect(outcome).toMatchObject({ status: "failed", reason: "garbled" });
    expect(d.search).not.toHaveBeenCalled();
  });

  it("검색 결과가 없으면 처리 못함으로 둔다", async () => {
    const { entry } = await oneEntry("my_recording_final_v3 (copy).mp3");
    const outcome = await processSong(
      entry,
      memoryOutputFolder(),
      deps({ search: vi.fn().mockResolvedValue([]) }),
    );
    expect(outcome).toMatchObject({ status: "failed", reason: "not-found" });
  });

  it("사용자가 제목을 입력하면 그 제목으로 다시 검색한다", async () => {
    const search = vi.fn().mockResolvedValue([goodDay]);
    const { entry } = await oneEntry("í•˜ëŠ˜ê³ ëž˜_ìƒˆë²½_07.mp3");
    const output = memoryOutputFolder();
    const outcome = await processSong(entry, output, deps({ search }), {
      title: "푸른 새벽",
      artist: "하늘고래",
    });
    expect(outcome.status).toBe("ok");
    expect(search.mock.calls[0][0]).toBe("하늘고래 푸른 새벽");
  });

  it("가수를 알 수 없는 모음집 곡은 가수 입력이 필요한 처리 못함으로 둔다", async () => {
    const various = { ...goodDay, artist: "Various Artists" };
    const { entry } = await oneEntry("비 오는 날의 기억.mp3");
    const outcome = await processSong(
      entry,
      memoryOutputFolder(),
      deps({ search: vi.fn().mockResolvedValue([{ ...various, title: "비 오는 날의 기억" }]) }),
    );
    expect(outcome).toMatchObject({ status: "failed", reason: "no-artist", title: "비 오는 날의 기억" });
  });

  it("가수가 둘이면 전체 이름과 가수별로 모두 검색한다", async () => {
    const duet = { ...goodDay, title: "When I Get Old", artist: "Christopher & CHUNG HA", genre: "K-Pop" };
    const search = vi
      .fn()
      .mockImplementation(async (q: string) => (q.startsWith("Christopher When") ? [duet] : []));
    const { entry } = await oneEntry("When I Get Old - Christopher, 청하.mp3");
    const outcome = await processSong(entry, memoryOutputFolder(), deps({ search }));
    expect(outcome).toMatchObject({
      status: "ok",
      fileName: "When I Get Old - Christopher, 청하.mp3",
    });
    const queries = search.mock.calls.map((c) => c[0]);
    expect(queries).toEqual(
      expect.arrayContaining([
        "When I Get Old Christopher, 청하",
        "Christopher When I Get Old",
        "청하 When I Get Old",
      ]),
    );
  });

  it("한글 파일명은 서비스가 영어로 돌려줘도 한글 이름으로 저장하고 앨범 정보만 채운다", async () => {
    const english = {
      title: "Family Portrait",
      artist: "Kim Jin Ho",
      album: "Today",
      genre: "K-Pop",
      year: 2012,
      source: "itunes" as const,
    };
    const lyrics = vi.fn().mockImplementation(async (t: string) => (t === "Family Portrait" ? "가사" : null));
    const { entry } = await oneEntry("가족사진 - 김진호.mp3");
    const output = memoryOutputFolder();
    const outcome = await processSong(
      entry,
      output,
      deps({ search: vi.fn().mockResolvedValue([english]), lyrics }),
    );
    expect(outcome.status).toBe("review");
    if (outcome.status !== "review" || outcome.kind !== "candidates") throw new Error("candidates expected");
    expect(outcome.candidates[0]).toMatchObject({ title: "가족사진", artist: "김진호" });
    const done = await chooseCandidate(entry, output, deps({ lyrics }), outcome.candidates[0]);
    expect(done).toMatchObject({ status: "ok", fileName: "가족사진 - 김진호.mp3" });
    const { tags } = await readTags(output.files.get("가족사진 - 김진호.mp3")!);
    expect(tags).toMatchObject({ title: "가족사진 - 김진호", artist: "김진호", album: "Today", genre: "K-Pop", lyrics: "가사" });
  });

  it("같은 이름의 파일이 출력 폴더에 이미 있으면 만들지 않고 건너뛴다", async () => {
    const { entry } = await oneEntry("푸른 새벽.mp3");
    const output = memoryOutputFolder("정리됨", ["푸른 새벽 - 하늘고래.mp3"]);
    const d = deps();
    const outcome = await processSong(entry, output, d);
    expect(outcome).toEqual({ status: "skipped", fileName: "푸른 새벽 - 하늘고래.mp3" });
    expect(output.files.size).toBe(1);
    expect(d.lyrics).not.toHaveBeenCalled();
    expect(d.artwork).not.toHaveBeenCalled();
  });

  it("입력 폴더에 같은 곡이 두 번 있으면 두 번째는 건너뛴다", async () => {
    const input = memoryInputFolder("입력", {
      "하늘고래 - 푸른 새벽.mp3": makeMp3(),
      "푸른 새벽 - 하늘고래.mp3": makeMp3(),
    });
    const output = memoryOutputFolder();
    const records = await runOrganizer({ entries: await input.listMp3(), output, deps: deps() });
    expect(records.map((r) => r.outcome.status).sort()).toEqual(["ok", "skipped"]);
    expect(output.files.size).toBe(1);
  });

  it("가사와 앨범아트가 없어도 나머지 정보로 완료한다", async () => {
    const { entry } = await oneEntry("푸른 새벽.mp3");
    const output = memoryOutputFolder();
    const outcome = await processSong(
      entry,
      output,
      deps({ lyrics: vi.fn().mockResolvedValue(null), artwork: vi.fn().mockResolvedValue(null) }),
    );
    expect(outcome).toMatchObject({ status: "ok", hasArtwork: false });
    const { tags } = await readTags(output.files.get("푸른 새벽 - 하늘고래.mp3")!);
    expect(tags.lyrics).toBeUndefined();
  });

  it("iTunes에서 정해지지 않으면 MusicBrainz도 찾아 본다", async () => {
    const search = vi.fn().mockImplementation(async (_q: string, source: string) =>
      source === "itunes" ? [] : [{ ...goodDay, source: "musicbrainz" }],
    );
    const { entry } = await oneEntry("하늘고래 - 푸른 새벽.mp3");
    const outcome = await processSong(entry, memoryOutputFolder(), deps({ search }));
    expect(outcome.status).toBe("ok");
    expect(search.mock.calls.map((c) => c[1])).toEqual(["itunes", "musicbrainz"]);
  });
});

describe("대량 처리", () => {
  it("100곡을 한 번에 처리하고 결과를 모두 돌려준다", async () => {
    const files: Record<string, Uint8Array> = {}
    for (let i = 1; i <= 100; i++) files[`하늘고래 - 곡${i}.mp3`] = makeMp3(2)
    const input = memoryInputFolder("입력", files)
    const output = memoryOutputFolder()
    const search = vi.fn().mockImplementation(async (q: string) => {
      const n = q.match(/곡(\d+)/)![1]
      return [{ ...goodDay, title: `곡${n}` }]
    })
    const records = await runOrganizer({ entries: await input.listMp3(), output, deps: deps({ search }) })
    expect(records).toHaveLength(100)
    expect(records.every((r) => r.outcome.status === "ok")).toBe(true)
    expect(output.files.size).toBe(100)
  })
})

describe("원본 보존", () => {
  it("변환 후에도 입력 폴더의 음원 바이트가 바뀌지 않는다", async () => {
    const original = makeMp3();
    const before = Buffer.from(original).toString("base64");
    const input = memoryInputFolder("입력", { "하늘고래 - 푸른 새벽.mp3": original });
    await runOrganizer({
      entries: await input.listMp3(),
      output: memoryOutputFolder(),
      deps: deps(),
    });
    expect(Buffer.from(original).toString("base64")).toBe(before);
  });
});

describe("saveManual", () => {
  it("사용자가 고친 값 그대로 파일명과 태그를 만든다", async () => {
    const { entry } = await oneEntry("모르는 곡.mp3");
    const output = memoryOutputFolder();
    const outcome = await saveManual(
      entry,
      output,
      deps(),
      { title: "내가 고친 제목", artist: "내가 고친 가수", album: "손으로 쓴 앨범", year: 1999 },
      "https://is1-ssl.mzstatic.com/a.jpg",
    );
    expect(outcome).toMatchObject({ status: "ok", fileName: "내가 고친 제목 - 내가 고친 가수.mp3" });
    const { tags, picture } = await readTags(output.files.get("내가 고친 제목 - 내가 고친 가수.mp3")!);
    expect(tags).toMatchObject({ title: "내가 고친 제목 - 내가 고친 가수", artist: "내가 고친 가수", album: "손으로 쓴 앨범", year: 1999 });
    expect(tags.genre).toBeUndefined();
    expect(picture).toBeDefined();
  });

  it("직접 편집으로 저장할 이름이 이미 있으면 건너뛴다", async () => {
    const { entry } = await oneEntry("a.mp3");
    const output = memoryOutputFolder("정리됨", ["A - B.mp3"]);
    expect(await saveManual(entry, output, deps(), { title: "A", artist: "B" })).toEqual({
      status: "skipped",
      fileName: "A - B.mp3",
    });
    expect(output.files.size).toBe(1);
  });

  it("제목 태그와 파일명이 같고 가수 이름은 한 번만 들어간다", async () => {
    const { entry } = await oneEntry("a.mp3");
    const output = memoryOutputFolder();
    const outcome = await saveManual(entry, output, deps(), {
      title: "Christina Perri A Thousand Years - Christina Perri",
      artist: "Christina Perri",
    });
    expect(outcome).toMatchObject({ status: "ok", fileName: "A Thousand Years - Christina Perri.mp3" });
    const { tags } = await readTags(output.files.get("A Thousand Years - Christina Perri.mp3")!);
    expect(tags.title).toBe("A Thousand Years - Christina Perri");
    expect(tags.artist).toBe("Christina Perri");
  });

  it("제목이나 가수가 비어 있으면 만들지 않는다", async () => {
    const { entry } = await oneEntry("a.mp3");
    const output = memoryOutputFolder();
    const outcome = await saveManual(entry, output, deps(), { title: "제목", artist: "  " });
    expect(outcome.status).toBe("failed");
    expect(output.files.size).toBe(0);
  });

  it("직접 쓴 가사를 우선하고 입력하지 않으면 찾아 본다", async () => {
    const { entry } = await oneEntry("a.mp3");
    const output = memoryOutputFolder();
    await saveManual(entry, output, deps(), { title: "A", artist: "B", lyrics: "내가 쓴 가사" });
    expect((await readTags(output.files.get("A - B.mp3")!)).tags.lyrics).toBe("내가 쓴 가사");
  });
});

describe("runOrganizer", () => {
  it("어떤 곡이 실패해도 나머지를 계속 처리하고 진행을 알린다", async () => {
    const input = memoryInputFolder("입력", {
      "하늘고래 - 푸른 새벽.mp3": makeMp3(),
      "í•˜ëŠ˜ê³ ëž˜_ìƒˆë²½_07.mp3": makeMp3(),
      "푸른 새벽 - 하늘고래.mp3": makeMp3(),
    });
    const output = memoryOutputFolder();
    const events: string[] = [];
    const records = await runOrganizer({
      entries: await input.listMp3(),
      output,
      deps: deps(),
      onStart: (name, i, total) => events.push(`start ${i + 1}/${total} ${name}`),
      onDone: (record, i) => events.push(`done ${i + 1} ${record.outcome.status}`),
    });
    expect(records.map((r) => r.outcome.status)).toEqual(["ok", "failed", "skipped"]);
    expect(events).toContain("done 2 failed");
    expect(events.filter((e) => e.startsWith("start"))).toHaveLength(3);
  });

  it("파일을 읽다 오류가 나도 그 곡만 처리 못함으로 둔다", async () => {
    const entry = {
      name: "깨진 파일.mp3",
      getFile: async () => {
        throw new Error("read failed");
      },
    };
    const [record] = await runOrganizer({ entries: [entry], output: memoryOutputFolder(), deps: deps() });
    expect(record.outcome).toMatchObject({ status: "failed", reason: "error" });
  });
});
