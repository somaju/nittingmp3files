"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  ensurePermission,
  inputFolderFrom,
  isFolderAccessSupported,
  outputFolderFrom,
  pickDirectory,
  type DirectoryHandleLike,
  type InputFolder,
  type Mp3Entry,
  type OutputFolder,
  type StartLocation,
} from "@/lib/folder-access"
import { readTags } from "@/lib/mp3-tags"
import {
  chooseCandidate,
  processSong,
  resolveConflicts,
  runOrganizer,
  saveManual,
  type SongOutcome,
  type SongRecord,
} from "@/lib/organizer"
import { apiSongDeps } from "@/lib/organizer/api-deps"
import type { SongCandidate } from "@/lib/song-sources"
import {
  createIdbStorage,
  describeSession,
  planResume,
  stripPicture,
  type SavedSession,
} from "@/lib/session-store"

import { FolderScreen } from "./folder-screen"
import { ProgressScreen } from "./progress-screen"
import { ResultsScreen } from "./results-screen"
import { ResumeDialog } from "./resume-dialog"
import type { DetailActions } from "./song-detail"

type Screen = "folder" | "progress" | "results"
type Picked<T> = { name: string; folder: T; handle: DirectoryHandleLike }
type InputPick = Picked<InputFolder> & { entries: Mp3Entry[] }
type PickerWindow = Parameters<typeof pickDirectory>[0]
type CandidateSelection = {
  candidates: SongCandidate[]
  fileName?: string
  outcome?: Extract<SongOutcome, { status: "ok" }>
}

const missingEntry = (name: string): Mp3Entry => ({
  name,
  getFile: async () => {
    throw new Error("file is missing")
  },
})

export function OrganizerApp() {
  const deps = useMemo(() => apiSongDeps(), [])
  const storage = useMemo(() => createIdbStorage(), [])
  // 서버에서는 알 수 없으므로 null, 브라우저에서는 폴더 접근 지원 여부를 바로 읽는다.
  const supported = useSyncExternalStore(
    () => () => {},
    () => isFolderAccessSupported(window),
    () => null
  )
  const [screen, setScreen] = useState<Screen>("folder")
  const [input, setInput] = useState<InputPick | null>(null)
  const [output, setOutput] = useState<Picked<OutputFolder> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [records, setRecords] = useState<SongRecord[]>([])
  const [candidateSelections, setCandidateSelections] = useState<Record<number, CandidateSelection>>({})
  const [processed, setProcessed] = useState<SongRecord[]>([])
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [saved, setSaved] = useState<SavedSession | null>(null)
  const [laterClicked, setLaterClicked] = useState(false)
  const [resumeMessage, setResumeMessage] = useState<string | null>(null)
  const outputRef = useRef<OutputFolder | null>(null)
  const sessionRef = useRef<SavedSession | null>(null)

  useEffect(() => {
    storage.load().then(setSaved).catch(() => {})
  }, [storage])

  function persist(next: SongRecord[]) {
    const session = sessionRef.current
    if (!session) return
    session.records = next.map((r) => ({ name: r.entry.name, outcome: stripPicture(r.outcome) }))
    if (describeSession(session).hasWork) {
      setSaved(session)
      storage.save(session).catch(() => {})
    } else {
      setSaved(null)
      storage.clear().catch(() => {})
    }
  }

  async function pickInput(startIn?: StartLocation) {
    setMessage(null)
    const handle = await pickDirectory(window as unknown as PickerWindow, { mode: "read", startIn })
    if (!handle) return setMessage("폴더를 고르지 않았거나 접근을 허용하지 않았습니다.")
    const folder = inputFolderFrom(handle)
    const entries = await folder.listMp3()
    setInput({ name: handle.name, folder, handle, entries })
    if (entries.length === 0) setMessage("이 폴더에는 mp3 파일이 없습니다. 다른 폴더를 고르세요.")
  }

  async function pickOutput(startIn?: StartLocation) {
    setMessage(null)
    const handle = await pickDirectory(window as unknown as PickerWindow, {
      mode: "readwrite",
      startIn,
    })
    if (!handle) return setMessage("폴더를 고르지 않았거나 쓰기를 허용하지 않았습니다.")
    const same = await (input?.handle as { isSameEntry?: (o: unknown) => Promise<boolean> } | undefined)
      ?.isSameEntry?.(handle)
    if (same) return setMessage("저장할 폴더는 정리할 폴더와 달라야 합니다. 다른 폴더를 고르세요.")
    setOutput({ name: handle.name, folder: outputFolderFrom(handle), handle })
  }

  async function runBatch(entries: Mp3Entry[], out: OutputFolder, base: SongRecord[], all: number) {
    const acc = [...base]
    setTotal(all)
    setProcessed(acc)
    setCurrent(null)
    setFinished(false)
    setScreen("progress")
    await runOrganizer({
      entries,
      output: out,
      deps,
      onStart: (name) => setCurrent(name),
      onDone: (record) => {
        acc.push(record)
        setProcessed([...acc])
        persist(acc)
      },
    })
    persist(acc)
    setRecords(acc)
    setFinished(true)
  }

  async function start() {
    if (!input || !output) return
    outputRef.current = output.folder
    setLaterClicked(true)
    setCandidateSelections({})
    sessionRef.current = {
      version: 1,
      input: { name: input.name, handle: input.handle },
      output: { name: output.name, handle: output.handle },
      entryNames: input.entries.map((e) => e.name),
      records: [],
    }
    persist([])
    storage.save(sessionRef.current).catch(() => {})
    await runBatch(input.entries, output.folder, [], input.entries.length)
  }

  // 저장해 둔 작업을 다시 연다. 폴더 접근 권한은 사용자가 누른 버튼 안에서 다시 요청한다.
  async function restore(mode: "continue" | "review") {
    if (!saved) return
    setResumeMessage(null)
    const okIn = await ensurePermission(saved.input.handle, "read")
    const okOut = await ensurePermission(saved.output.handle, "readwrite")
    if (!okIn || !okOut) {
      return setResumeMessage("폴더 접근을 허용해야 이어서 처리할 수 있습니다. 목록은 그대로 남아 있습니다.")
    }
    const inFolder = inputFolderFrom(saved.input.handle)
    const outFolder = outputFolderFrom(saved.output.handle)
    const entries = await inFolder.listMp3()
    const byName = new Map(entries.map((e) => [e.name, e]))

    const restored: SongRecord[] = []
    for (const r of saved.records) {
      let outcome = r.outcome
      if (outcome.status === "ok") {
        try {
          const file = await (await saved.output.handle.getFileHandle(outcome.fileName)).getFile()
          const { picture } = await readTags(file)
          if (picture) outcome = { ...outcome, picture }
        } catch {
          // 출력 파일을 읽지 못해도 기록은 그대로 보여 준다.
        }
      }
      restored.push({ entry: byName.get(r.name) ?? missingEntry(r.name), outcome })
    }

    setInput({ name: saved.input.name, folder: inFolder, handle: saved.input.handle, entries })
    setOutput({ name: saved.output.name, folder: outFolder, handle: saved.output.handle })
    outputRef.current = outFolder
    sessionRef.current = { ...saved, records: [...saved.records] }
    setLaterClicked(true)
    setCandidateSelections({})

    if (mode === "review") {
      setRecords(restored)
      setScreen("results")
      return
    }

    const plan = planResume(saved, entries.map((e) => e.name))
    const lost: SongRecord[] = plan.missing.map((name) => ({
      entry: missingEntry(name),
      outcome: { status: "failed", reason: "error" },
    }))
    await runBatch(
      plan.todo.map((n) => byName.get(n)!),
      outFolder,
      [...restored, ...lost],
      saved.entryNames.length
    )
  }

  function reset() {
    setScreen("folder")
    setInput(null)
    setOutput(null)
    setRecords([])
    setCandidateSelections({})
    setProcessed([])
    setFinished(false)
    setMessage(null)
    setLaterClicked(true)
  }

  function actionsFor(index: number, setNotice: (text: string | null) => void): DetailActions {
    const out = outputRef.current
    const apply = (outcome: SongOutcome, persistResult = true) => {
      const next = records.map((r, i) => (i === index ? { ...r, outcome } : r))
      setRecords(next)
      if (persistResult) persist(next)
      setNotice(
        outcome.status === "ok" ? `${outcome.fileName} 을(를) 저장할 폴더에 저장했습니다.` : null
      )
    }
    const entry = records[index]?.entry
    const selection = candidateSelections[index]
    return {
      choose: async (candidate) => {
        if (!out) return
        const current = records[index]?.outcome
        const candidates =
          current?.status === "review" && current.kind === "candidates"
            ? current.candidates
            : selection?.candidates
        const outcome = await chooseCandidate(entry, out, deps, candidate, selection?.fileName)
        if (outcome.status === "ok" && candidates) {
          setCandidateSelections((all) => ({
            ...all,
            [index]: { candidates, fileName: outcome.fileName, outcome },
          }))
        } else if (outcome.status === "review" && outcome.kind === "conflict" && candidates) {
          setCandidateSelections((all) => ({
            ...all,
            [index]: { ...(selection ?? {}), candidates },
          }))
        } else if (selection?.outcome) {
          apply(selection.outcome)
          setNotice(
            outcome.status === "skipped"
              ? "이미 같은 이름의 파일이 있어 기존 선택을 유지했습니다."
              : "새 후보를 적용하지 못해 기존 선택을 유지했습니다."
          )
          return
        }
        apply(outcome, !(selection?.fileName && outcome.status === "review"))
      },
      resolve: async (candidate, choices) => {
        if (!out) return
        const outcome = await resolveConflicts(
          entry,
          out,
          deps,
          candidate,
          choices,
          selection?.fileName
        )
        if (outcome.status === "ok" && selection) {
          setCandidateSelections((all) => ({
            ...all,
            [index]: { ...selection, fileName: outcome.fileName, outcome },
          }))
        } else if (selection?.outcome && outcome.status !== "ok") {
          apply(selection.outcome)
          setNotice(
            outcome.status === "skipped"
              ? "이미 같은 이름의 파일이 있어 기존 선택을 유지했습니다."
              : "새 후보를 적용하지 못해 기존 선택을 유지했습니다."
          )
          return
        }
        apply(outcome, !(selection?.fileName && outcome.status === "review"))
      },
      retry: async (hint) => {
        if (out) apply(await processSong(entry, out, deps, hint))
      },
      save: async (values, artworkUrl) => {
        if (!out) return false
        const previous = records[index]?.outcome
        const outcome = await saveManual(
          entry,
          out,
          deps,
          values,
          artworkUrl,
          previous?.status === "ok" ? previous.fileName : undefined
        )
        if (previous?.status === "ok" && outcome.status !== "ok") {
          setNotice(
            outcome.status === "skipped"
              ? "같은 이름의 파일이 이미 있어 기존 결과를 유지했습니다."
              : "편집 내용을 저장하지 못해 기존 결과를 유지했습니다."
          )
          return false
        }
        apply(outcome)
        return outcome.status === "ok"
      },
      ...(selection
        ? {
            reselect: async () => {
              const next = records.map((record, i) =>
                i === index
                  ? {
                      ...record,
                      outcome: {
                        status: "review" as const,
                        kind: "candidates" as const,
                        candidates: selection.candidates,
                      },
                    }
                  : record
              )
              setRecords(next)
              setNotice(null)
            },
          }
        : {}),
    }
  }

  const summary = saved ? describeSession(saved) : null

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">MP3 정리</h1>
          <p className="mt-1 text-muted-foreground">
            {screen === "folder" &&
              "폴더를 고르면 파일 이름과 태그를 정리해 새 폴더에 저장합니다. 원본 파일은 그대로 남습니다."}
            {screen === "progress" && "변환하는 중입니다. 원본 파일은 바뀌지 않습니다."}
            {screen === "results" && `결과는 “${output?.name}” 폴더에 저장됩니다.`}
          </p>
        </div>
        {screen === "results" && (
          <Button variant="outline" onClick={reset} data-testid="restart">
            다른 폴더 정리
          </Button>
        )}
      </header>

      {screen === "folder" && (
        <FolderScreen
          supported={supported}
          input={input && { name: input.name, mp3Count: input.entries.length }}
          output={output && { name: output.name }}
          message={message}
          onPickInput={pickInput}
          onPickOutput={pickOutput}
          onStart={start}
        />
      )}
      {screen === "progress" && output && (
        <ProgressScreen
          total={total}
          processed={processed}
          current={current}
          outputName={output.name}
          finished={finished}
          onShowResults={() => setScreen("results")}
        />
      )}
      {screen === "results" && <ResultsScreen records={records} actionsFor={actionsFor} />}

      <ResumeDialog
        open={screen === "folder" && !laterClicked && Boolean(summary?.hasWork)}
        summary={summary}
        message={resumeMessage}
        onContinue={() => restore("continue")}
        onReview={() => restore("review")}
        onLater={() => setLaterClicked(true)}
      />
    </div>
  )
}
