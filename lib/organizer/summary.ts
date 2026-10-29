import type { SongRecord } from "./index";

export type SongFilter = "all" | "ok" | "need" | "fail";

export function countRecords(records: SongRecord[]) {
  return {
    all: records.length,
    ok: records.filter((r) => r.outcome.status === "ok" || r.outcome.status === "skipped").length,
    need: records.filter((r) => r.outcome.status === "review").length,
    fail: records.filter((r) => r.outcome.status === "failed").length,
  };
}

export function filterRecords(records: SongRecord[], filter: SongFilter) {
  return records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => {
      const s = record.outcome.status;
      return (
        filter === "all" ||
        (filter === "ok" && (s === "ok" || s === "skipped")) ||
        (filter === "need" && s === "review") ||
        (filter === "fail" && s === "failed")
      );
    });
}

export const FAILURE_TEXT = {
  garbled: "파일명이 깨져 제목을 알 수 없습니다. 재생해 들어 보고 제목을 입력해 주세요.",
  "not-found": "일치하는 곡을 찾지 못했습니다. 제목을 고치면 다시 검색합니다.",
  "no-artist": "곡은 찾았지만 가수 정보를 알 수 없습니다. 가수를 입력해 주세요.",
  error: "파일을 읽지 못했습니다. 제목을 입력하면 다시 시도합니다.",
} as const;

export const FIELD_LABEL = {
  title: "제목",
  artist: "가수",
  album: "앨범",
  genre: "장르",
  year: "출시년도",
} as const;

// "가수 - 제목" 형식으로 입력하면 둘 다, 아니면 제목만으로 본다.
export function parseHint(input: string): { title?: string; artist?: string } {
  const text = input.trim();
  const parts = text.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  return text ? { title: text } : {};
}
