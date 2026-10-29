import { stripArtistName } from "@/lib/song-identity";

const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_STEM = 180;

// 운영체제가 허용하지 않는 문자를 공백으로 바꾸고 이름을 안전하게 다듬는다.
export function safeStem(stem: string): string {
  let result = stem.replace(ILLEGAL, " ").replace(/\s+/g, " ").trim();
  result = result.replace(/[. ]+$/, "").slice(0, MAX_STEM).trim();
  if (!result) result = "제목 없음";
  if (RESERVED.test(result)) result = `${result}_`;
  return result;
}

// 파일 안의 제목 태그와 파일명에 쓰는 "노래이름 - 가수이름". 가수 이름은 한 번만 들어간다.
export function songTitle(title: string, artist: string): string {
  return `${stripArtistName(title.trim(), artist)} - ${artist.trim()}`;
}

// 파일명은 제목 태그와 같고, 운영체제가 허용하지 않는 문자만 공백으로 바뀐다.
export function songFileName(title: string, artist: string): string {
  return `${safeStem(songTitle(title, artist))}.mp3`;
}
