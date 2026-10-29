import { describe, expect, it } from "vitest";

import { safeStem, songFileName } from "@/lib/organizer/file-names";

describe("songFileName", () => {
  it("노래명 - 가수.mp3 형식으로 만든다", () => {
    expect(songFileName("푸른 새벽", "하늘고래")).toBe("푸른 새벽 - 하늘고래.mp3");
  });

  it("허용되지 않는 문자를 공백으로 바꾼다", () => {
    expect(songFileName("Back/Slash: Title?", "AC/DC")).toBe("Back Slash Title - AC DC.mp3");
  });

  it("끝의 점과 공백을 지우고 예약된 이름을 피한다", () => {
    expect(safeStem("제목. . ")).toBe("제목");
    expect(safeStem("CON")).toBe("CON_");
    expect(safeStem("???")).toBe("제목 없음");
  });
});
