"use client"

import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ConflictChoices, FieldKey, ManualValues, SongOutcome, SongRecord } from "@/lib/organizer"
import { FAILURE_TEXT, FIELD_LABEL } from "@/lib/organizer/summary"
import { buildSearchQuery } from "@/lib/song-identity"
import type { SongCandidate } from "@/lib/song-sources"

import { Art } from "./art"
import { Player } from "./player"

export type DetailActions = {
  choose: (candidate: SongCandidate) => Promise<void>
  resolve: (candidate: SongCandidate, choices: ConflictChoices) => Promise<void>
  retry: (hint: { title?: string; artist?: string }) => Promise<void>
  save: (values: ManualValues, artworkUrl?: string) => Promise<boolean>
  reselect?: () => Promise<void>
}

type Props = { record: SongRecord; actions: DetailActions; notice: string | null; busy: boolean }

function Original({ name }: { name: string }) {
  return (
    <p className="text-xs break-all text-muted-foreground">
      원본 파일명 · <span className="font-mono">{name}</span>
    </p>
  )
}

export function SongDetail({ record, actions, notice, busy }: Props) {
  const { entry, outcome } = record
  return (
    <Card className="gap-4 p-5" data-testid="detail">
      {notice && (
        <Alert data-testid="notice">
          <AlertTitle>{notice}</AlertTitle>
        </Alert>
      )}
      <Body entry={entry} outcome={outcome} actions={actions} busy={busy} />
    </Card>
  )
}

function Body({
  entry,
  outcome,
  actions,
  busy,
}: {
  entry: SongRecord["entry"]
  outcome: SongOutcome
  actions: DetailActions
  busy: boolean
}) {
  if (outcome.status === "ok") {
    return <CompletedPanel entry={entry} outcome={outcome} actions={actions} busy={busy} />
  }

  if (outcome.status === "skipped") {
    return (
      <>
        <Alert data-testid="skipped">
          <AlertTitle>이미 같은 이름의 파일이 있어 건너뛰었습니다</AlertTitle>
          <AlertDescription>
            저장할 폴더에 “{outcome.fileName}”이(가) 이미 있어서 이 곡은 만들지 않았습니다. 원본 파일은 그대로입니다.
          </AlertDescription>
        </Alert>
        <Original name={entry.name} />
        <Player getFile={() => entry.getFile()} />
      </>
    )
  }

  if (outcome.status === "review") {
    return <ReviewPanel entry={entry} outcome={outcome} actions={actions} busy={busy} />
  }

  return <FailedPanel entry={entry} outcome={outcome} actions={actions} busy={busy} />
}

type ReviewOutcome = Extract<SongOutcome, { status: "review" }>

function CompletedPanel({
  entry,
  outcome,
  actions,
  busy,
}: {
  entry: SongRecord["entry"]
  outcome: Extract<SongOutcome, { status: "ok" }>
  actions: DetailActions
  busy: boolean
}) {
  const [editing, setEditing] = useState(false)
  const tags = outcome.tags
  const artist = tags.artist ?? ""
  const taggedTitle = tags.title ?? ""
  const initial: SongCandidate = {
    title: taggedTitle.endsWith(` - ${artist}`)
      ? taggedTitle.slice(0, -(` - ${artist}`).length)
      : taggedTitle,
    artist,
    album: tags.album,
    genre: tags.genre,
    year: tags.year,
    source: "itunes",
  }

  if (editing) {
    return (
      <ManualForm
        entry={entry}
        initial={initial}
        initialLyrics={tags.lyrics}
        busy={busy}
        onSave={actions.save}
        onSaved={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row">
        <Art
          picture={outcome.picture}
          label={outcome.fileName}
          className="size-40 text-5xl sm:size-52"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>완료</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setEditing(true)}
              data-testid="edit-mode"
            >
              직접 편집
            </Button>
            {actions.reselect && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => actions.reselect?.()}
              >
                후보 다시 선택
              </Button>
            )}
          </div>
          <h2 className="font-heading text-xl font-semibold break-words" data-testid="detail-name">
            {outcome.fileName}
          </h2>
          <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5">
            {(["title", "artist", "album", "genre", "year"] as FieldKey[]).map((f) => (
              <div key={f} className="contents">
                <dt className="text-muted-foreground">{FIELD_LABEL[f]}</dt>
                <dd className="break-words">{tags[f] ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <Original name={entry.name} />
        </div>
      </div>
      <Player getFile={() => entry.getFile()} />
      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">가사</p>
        <div
          className="max-h-44 overflow-y-auto rounded-lg border bg-muted p-3 leading-7 whitespace-pre-line"
          data-testid="lyrics"
        >
          {tags.lyrics ?? "찾은 가사가 없습니다."}
        </div>
      </div>
    </>
  )
}

function ReviewPanel({
  entry,
  outcome,
  actions,
  busy,
}: {
  entry: SongRecord["entry"]
  outcome: ReviewOutcome
  actions: DetailActions
  busy: boolean
}) {
  const [editing, setEditing] = useState(false)
  const base = outcome.kind === "candidates" ? outcome.candidates[0] : outcome.candidate
  if (editing) {
    return (
      <ManualForm
        entry={entry}
        initial={base}
        busy={busy}
        onSave={actions.save}
        onCancel={() => setEditing(false)}
      />
    )
  }
  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {actions.reselect && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => actions.reselect?.()}
          >
            후보 목록으로 돌아가기
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="edit-mode">
          직접 편집
        </Button>
      </div>
      {outcome.kind === "candidates" ? (
        <CandidatesView entry={entry} candidates={outcome.candidates} actions={actions} busy={busy} />
      ) : (
        <ConflictForm
          entry={entry}
          candidate={outcome.candidate}
          conflicts={outcome.conflicts}
          actions={actions}
          busy={busy}
        />
      )}
    </>
  )
}

function CandidatesView({
  entry,
  candidates,
  actions,
  busy,
}: {
  entry: SongRecord["entry"]
  candidates: SongCandidate[]
  actions: DetailActions
  busy: boolean
}) {
return (
    <>
      <Alert>
        <AlertTitle>어떤 곡인가요?</AlertTitle>
        <AlertDescription>
          후보가 여러 개라서 확신할 수 없습니다. 하나를 고르면 이 곡만 저장할 폴더에 만들어집니다.
        </AlertDescription>
      </Alert>
      <Original name={entry.name} />
      <Player getFile={() => entry.getFile()} />
      <div className="flex flex-col gap-2" data-testid="candidates">
        {candidates.map((c) => (
          <div key={`${c.title}|${c.artist}|${c.album}`} className="flex items-center gap-3 rounded-lg border p-2.5">
            <Art url={c.artworkUrl} label={c.title} className="size-10" />
            <div className="min-w-0 flex-1">
              <b className="block truncate font-medium">
                {c.title} - {c.artist}.mp3
              </b>
              <span className="text-xs text-muted-foreground">
                {[c.album, c.genre, c.year].filter(Boolean).join(" · ")}
              </span>
            </div>
            <Button size="sm" disabled={busy} onClick={() => actions.choose(c)}>
              이 곡으로 정리
            </Button>
          </div>
        ))}
      </div>
      <RetryField
        actions={actions}
        busy={busy}
        wantsArtist={false}
        heading="맞는 곡이 없습니다. 제목이나 가수를 입력해 다시 검색"
      />
    </>
  )
}

function ManualForm({
  entry,
  initial,
  initialLyrics,
  busy,
  onSave,
  onSaved,
  onCancel,
}: {
  entry: SongRecord["entry"]
  initial: SongCandidate
  initialLyrics?: string
  busy: boolean
  onSave: DetailActions["save"]
  onSaved?: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [artist, setArtist] = useState(initial.artist)
  const [album, setAlbum] = useState(initial.album ?? "")
  const [genre, setGenre] = useState(initial.genre ?? "")
  const [year, setYear] = useState(initial.year ? String(initial.year) : "")
  const [lyrics, setLyrics] = useState(initialLyrics ?? "")
  const valid = title.trim() !== "" && artist.trim() !== ""
  const fields: [string, string, (v: string) => void, string][] = [
    ["제목", title, setTitle, "edit-title"],
    ["가수", artist, setArtist, "edit-artist"],
    ["앨범", album, setAlbum, "edit-album"],
    ["장르", genre, setGenre, "edit-genre"],
    ["출시년도", year, setYear, "edit-year"],
  ]
  return (
    <>
      <Alert>
        <AlertTitle>직접 편집</AlertTitle>
        <AlertDescription>
          입력한 값 그대로 파일명과 태그를 만듭니다. 제목과 가수는 꼭 있어야 합니다. 앨범아트는 파일에 있으면 그것을, 없으면 처음 후보의 것을 씁니다.
        </AlertDescription>
      </Alert>
      <Original name={entry.name} />
      <Player getFile={() => entry.getFile()} />
      <div className="grid gap-3 sm:grid-cols-2" data-testid="manual-form">
        {fields.map(([label, value, set, id]) => (
          <div key={id} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium">
              {label}
            </label>
            <Input
              id={id}
              value={value}
              inputMode={id === "edit-year" ? "numeric" : undefined}
              onChange={(e) => set(e.target.value)}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="edit-lyrics" className="text-sm font-medium">
            가사 (비워 두면 파일에 있는 가사나 찾은 가사를 씁니다)
          </label>
          <textarea
            id="edit-lyrics"
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="manual-preview">
        저장할 파일명: {valid ? `${title.trim()} - ${artist.trim()}.mp3` : "제목과 가수를 입력하세요"}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          편집 취소
        </Button>
        <Button
          disabled={!valid || busy}
          data-testid="manual-save"
          onClick={async () => {
            const saved = await onSave(
              {
                title,
                artist,
                album,
                genre,
                year: Number(year) || undefined,
                lyrics,
              },
              initial.artworkUrl
            )
            if (saved) onSaved?.()
          }}
        >
          이대로 저장
        </Button>
      </div>
    </>
  )
}

function FailedPanel({
  entry,
  outcome,
  actions,
  busy,
}: {
  entry: SongRecord["entry"]
  outcome: Extract<SongOutcome, { status: "failed" }>
  actions: DetailActions
  busy: boolean
}) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    // 파일명에서 읽은 제목과 가수를 처음 값으로 채운다. 깨진 파일명은 비워 둔다.
    const guess = outcome.reason === "garbled" ? undefined : buildSearchQuery({ fileName: entry.name }).guesses[0]
    const initial: SongCandidate = {
      title: outcome.title ?? guess?.title ?? "",
      artist: guess?.artist ?? "",
      source: "itunes",
    }
    return (
      <ManualForm
        entry={entry}
        initial={initial}
        busy={busy}
        onSave={actions.save}
        onCancel={() => setEditing(false)}
      />
    )
  }
  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="edit-mode">
          직접 편집
        </Button>
      </div>
      <FailedForm entry={entry} outcome={outcome} actions={actions} busy={busy} />
    </>
  )
}

function ConflictForm({
  entry,
  candidate,
  conflicts,
  actions,
  busy,
}: {
  entry: SongRecord["entry"]
  candidate: SongCandidate
  conflicts: Extract<SongOutcome, { kind: "conflict" }>["conflicts"]
  actions: DetailActions
  busy: boolean
}) {
  const [choices, setChoices] = useState<ConflictChoices>({})
  const ready = conflicts.every((c) => choices[c.field])
  return (
    <>
      <Alert>
        <AlertTitle>어느 값을 쓸까요?</AlertTitle>
        <AlertDescription>
          기존 태그와 검색 결과가 서로 다른 항목입니다. 항목마다 쓸 값을 고르세요. 비어 있던 항목은 자동으로 채워집니다.
        </AlertDescription>
      </Alert>
      <Original name={entry.name} />
      <Player getFile={() => entry.getFile()} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>항목</TableHead>
            <TableHead>기존 태그</TableHead>
            <TableHead>검색 결과</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conflicts.map((c) => (
            <TableRow key={c.field}>
              <TableCell>{FIELD_LABEL[c.field]}</TableCell>
              {(["existing", "found"] as const).map((side) => (
                <TableCell key={side}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`conflict-${c.field}`}
                      checked={choices[c.field] === side}
                      onChange={() => setChoices((prev) => ({ ...prev, [c.field]: side }))}
                    />
                    {side === "existing" ? c.existing : c.found}
                  </label>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {ready ? "선택을 마쳤습니다." : "다른 항목을 모두 고르면 적용할 수 있습니다."}
        </span>
        <Button disabled={!ready || busy} onClick={() => actions.resolve(candidate, choices)}>
          선택한 값으로 정리
        </Button>
      </div>
    </>
  )
}

function RetryField({
  actions,
  busy,
  wantsArtist,
  knownTitle,
  heading,
  note,
}: {
  actions: DetailActions
  busy: boolean
  wantsArtist: boolean
  knownTitle?: string
  heading?: string
  note?: string
}) {
  const [text, setText] = useState("")
  const submit = () => {
    const value = text.trim()
    if (!value) return
    if (wantsArtist) void actions.retry({ title: knownTitle, artist: value })
    else {
      const parts = value.split(/\s+[-–—]\s+/)
      void actions.retry(
        parts.length >= 2
          ? { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() }
          : { title: value }
      )
    }
  }
  return (
    <div className="flex flex-col gap-1.5" data-testid="retry">
      <label htmlFor="retry-input" className="text-sm font-medium">
        {heading ?? (wantsArtist ? "가수 입력" : "제목 입력")}
      </label>
      <div className="flex gap-2">
        <Input
          id="retry-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={wantsArtist ? "예: 가수 이름" : "예: 노래 제목 또는 가수 - 제목"}
        />
        <Button disabled={busy || !text.trim()} onClick={submit}>
          {wantsArtist ? "적용" : "다시 검색"}
        </Button>
      </div>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  )
}

function FailedForm({
  entry,
  outcome,
  actions,
  busy,
}: {
  entry: SongRecord["entry"]
  outcome: Extract<SongOutcome, { status: "failed" }>
  actions: DetailActions
  busy: boolean
}) {
  const wantsArtist = outcome.reason === "no-artist"
  return (
    <>
      <Alert variant="destructive">
        <AlertTitle>처리하지 못했습니다</AlertTitle>
        <AlertDescription>{FAILURE_TEXT[outcome.reason]}</AlertDescription>
      </Alert>
      <Original name={entry.name} />
      <Player getFile={() => entry.getFile()} />
      <RetryField
        actions={actions}
        busy={busy}
        wantsArtist={wantsArtist}
        knownTitle={outcome.title}
        note="입력하지 않으면 이 곡은 건너뛰고 처리하지 못한 목록에 남습니다."
      />
    </>
  )
}
