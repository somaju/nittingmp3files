export type Mp3Entry = {
  name: string;
  getFile(): Promise<Blob>;
};

export type InputFolder = {
  name: string;
  listMp3(): Promise<Mp3Entry[]>;
};

export type OutputFolder = {
  name: string;
  has(fileName: string): Promise<boolean>;
  write(fileName: string, data: Blob): Promise<void>;
  remove?(fileName: string): Promise<void>;
};

// 브라우저의 폴더 접근 기능(File System Access API) 중 이 앱이 쓰는 부분만 적은 형태.
export type DirectoryHandleLike = {
  name: string;
  values(): AsyncIterable<FileSystemHandleLike>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileHandleLike>;
  removeEntry?(name: string): Promise<void>;
  queryPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
};

export type FileSystemHandleLike = { kind: "file" | "directory"; name: string };

export type FileHandleLike = FileSystemHandleLike & {
  kind: "file";
  getFile(): Promise<Blob>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
};

export type StartLocation = "music" | "downloads" | "desktop" | "documents";

export function isFolderAccessSupported(win: object) {
  return typeof (win as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export function inputFolderFrom(handle: DirectoryHandleLike): InputFolder {
  return {
    name: handle.name,
    async listMp3() {
      const entries: Mp3Entry[] = [];
      for await (const child of handle.values()) {
        if (child.kind === "file" && /\.mp3$/i.test(child.name)) {
          const fileHandle = await handle.getFileHandle(child.name);
          entries.push({ name: child.name, getFile: () => fileHandle.getFile() });
        }
      }
      return entries.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    },
  };
}

export function outputFolderFrom(handle: DirectoryHandleLike): OutputFolder {
  return {
    name: handle.name,
    async has(fileName) {
      try {
        await handle.getFileHandle(fileName);
        return true;
      } catch {
        return false;
      }
    },
    async write(fileName, data) {
      const file = await handle.getFileHandle(fileName, { create: true });
      const writable = await file.createWritable();
      await writable.write(data);
      await writable.close();
    },
    async remove(fileName) {
      if (!handle.removeEntry) throw new Error("이 폴더에서는 파일을 삭제할 수 없습니다.");
      await handle.removeEntry(fileName);
    },
  };
}

export async function ensurePermission(
  handle: DirectoryHandleLike,
  mode: "read" | "readwrite",
): Promise<boolean> {
  if (!handle.queryPermission) return true;
  if ((await handle.queryPermission({ mode })) === "granted") return true;
  return (await handle.requestPermission?.({ mode })) === "granted";
}

export async function pickDirectory(
  win: {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
      startIn?: StartLocation;
    }) => Promise<DirectoryHandleLike>;
  },
  options: { mode: "read" | "readwrite"; startIn?: StartLocation },
): Promise<DirectoryHandleLike | null> {
  if (!win.showDirectoryPicker) return null;
  try {
    const handle = await win.showDirectoryPicker(options);
    return (await ensurePermission(handle, options.mode)) ? handle : null;
  } catch {
    return null;
  }
}
