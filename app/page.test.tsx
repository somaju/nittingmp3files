import { render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import Home from "@/app/page"

afterEach(() => vi.unstubAllGlobals())

test("홈 화면은 폴더를 고르기 전에는 변환을 시작할 수 없다", () => {
  vi.stubGlobal("showDirectoryPicker", vi.fn())
  render(<Home />)

  expect(screen.getByRole("heading", { level: 1, name: "MP3 정리" })).toBeInTheDocument()
  expect(screen.getByTestId("start")).toBeDisabled()
})

test("폴더 접근을 지원하지 않는 브라우저에서는 안내를 보여준다", async () => {
  render(<Home />)

  expect(await screen.findByTestId("unsupported")).toHaveTextContent("Chrome이나 Edge")
})
