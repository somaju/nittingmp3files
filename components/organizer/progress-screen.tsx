"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import type { SongRecord } from "@/lib/organizer"
import { countRecords } from "@/lib/organizer/summary"

type Props = {
  total: number
  processed: SongRecord[]
  current: string | null
  outputName: string
  finished: boolean
  onShowResults: () => void
}

function label(record: SongRecord) {
  const o = record.outcome
  return o.status === "ok" || o.status === "skipped" ? o.fileName : record.entry.name
}

function StatusBadge({ record }: { record: SongRecord }) {
  const s = record.outcome.status
  if (s === "ok") return <Badge>완료</Badge>
  if (s === "skipped") return <Badge variant="secondary">이미 있음</Badge>
  if (s === "review") return <Badge variant="outline">확인 필요</Badge>
  return <Badge variant="destructive">처리 못함</Badge>
}

export function ProgressScreen({ total, processed, current, outputName, finished, onShowResults }: Props) {
  const counts = countRecords(processed)
  const left = total - processed.length
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b data-testid="progress-count">
              {processed.length} / {total}곡
            </b>
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {finished ? "모두 확인했습니다" : current ? `분석: ${current}` : "시작하는 중…"}
            </span>
          </div>
          <Progress value={processed.length} max={Math.max(total, 1)} aria-label="변환 진행률" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              ["완료", counts.ok],
              ["확인 필요", counts.need],
              ["처리 못함", counts.fail],
              ["남음", left],
            ].map(([name, n]) => (
              <div key={name} className="rounded-lg border p-3">
                <b className="block text-2xl font-semibold tabular-nums">{n}</b>
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>방금 처리한 곡</CardTitle>
          <CardDescription>원본 파일은 건드리지 않습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {processed.slice(-5).reverse().map((record, i) => (
              <li key={`${record.entry.name}-${i}`} className="flex items-center gap-2.5 py-2">
                <span className="min-w-0 flex-1 truncate" title={record.entry.name}>
                  {label(record)}
                </span>
                <StatusBadge record={record} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={finished}>
        <DialogContent data-testid="done-dialog">
          <DialogHeader>
            <DialogTitle>변환 완료</DialogTitle>
            <DialogDescription>
              {total}곡을 확인했습니다. 결과는 “{outputName}” 폴더에 저장했습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Badge>완료 {counts.ok}</Badge>
            <Badge variant="outline">확인 필요 {counts.need}</Badge>
            <Badge variant="destructive">처리 못함 {counts.fail}</Badge>
          </div>
          {counts.need + counts.fail > 0 && (
            <p className="text-sm text-muted-foreground">
              확인 필요한 곡과 처리하지 못한 곡은 저장할 폴더에 아직 만들어지지 않았습니다. 결과 확인에서 마무리하세요.
            </p>
          )}
          <DialogFooter>
            <Button onClick={onShowResults} data-testid="show-results">
              결과 확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
