import type { InputFolder, Mp3Entry, OutputFolder } from "./index";

// 테스트에서 쓰는 메모리 폴더. 입력 폴더는 읽기만, 출력 폴더는 쓰기만 흉내 낸다.
export function memoryInputFolder(
  name: string,
  files: Record<string, Uint8Array>,
): InputFolder & { readCount: () => number } {
  let reads = 0;
  return {
    name,
    readCount: () => reads,
    async listMp3(): Promise<Mp3Entry[]> {
      return Object.entries(files)
        .filter(([fileName]) => /\.mp3$/i.test(fileName))
        .map(([fileName, bytes]) => ({
          name: fileName,
          getFile: async () => {
            reads++;
            return new Blob([bytes as BlobPart], { type: "audio/mpeg" });
          },
        }));
    },
  };
}

export function memoryOutputFolder(
  name = "정리됨",
  initial: string[] = [],
): OutputFolder & { files: Map<string, Blob> } {
  const files = new Map<string, Blob>(initial.map((n) => [n, new Blob([])]));
  return {
    name,
    files,
    async has(fileName) {
      return files.has(fileName);
    },
    async write(fileName, data) {
      files.set(fileName, data);
    },
    async remove(fileName) {
      files.delete(fileName);
    },
  };
}
