import type { DirectoryHandleLike } from "@/lib/folder-access"
import type { SongOutcome } from "@/lib/organizer"

export type SavedRecord = { name: string; outcome: SongOutcome }

export type SavedSession = {
  version: 1
  input: { name: string; handle: DirectoryHandleLike }
  output: { name: string; handle: DirectoryHandleLike }
  entryNames: string[]
  records: SavedRecord[]
}

export interface SessionStorage {
  load(): Promise<SavedSession | null>
  save(session: SavedSession): Promise<void>
  clear(): Promise<void>
}

// 앨범아트 바이트는 저장하지 않는다. 다시 열 때 출력 폴더의 파일에서 읽는다.
export function stripPicture(outcome: SongOutcome): SongOutcome {
  if (outcome.status !== "ok") return outcome
  const { picture: _picture, ...rest } = outcome
  void _picture
  return rest
}

export function describeSession(session: SavedSession) {
  const status = (s: SongOutcome["status"]) =>
    session.records.filter((r) => r.outcome.status === s).length
  const remaining = session.entryNames.length - session.records.length
  const need = status("review")
  const fail = status("failed")
  return {
    total: session.entryNames.length,
    done: session.records.length,
    remaining: Math.max(remaining, 0),
    ok: status("ok") + status("skipped"),
    need,
    fail,
    hasWork: remaining > 0 || need + fail > 0,
  }
}

// 이어서 처리할 곡과, 입력 폴더에서 사라진 곡을 나눈다.
export function planResume(session: SavedSession, currentNames: string[]) {
  const done = new Set(session.records.map((r) => r.name))
  const present = new Set(currentNames)
  const pending = session.entryNames.filter((n) => !done.has(n))
  return {
    todo: pending.filter((n) => present.has(n)),
    missing: pending.filter((n) => !present.has(n)),
  }
}

const DB = "mp3-organizer"
const STORE = "kv"
const KEY = "session"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// 진행 상태와 처리하지 못한 목록은 이 브라우저의 저장소에만 둔다. 서버에는 보내지 않는다.
export function createIdbStorage(): SessionStorage {
  return {
    async load() {
      if (typeof indexedDB === "undefined") return null
      const value = await withStore<SavedSession | undefined>("readonly", (s) => s.get(KEY))
      return value?.version === 1 ? value : null
    },
    async save(session) {
      if (typeof indexedDB === "undefined") return
      await withStore("readwrite", (s) => s.put(session, KEY))
    },
    async clear() {
      if (typeof indexedDB === "undefined") return
      await withStore("readwrite", (s) => s.delete(KEY))
    },
  }
}
