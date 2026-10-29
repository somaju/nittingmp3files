// @vitest-environment node
import { describe, expect, it } from "vitest";

import { makeMp3 } from "@/lib/mp3-tags/fixture";
import { readTags, writeTags } from "@/lib/mp3-tags";

const blobOf = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: "audio/mpeg" });
const pixel = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

describe("mp3 태그", () => {
  it("태그가 없는 파일은 빈 태그를 돌려준다", async () => {
    const { tags, picture } = await readTags(blobOf(makeMp3()));
    expect(tags).toEqual({});
    expect(picture).toBeUndefined();
  });

  it("쓴 태그를 다시 읽으면 같은 값이 나온다", async () => {
    const written = await writeTags(
      blobOf(makeMp3()),
      {
        title: "푸른 새벽",
        artist: "하늘고래",
        album: "새벽의 지도",
        genre: "인디 팝",
        year: 2021,
        lyrics: "첫 줄\n둘째 줄",
      },
      { data: pixel, mime: "image/jpeg" },
    );
    const { tags, picture } = await readTags(written);
    expect(tags).toEqual({
      title: "푸른 새벽",
      artist: "하늘고래",
      album: "새벽의 지도",
      genre: "인디 팝",
      year: 2021,
      lyrics: "첫 줄\n둘째 줄",
    });
    expect(picture?.mime).toBe("image/jpeg");
  });

  it("음원 데이터는 태그를 써도 그대로 남는다", async () => {
    const original = makeMp3();
    const written = await writeTags(blobOf(original), { title: "x" });
    const bytes = new Uint8Array(await written.arrayBuffer());
    const tail = bytes.slice(bytes.length - original.length);
    expect(Buffer.from(tail).equals(Buffer.from(original))).toBe(true);
  });

  it("이미 태그가 있는 파일에 다시 써도 이전 태그는 남지 않는다", async () => {
    const first = await writeTags(blobOf(makeMp3()), { title: "옛 제목" });
    const second = await writeTags(first, { title: "새 제목" });
    expect((await readTags(second)).tags.title).toBe("새 제목");
  });
});
