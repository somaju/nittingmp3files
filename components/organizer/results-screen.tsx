"use client"

import { useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SongOutcome, SongRecord } from "@/lib/organizer"
import { countRecords, filterRecords, type SongFilter } from "@/lib/organizer/summary"

import { Art } from "./art"
import { SongDetail, type DetailActions } from "./song-detail"

type Props = {
  records: SongRecord[]
  actionsFor: (index: number, setNotice: (text: string | null) => void) => DetailActions
}

function rowTitle(record: SongRecord) {
  const o = record.outcome
  return o.status === "ok" || o.status === "skipped" ? o.fileName : record.entry.name
}

function rowSub(outcome: SongOutcome) {
  if (outcome.status === "ok") {
    return [outcome.tags.album, outcome.tags.genre, outcome.tags.year].filter(Boolean).join(" · ")
  }
  if (outcome.status === "skipped") return "같은 이름이 있어 건너뜀"
  if (outcome.status === "review") {
    return outcome.kind === "candidates" ? "후보를 골라 주세요" : "태그 값을 골라 주세요"
  }
  return "처리하지 못했습니다"
}

function StatusBadge({ outcome }: { outcome: SongOutcome }) {
  if (outcome.status === "ok") return <Badge>완료</Badge>
  if (outcome.status === "skipped") return <Badge variant="secondary">이미 있음</Badge>
  if (outcome.status === "review") return <Badge variant="outline">확인 필요</Badge>
  return <Badge variant="destructive">처리 못함</Badge>
}

export function ResultsScreen({ records, actionsFor }: Props) {
  const [filter, setFilter] = useState<SongFilter>("all")
  const [selected, setSelected] = useState(0)
  const [notices, setNotices] = useState<Record<number, string | null>>({})
  const [busy, setBusy] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)
  const counts = countRecords(records)
  const rows = filterRecords(records, filter)
  const current = records[selected]

  const base = actionsFor(selected, (text) => setNotices((n) => ({ ...n, [selected]: text })))
  const wrap = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      setBusy(true)
      try {
        return await fn(...args)
      } finally {
        setBusy(false)
      }
    }
  const actions: DetailActions = {
    choose: wrap(base.choose),
    resolve: wrap(base.resolve),
    retry: wrap(base.retry),
    save: wrap(base.save),
    ...(base.reselect ? { reselect: wrap(base.reselect) } : {}),
  }

  return (
    <div className="grid items-start gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <Card className="gap-2 p-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as SongFilter)}>
          <TabsList>
            <TabsTrigger value="all">전체 {counts.all}</TabsTrigger>
            <TabsTrigger value="ok">완료 {counts.ok}</TabsTrigger>
            <TabsTrigger value="need">확인 필요 {counts.need}</TabsTrigger>
            <TabsTrigger value="fail">처리 못함 {counts.fail}</TabsTrigger>
          </TabsList>
        </Tabs>
        <ul className="flex max-h-[40rem] flex-col overflow-y-auto" role="listbox" aria-label="곡 목록">
          {rows.length === 0 && (
            <li className="p-8 text-center text-muted-foreground">이 분류에는 곡이 없습니다.</li>
          )}
          {rows.map(({ record, index }) => (
            <li key={`${record.entry.name}-${index}`}>
              <button
                role="option"
                aria-selected={index === selected}
                data-testid="song-row"
                onClick={() => {
                  setSelected(index)
                  detailRef.current?.scrollIntoView({ block: "start" })
                }}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted aria-selected:bg-muted"
              >
                <Art
                  picture={record.outcome.status === "ok" ? record.outcome.picture : undefined}
                  label={rowTitle(record)}
                  className="size-10"
                />
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-medium">{rowTitle(record)}</b>
                  <span className="block truncate text-xs text-muted-foreground">{rowSub(record.outcome)}</span>
                </span>
                <StatusBadge outcome={record.outcome} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <div ref={detailRef} className="min-w-0">
        {current && (
          <SongDetail
            key={`${selected}-${current.outcome.status}`}
            record={current}
            actions={actions}
            notice={notices[selected] ?? null}
            busy={busy}
          />
        )}
      </div>
    </div>
  )
}
