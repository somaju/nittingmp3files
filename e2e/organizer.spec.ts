import { expect, test, type Page } from "@playwright/test";

// 브라우저의 폴더 선택창은 자동화할 수 없어서, 같은 인터페이스를 가진 가짜 폴더를 주입한다.
async function installFakeFolders(page: Page, inputFiles: string[]) {
  await page.addInitScript((names) => {
    const frame = new Uint8Array(417).fill(0);
    frame.set([0xff, 0xfb, 0x90, 0x00]);
    const mp3 = () => {
      const bytes = new Uint8Array(417 * 20);
      for (let i = 0; i < 20; i++) bytes.set(frame, i * 417);
      return bytes;
    };
    const store: Record<string, Map<string, Uint8Array>> = {
      입력: new Map(names.map((n: string) => [n, mp3()])),
      정리됨: new Map(),
    };
    const original = new Map([...store["입력"]].map(([k, v]) => [k, v.slice()]));
    const dir = (name: string) => ({
      kind: "directory",
      name,
      async *values() {
        for (const n of store[name].keys()) yield { kind: "file", name: n };
      },
      async getFileHandle(fileName: string, options?: { create?: boolean }) {
        if (!store[name].has(fileName)) {
          if (!options?.create) throw new DOMException("not found", "NotFoundError");
          store[name].set(fileName, new Uint8Array());
        }
        return {
          kind: "file",
          name: fileName,
          getFile: async () => new File([store[name].get(fileName)! as BlobPart], fileName),
          createWritable: async () => ({
            write: async (data: Blob) => {
              store[name].set(fileName, new Uint8Array(await data.arrayBuffer()));
            },
            close: async () => {},
          }),
        };
      },
      async removeEntry(fileName: string) {
        if (!store[name].delete(fileName)) throw new DOMException("not found", "NotFoundError");
      },
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      isSameEntry: async (other: { name: string }) => other.name === name,
    });
    let calls = 0;
    (window as unknown as Record<string, unknown>).showDirectoryPicker = async () =>
      dir(calls++ === 0 ? "입력" : "정리됨");
    (window as unknown as Record<string, unknown>).__fake = {
      outputNames: () => [...store["정리됨"].keys()].sort(),
      inputUnchanged: () =>
        [...original].every(([k, v]) => {
          const now = store["입력"].get(k);
          return now && now.length === v.length && now.every((b, i) => b === v[i]);
        }) && store["입력"].size === original.size,
    };
  }, inputFiles);
}

const candidate = (over: Record<string, unknown>) => ({
  title: "푸른 새벽",
  artist: "하늘고래",
  album: "새벽의 지도",
  genre: "인디 팝",
  year: 2021,
  source: "itunes",
  ...over,
});

async function mockSongApi(page: Page, requests: string[]) {
  await page.route("**/api/songs/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${route.request().method()} ${url.pathname} body=${route.request().postData() ?? ""}`);
    if (url.pathname.endsWith("/search")) {
      const q = url.searchParams.get("q") ?? "";
      const source = url.searchParams.get("source");
      let candidates: unknown[] = [];
      if (q.includes("푸른 새벽")) candidates = [candidate({})];
      else if (q.includes("소금 호수") && q.includes("파도소리")) {
        candidates =
          source === "itunes"
            ? [
                candidate({ title: "소금 호수 (Live)", artist: "파도소리", album: "Live at Hangang", year: 2021 }),
                candidate({ title: "소금 호수 (Remastered)", artist: "파도소리", album: "소금 호수", year: 2019 }),
              ]
            : [];
      } else if (q.includes("달빛정원")) {
        candidates = [candidate({ title: "밤의 끝에서", artist: "달빛정원", album: "Garden Hours", year: 2018 })];
      }
      return route.fulfill({ json: { candidates } });
    }
    if (url.pathname.endsWith("/lyrics")) {
      return route.fulfill({ json: { lyrics: { plain: "첫 줄\n둘째 줄" } } });
    }
    return route.fulfill({ status: 404 });
  });
}

test("폴더를 골라 정리하고 결과를 확인하고 처리하지 못한 곡을 마무리한다", async ({ page }) => {
  const requests: string[] = [];
  await installFakeFolders(page, [
    "하늘고래 - 푸른 새벽 (Official MV) [4K].mp3",
    "소금 호수 - 파도소리.mp3",
    "í•˜ëŠ˜ê³ ëž˜_ìƒˆë²½_07.mp3",
    "my_recording_final_v3 (copy).mp3",
  ]);
  await mockSongApi(page, requests);
  await page.goto("/");

  await expect(page.getByTestId("start")).toBeDisabled();
  await page.getByTestId("input-music").click();
  await expect(page.getByTestId("input-chosen")).toContainText("입력");
  await expect(page.getByTestId("input-chosen")).toContainText("mp3 4개");
  await page.getByTestId("output-downloads").click();
  await expect(page.getByTestId("output-chosen")).toContainText("정리됨");
  await expect(page.getByTestId("start")).toBeEnabled();

  await page.getByTestId("start").click();
  const dialog = page.getByTestId("done-dialog");
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog).toContainText("완료 1");
  await expect(dialog).toContainText("확인 필요 1");
  await expect(dialog).toContainText("처리 못함 2");
  await expect(dialog).toContainText("정리됨");

  const fake = () => page.evaluate(() => (window as never as { __fake: { outputNames(): string[]; inputUnchanged(): boolean } }).__fake);
  expect(await page.evaluate(() => (window as never as { __fake: { outputNames(): string[] } }).__fake.outputNames())).toEqual([
    "푸른 새벽 - 하늘고래.mp3",
  ]);
  expect(await page.evaluate(() => (window as never as { __fake: { inputUnchanged(): boolean } }).__fake.inputUnchanged())).toBe(true);
  void fake;

  await page.getByTestId("show-results").click();
  await expect(page.getByRole("tab", { name: "전체 4" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "완료 1" })).toBeVisible();

  // 완료한 곡의 상세
  await page.getByTestId("song-row").filter({ hasText: "푸른 새벽 - 하늘고래.mp3" }).click();
  await expect(page.getByTestId("detail-name")).toHaveText("푸른 새벽 - 하늘고래.mp3");
  await expect(page.getByTestId("lyrics")).toContainText("첫 줄");
  await page.getByTestId("edit-mode").click();
  await page.getByLabel("제목", { exact: true }).fill("푸른 새벽 편집");
  await page.getByLabel("앨범", { exact: true }).fill("새 앨범");
  await page.getByTestId("manual-save").click();
  await expect(page.getByTestId("detail-name")).toHaveText("푸른 새벽 편집 - 하늘고래.mp3");
  expect(await page.evaluate(() => (window as never as { __fake: { outputNames(): string[] } }).__fake.outputNames())).toContain(
    "푸른 새벽 편집 - 하늘고래.mp3",
  );
  expect(await page.evaluate(() => (window as never as { __fake: { outputNames(): string[] } }).__fake.outputNames())).not.toContain(
    "푸른 새벽 - 하늘고래.mp3",
  );

  // 후보 선택
  await page.getByRole("tab", { name: "확인 필요 1" }).click();
  await page.getByTestId("song-row").first().click();
  await expect(page.getByTestId("candidates")).toBeVisible();
  await page.getByRole("button", { name: "이 곡으로 정리" }).first().click();
  await expect(page.getByTestId("notice")).toContainText("저장했습니다");
  await expect
    .poll(() => page.evaluate(() => (window as never as { __fake: { outputNames(): string[] } }).__fake.outputNames().length))
    .toBe(2);

  await page.getByRole("button", { name: "후보 다시 선택" }).click();
  await expect(page.getByTestId("candidates")).toBeVisible();
  await page.getByRole("button", { name: "이 곡으로 정리" }).last().click();
  await expect(page.getByTestId("notice")).toContainText("저장했습니다");
  await expect
    .poll(() => page.evaluate(() => (window as never as { __fake: { outputNames(): string[] } }).__fake.outputNames().sort()))
    .toEqual(["소금 호수 (Remastered) - 파도소리.mp3", "푸른 새벽 편집 - 하늘고래.mp3"]);

  // 처리 못함: 제목 입력 후 다시 검색
  await page.getByRole("tab", { name: "처리 못함 2" }).click();
  await page.getByTestId("song-row").first().click();
  await expect(page.getByTestId("detail")).toContainText("파일명이 깨져");
  await page.getByLabel("제목 입력").fill("달빛정원 - 밤의 끝에서");
  await page.getByRole("button", { name: "다시 검색" }).click();
  await expect(page.getByTestId("notice")).toContainText("밤의 끝에서 - 달빛정원.mp3");
  expect(await page.evaluate(() => (window as never as { __fake: { outputNames(): string[] } }).__fake.outputNames())).toContain(
    "밤의 끝에서 - 달빛정원.mp3",
  );
  expect(await page.evaluate(() => (window as never as { __fake: { inputUnchanged(): boolean } }).__fake.inputUnchanged())).toBe(true);

  // 서버로 가는 요청은 GET이고 본문(음원)이 없다
  expect(requests.length).toBeGreaterThan(0);
  for (const r of requests) {
    expect(r).toMatch(/^GET \/api\/songs\//);
    expect(r).toMatch(/body=$/);
  }
});

test("폴더 접근을 지원하지 않는 브라우저에서는 안내한다", async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  });
  await page.goto("/");
  await expect(page.getByTestId("unsupported")).toContainText("Chrome이나 Edge");
});

// 저장된 작업은 IndexedDB에 폴더 핸들째로 들어가므로, 복제할 수 있는 진짜 핸들(브라우저 내부 저장소)로 확인한다.
test("변환이 중간에 멈추면 다시 접속했을 때 멈춘 곳부터 이어서 처리한다", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    if (w.__opfsReady) return;
    w.__opfsReady = true;
    const frame = new Uint8Array(417);
    frame.set([0xff, 0xfb, 0x90, 0x00]);
    const mp3 = new Uint8Array(417 * 20);
    for (let i = 0; i < 20; i++) mp3.set(frame, i * 417);
    w.__prepare = async () => {
      const root = await navigator.storage.getDirectory();
      for (const name of ["in", "out"]) await root.removeEntry(name, { recursive: true }).catch(() => {});
      const input = await root.getDirectoryHandle("in", { create: true });
      await root.getDirectoryHandle("out", { create: true });
      for (const n of ["하늘고래 - 푸른 새벽 (1).mp3", "하늘고래 - 푸른 새벽 (2).mp3", "하늘고래 - 푸른 새벽 (3).mp3"]) {
        const h = await input.getFileHandle(n, { create: true });
        const wr = await h.createWritable();
        await wr.write(mp3);
        await wr.close();
      }
    };
    let calls = 0;
    w.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle(calls++ === 0 ? "in" : "out");
    };
  });
  let searches = 0;
  await page.route("**/api/songs/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/search")) {
      searches++;
      if (searches === 2) await new Promise((r) => setTimeout(r, 60_000)); // 두 번째 곡에서 멈춘 것처럼 둔다
      return route.fulfill({ json: { candidates: [candidate({})] } });
    }
    return route.fulfill({ json: { lyrics: null } });
  });
  await page.goto("/");
  await page.evaluate(() => (window as never as { __prepare(): Promise<void> }).__prepare());
  await page.getByTestId("input-music").click();
  await page.getByTestId("output-downloads").click();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("progress-count")).toContainText("1 / 3");

  // 다시 접속한다
  await page.unroute("**/api/songs/**");
  await mockSongApi(page, []);
  await page.reload();
  const dialog = page.getByTestId("resume-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("남은 곡 2");
  await page.getByTestId("resume-continue").click();
  await expect(page.getByTestId("done-dialog")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("done-dialog")).toContainText("3곡");
});
