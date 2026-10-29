"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { StartLocation } from "@/lib/folder-access"

export type ChosenFolder = { name: string; mp3Count?: number }

const LOCATIONS: { key: StartLocation; label: string }[] = [
  { key: "music", label: "음악" },
  { key: "downloads", label: "다운로드" },
  { key: "desktop", label: "바탕화면" },
]

type Props = {
  supported: boolean | null
  input: ChosenFolder | null
  output: ChosenFolder | null
  message: string | null
  onPickInput: (startIn?: StartLocation) => void
  onPickOutput: (startIn?: StartLocation) => void
  onStart: () => void
}

function Picker({
  title,
  description,
  chosen,
  onPick,
  idPrefix,
}: {
  title: string
  description: string
  chosen: ChosenFolder | null
  onPick: (startIn?: StartLocation) => void
  idPrefix: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={`${title} 시작 위치`}>
          {LOCATIONS.map((l) => (
            <Button
              key={l.key}
              variant="outline"
              data-testid={`${idPrefix}-${l.key}`}
              onClick={() => onPick(l.key)}
            >
              {l.label} 폴더에서 열기
            </Button>
          ))}
          <Button variant="ghost" data-testid={`${idPrefix}-any`} onClick={() => onPick()}>
            다른 위치에서 선택…
          </Button>
        </div>
        <p className="text-sm text-muted-foreground" data-testid={`${idPrefix}-chosen`}>
          {chosen ? (
            <>
              선택한 폴더: <span className="font-medium text-foreground">{chosen.name}</span>
              {chosen.mp3Count !== undefined && (
                <Badge variant="secondary" className="ml-2">
                  mp3 {chosen.mp3Count}개
                </Badge>
              )}
            </>
          ) : (
            "아직 고르지 않았습니다."
          )}
        </p>
      </CardContent>
    </Card>
  )
}

export function FolderScreen({
  supported,
  input,
  output,
  message,
  onPickInput,
  onPickOutput,
  onStart,
}: Props) {
  const ready = Boolean(input && (input.mp3Count ?? 0) > 0 && output)

  if (supported === false) {
    return (
      <Alert variant="destructive" data-testid="unsupported">
        <AlertTitle>이 브라우저에서는 사용할 수 없습니다</AlertTitle>
        <AlertDescription>
          폴더를 직접 읽고 쓰는 기능이 필요합니다. 컴퓨터에서 Chrome이나 Edge로 다시 접속해 주세요.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Picker
        idPrefix="input"
        title="정리할 폴더"
        description="mp3가 들어 있는 폴더를 고르세요. 이 폴더의 파일은 바뀌지 않습니다."
        chosen={input}
        onPick={onPickInput}
      />
      <Picker
        idPrefix="output"
        title="저장할 폴더"
        description="정리된 파일이 만들어질 폴더입니다. 같은 이름의 파일이 이미 있으면 그 곡은 건너뜁니다. 쓰기 권한을 허용해야 합니다."
        chosen={output}
        onPick={onPickOutput}
      />
      {message && (
        <Alert variant="destructive" data-testid="folder-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {ready ? "준비되었습니다. 원본은 그대로 남습니다." : "정리할 폴더와 저장할 폴더를 고르면 시작할 수 있습니다."}
        </span>
        <Button disabled={!ready} onClick={onStart} data-testid="start">
          변환 시작
        </Button>
      </div>
    </div>
  )
}
