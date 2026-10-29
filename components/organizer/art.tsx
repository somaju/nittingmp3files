"use client"

import { useMemo } from "react"

import { cn } from "@/lib/utils"
import type { Picture } from "@/lib/mp3-tags"

type Props = {
  picture?: Picture
  url?: string
  label: string
  className?: string
}

function toDataUrl(picture: Picture): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < picture.data.length; i += chunk) {
    binary += String.fromCharCode(...picture.data.subarray(i, i + chunk))
  }
  return `data:${picture.mime};base64,${btoa(binary)}`
}

export function Art({ picture, url, label, className }: Props) {
  const src = useMemo(() => (picture ? toDataUrl(picture) : url), [picture, url])
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${label} 앨범아트`} className="size-full object-cover" />
      ) : (
        <span aria-label="앨범아트 없음">♪</span>
      )}
    </div>
  )
}
