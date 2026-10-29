"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

// 사용자 브라우저가 파일을 읽어 재생한다. 음원은 서버로 보내지 않는다.
export function Player({ getFile }: { getFile: () => Promise<Blob> }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const objectUrl = useRef<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)

  useEffect(
    () => () => {
      audio.current?.pause()
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    },
    []
  )

  async function toggle() {
    if (!audio.current) {
      const url = URL.createObjectURL(await getFile())
      objectUrl.current = url
      const element = new Audio(url)
      element.addEventListener("timeupdate", () =>
        setPosition(element.duration ? (element.currentTime / element.duration) * 100 : 0)
      )
      element.addEventListener("ended", () => setPlaying(false))
      audio.current = element
    }
    if (audio.current.paused) {
      try {
        await audio.current.play()
        setPlaying(true)
      } catch {
        setPlaying(false)
      }
    } else {
      audio.current.pause()
      setPlaying(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        size="icon-lg"
        className="rounded-full"
        onClick={toggle}
        aria-label={playing ? "일시정지" : "재생"}
        data-testid="play"
      >
        {playing ? "❚❚" : "▶"}
      </Button>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary" style={{ width: `${position}%` }} />
      </div>
    </div>
  )
}
