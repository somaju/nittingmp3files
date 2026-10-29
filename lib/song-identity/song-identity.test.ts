import { describe, expect, it } from "vitest";

import {
  buildSearchQuery,
  stripArtistName,
  cleanTagTitle,
  preferOriginalNames,
  classifyMatch,
  isGarbledName,
  normalizeText,
} from "@/lib/song-identity";
import type { SongCandidate } from "@/lib/song-sources";

const cand = (over: Partial<SongCandidate>): SongCandidate => ({
  title: "Good Day",
  artist: "IU",
  source: "itunes",
  ...over,
});

describe("buildSearchQuery", () => {
  it("파일명의 잡음을 지우고 제목과 가수 후보를 만든다", () => {
    const q = buildSearchQuery({
      fileName: "하늘고래 - 푸른 새벽 (Official MV) [4K] 가사포함 www.mp3yt.example.mp3",
    });
    expect(q.text).toBe("하늘고래 푸른 새벽");
    expect(q.guesses).toEqual([
      { title: "하늘고래", artist: "푸른 새벽" },
      { title: "푸른 새벽", artist: "하늘고래" },
    ]);
  });

  it("기존 태그의 제목과 가수가 있으면 파일명보다 먼저 쓴다", () => {
    const q = buildSearchQuery({
      fileName: "track07.mp3",
      tags: { title: "Midnight Drive", artist: "Neon Harbor" },
    });
    expect(q.guesses[0]).toEqual({ title: "Midnight Drive", artist: "Neon Harbor" });
    expect(q.text).toBe("Neon Harbor Midnight Drive");
  });

  it("구분자가 없으면 제목만 후보로 둔다", () => {
    const q = buildSearchQuery({ fileName: "비 오는 날의 기억.mp3" });
    expect(q.text).toBe("비 오는 날의 기억");
    expect(q.guesses).toEqual([{ title: "비 오는 날의 기억" }]);
  });

  it("밑줄과 비트레이트 표기를 정리한다", () => {
    const q = buildSearchQuery({ fileName: "달빛정원_밤의 끝에서_320kbps_(1).mp3" });
    expect(q.text).toBe("달빛정원 밤의 끝에서");
  });
});

describe("가수가 둘 이상인 이름", () => {
  it("전체 이름과 가수 한 명씩의 검색어를 모두 만든다", () => {
    const q = buildSearchQuery({ fileName: "When I Get Old - Christopher, 청하.mp3" });
    expect(q.text).toBe("When I Get Old Christopher, 청하");
    expect(q.extra).toEqual(["Christopher When I Get Old", "청하 When I Get Old"]);
    expect(q.guesses).toContainEqual({ title: "When I Get Old", artist: "청하", artistPart: true });
  });

  it("가수 한 명이 후보의 가수 이름에 들어 있으면 같은 곡으로 확정한다", () => {
    const result = classifyMatch(
      [
        { title: "When I Get Old", artist: "Christopher, 청하" },
        { title: "When I Get Old", artist: "Christopher", artistPart: true },
      ],
      [
        cand({ title: "When I Get Old", artist: "Christopher & CHUNG HA", album: "Single" }),
        cand({ title: "Other Song", artist: "Christopher" }),
      ],
    );
    expect(result.kind === "single" && result.candidate.album).toBe("Single");
  });

  it("가수가 하나인 이름은 추가 검색어를 만들지 않는다", () => {
    expect(buildSearchQuery({ fileName: "Words - F.R. David.mp3" }).extra).toEqual([]);
  });
});

describe("preferOriginalNames", () => {
  const found = cand({ title: "Family Portrait", artist: "Kim Jin Ho", album: "Today", year: 2012, genre: "K-Pop" });

  it("한글로 적은 제목과 가수는 영어 표기를 받아도 유지하고 나머지 정보는 서비스 값을 쓴다", () => {
    const named = preferOriginalNames(
      buildSearchQuery({ fileName: "가족사진 (불후의 명곡2) - 김진호.mp3" }).guesses,
      found,
    );
    expect(named).toMatchObject({
      title: "가족사진",
      artist: "김진호",
      album: "Today",
      year: 2012,
      sourceTitle: "Family Portrait",
      sourceArtist: "Kim Jin Ho",
    });
  });

  it("제목만 한글이고 가수가 같은 곡은 제목만 유지한다", () => {
    const named = preferOriginalNames(
      buildSearchQuery({ fileName: "고민중독 - QWER.mp3" }).guesses,
      cand({ title: "T.B.H", artist: "QWER" }),
    );
    expect(named).toMatchObject({ title: "고민중독", artist: "QWER" });
  });

  it("외국 가수는 한글로 적었어도 영문 이름으로 바꾼다", () => {
    const named = preferOriginalNames(
      buildSearchQuery({ fileName: "when a child is born (나자리노 OST) - 사라 브라이트만.mp3" }).guesses,
      cand({ title: "When A Child Is Born", artist: "Sarah Brightman", genre: "Classical" }),
    );
    expect(named.artist).toBe("Sarah Brightman");
    expect(named.title).toBe("When A Child Is Born");
  });

  it("장르를 알 수 없으면 한글 가수 이름을 유지한다", () => {
    const named = preferOriginalNames(
      buildSearchQuery({ fileName: "가족사진 - 김진호.mp3" }).guesses,
      cand({ title: "Family Portrait", artist: "Kim Jin Ho" }),
    );
    expect(named.artist).toBe("김진호");
  });

  it("이름에 한글이 없으면 서비스 표기를 그대로 쓴다", () => {
    const candidate = cand({ title: "Words", artist: "F.R. David" });
    expect(
      preferOriginalNames(buildSearchQuery({ fileName: "Words - F.R. David.mp3" }).guesses, candidate),
    ).toBe(candidate);
  });
});

describe("태그 제목에 가수가 섞인 경우", () => {
  it("태그 제목의 가수 부분을 지우고 검색한다", () => {
    const q = buildSearchQuery({
      fileName: "x.mp3",
      tags: { title: "After School - Weeekly", artist: "Weeekly" },
    });
    expect(q.text).toBe("Weeekly After School");
    expect(q.guesses[0]).toEqual({ title: "After School", artist: "Weeekly" });
  });

  it("괄호 설명과 공백 없는 구분자도 정리한다", () => {
    expect(cleanTagTitle("가족사진 (불후의 명곡2) - 김진호", "김진호")).toBe("가족사진");
    expect(cleanTagTitle("A Thousand Years -Christina Perri", "Christina Perri")).toBe("A Thousand Years");
  });

  it("가수가 둘이면 어느 한 명의 이름이 붙어 있어도 지운다", () => {
    expect(cleanTagTitle("Endless Love - Mariah Carey & Luther Vandross", "Mariah Carey & Luther Vandross")).toBe("Endless Love");
  });

  it("가수 태그가 없으면 태그 제목을 파일명처럼 읽는다", () => {
    const q = buildSearchQuery({ fileName: "x.mp3", tags: { title: "Words - F.R. David" } });
    expect(q.guesses[0]).toEqual({ title: "Words", artist: "F.R. David" });
  });

  it("가수 이름이 들어 있지 않은 제목의 하이픈은 지우지 않는다", () => {
    expect(cleanTagTitle("Spider-Man - Intro", "Someone")).toBe("Spider-Man - Intro");
  });
});

describe("제목에 가수 이름이 중복된 경우", () => {
  it("제목 앞이나 뒤에 붙은 가수 이름을 한 번만 남긴다", () => {
    expect(stripArtistName("Christina Perri A Thousand Years", "Christina Perri")).toBe("A Thousand Years");
    expect(stripArtistName("Shape of My Heart Sting", "Sting")).toBe("Shape of My Heart");
    expect(stripArtistName("Hisaishi Joe 인생의 회전목마", "Hisaishi Joe")).toBe("인생의 회전목마");
  });

  it("가수 이름이 제목 전체이거나 앞뒤에 없으면 그대로 둔다", () => {
    expect(stripArtistName("IU", "IU")).toBe("IU");
    expect(stripArtistName("Fun with Friends and Fun", "Friends")).toBe("Fun with Friends and Fun");
  });

  it("가수가 둘이면 한 명의 이름만 붙어 있어도 지운다", () => {
    expect(stripArtistName("Mariah Carey Endless Love", "Mariah Carey & Luther Vandross")).toBe("Endless Love");
  });

  it("파일명에서도 제목의 가수 이름을 한 번만 남긴다", () => {
    const q = buildSearchQuery({ fileName: "Hisaishi Joe 인생의 회전목마 - Hisaishi Joe.mp3" });
    expect(q.guesses[0]).toEqual({ title: "인생의 회전목마", artist: "Hisaishi Joe" });
    expect(q.text).toBe("인생의 회전목마 Hisaishi Joe");
  });

  it("태그 제목에 가수 이름이 이어 붙어 있어도 한 번만 남긴다", () => {
    const q = buildSearchQuery({
      fileName: "x.mp3",
      tags: { title: "Christina Perri A Thousand Years -Christina Perri", artist: "Christina Perri" },
    });
    expect(q.guesses[0]).toEqual({ title: "A Thousand Years", artist: "Christina Perri" });
  });
});

describe("isGarbledName", () => {
  it("깨진 문자가 대부분이면 깨진 이름으로 본다", () => {
    expect(isGarbledName("í•˜ëŠ˜ê³ ëž˜_ìƒˆë²½_07.mp3")).toBe(true);
    expect(isGarbledName("���.mp3")).toBe(true);
  });

  it("정상적인 한글, 영문 이름은 깨진 이름이 아니다", () => {
    expect(isGarbledName("푸른 새벽-하늘고래.mp3")).toBe(false);
    expect(isGarbledName("Paper Planes - Lumen Park.mp3")).toBe(false);
    expect(isGarbledName("my_recording_final_v3 (copy).mp3")).toBe(false);
  });
});

describe("normalizeText", () => {
  it("대소문자, 공백, 구두점을 무시한다", () => {
    expect(normalizeText("Good  Day!")).toBe(normalizeText("good day"));
  });
});

describe("classifyMatch", () => {
  const guesses = [{ title: "Good Day", artist: "IU" }];

  it("제목과 가수가 같은 곡이 하나뿐이면 확정한다(여러 버전은 한 곡으로 본다)", () => {
    const result = classifyMatch(guesses, [
      cand({ album: "Real", year: 2010 }),
      cand({ album: "Best", year: 2015 }),
      cand({ title: "Another", artist: "Other" }),
    ]);
    expect(result.kind).toBe("single");
    if (result.kind === "single") expect(result.candidate.album).toBe("Real");
  });

  it("같은 곡의 여러 버전 중 가장 이른 출시년도를 원곡으로 고른다", () => {
    const result = classifyMatch(guesses, [
      cand({ album: "Remaster", year: 2022 }),
      cand({ album: "Real", year: 2010 }),
    ]);
    expect(result.kind === "single" && result.candidate.album).toBe("Real");
  });

  it("같은 곡이 하나 있으면 라이브 같은 다른 제목의 후보가 함께 와도 확정한다", () => {
    const result = classifyMatch(guesses, [
      cand({}),
      cand({ title: "Good Day (Live)" }),
    ]);
    expect(result.kind).toBe("single");
  });

  it("정확히 같은 곡이 없지만 후보가 있으면 후보 선택이 필요하다", () => {
    const result = classifyMatch(guesses, [cand({ title: "Other", artist: "Someone" })]);
    expect(result.kind).toBe("ambiguous");
  });

  it("구분자 없이 가수와 제목이 이어 적힌 이름도 같은 곡으로 확정한다", () => {
    const result = classifyMatch(
      [{ title: "BTS Dynamite" }],
      [
        cand({ title: "Dynamite (Live)", artist: "BTS" }),
        cand({ title: "Dynamite (Holiday Remix)", artist: "BTS" }),
        cand({ title: "Dynamite", artist: "BTS", album: "BE" }),
      ],
    );
    expect(result.kind === "single" && result.candidate.album).toBe("BE");
  });

  it("제목이 같고 가수만 한글과 영문 표기가 다르면 그런 곡이 하나일 때 확정한다", () => {
    const result = classifyMatch(
      [{ title: "when a child is born", artist: "사라 브라이트만" }],
      [
        cand({ title: "When A Child Is Born", artist: "Sarah Brightman", album: "Winter Symphony" }),
        cand({ title: "Time to Say Goodbye", artist: "Sarah Brightman" }),
      ],
    );
    expect(result.kind === "single" && result.candidate.album).toBe("Winter Symphony");
  });

  it("표기가 다른 가수의 같은 제목 곡이 둘이면 후보 선택이 필요하다", () => {
    const result = classifyMatch(
      [{ title: "Good Day", artist: "아이유" }],
      [cand({}), cand({ artist: "twenty one pilots" })],
    );
    expect(result.kind).toBe("ambiguous");
  });

  it("후보가 없으면 찾지 못한 것이다", () => {
    expect(classifyMatch(guesses, []).kind).toBe("none");
  });

  it("제목만 알 때 가수가 서로 다른 곡이 둘이면 후보 선택이 필요하다", () => {
    const result = classifyMatch(
      [{ title: "Good Day" }],
      [cand({}), cand({ artist: "Other" })],
    );
    expect(result.kind).toBe("ambiguous");
  });
});
