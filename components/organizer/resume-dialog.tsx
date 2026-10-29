"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { describeSession } from "@/lib/session-store"

type Summary = ReturnType<typeof describeSession>

type Props = {
  open: boolean
  summary: Summary | null
  message: string | null
  onContinue: () => void
  onReview: () => void
  onLater: () => void
}

export function ResumeDialog({ open, summary, message, onContinue, onReview, onLater }: Props) {
  if (!summary) return null
  const unresolved = summary.need + summary.fail
  return (
    <Dialog open={open}>
      <DialogContent data-testid="resume-dialog">
        <DialogHeader>
          <DialogTitle>이어서 할 일이 있습니다</DialogTitle>
          <DialogDescription>
            지난번 작업이 남아 있습니다. 이 브라우저에 저장된 기록이며 음원은 서버에 올라가지 않았습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {summary.remaining > 0 && <Badge variant="secondary">남은 곡 {summary.remaining}</Badge>}
          {unresolved > 0 && <Badge variant="destructive">처리하지 못한 곡 {unresolved}</Badge>}
          <Badge>완료 {summary.ok}</Badge>
        </div>
        {message && (
          <p className="text-sm text-destructive" data-testid="resume-message">
            {message}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onLater} data-testid="resume-later">
            나중에
          </Button>
          {unresolved > 0 && (
            <Button variant="outline" onClick={onReview} data-testid="resume-review">
              처리하지 못한 곡 보기
            </Button>
          )}
          {summary.remaining > 0 && (
            <Button onClick={onContinue} data-testid="resume-continue">
              이어서 처리하기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
