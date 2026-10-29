# 02 — 결과를 확인하고 확인 필요·처리 못함 곡 마무리하기

## Outcome

사용자가 결과 확인 화면에서 곡별 결과(앨범아트, 파일명, 태그, 가사)를 보고 재생해 볼 수 있다. 앱이 확정하지 못한 곡(확인 필요, 처리 못함)은 사용자가 후보를 고르거나 값을 입력해 마무리하고, 마무리한 곡은 출력 폴더에 만들어진다.

## Blockers

작업 01. 결과를 보여 줄 완료된 곡과 확정하지 못한 곡의 상태, 출력 폴더에 곡을 쓰는 동작이 먼저 있어야 한다.

## Acceptance criteria

- [ ] 곡 목록을 전체/완료/확인 필요/처리 못함으로 거를 수 있고 각 분류의 곡 수가 보이며, 각 곡 행에 앨범아트, 새 파일명, 상태가 보인다.
- [ ] 완료한 곡의 상세에 앨범아트, 파일명, 태그(제목, 가수, 앨범, 장르, 출시년도), 원본 파일명, 재생 버튼, 가사가 보인다. 재생은 사용자의 브라우저에서 파일을 읽어 재생하며 음원이 서버로 전송되지 않는다.
- [ ] 후보가 여러 개인 확인 필요 곡은 후보를 나란히 보여 주고, 하나를 고르면 그 곡만 출력 폴더에 만들어지고 완료로 바뀐다.
- [ ] 태그가 서로 다른 확인 필요 곡은 기존 값과 검색 값을 항목별로 보여 주고, 다른 항목을 모두 고른 뒤에만 적용할 수 있다. 비어 있던 항목은 자동으로 채워져 보인다.
- [ ] 확인 필요 곡과 처리 못함 곡에는 "직접 편집" 모드가 있어서 제목, 가수, 앨범, 장르, 출시년도, 가사를 고치고 저장하면 입력한 값 그대로 출력 폴더에 만들어진다. 제목과 가수가 비어 있으면 저장할 수 없다.
- [ ] 처리 못함 곡은 이유를 설명하고 재생할 수 있다. 파일명이 깨졌거나 검색 결과가 없으면 제목을, 가수를 찾지 못했으면 가수를 입력해 다시 시도하고, 결과에 따라 완료나 확인 필요가 된다.
- [ ] 입력하지 않으면 그 곡은 출력 폴더에 만들어지지 않고 처리 못함으로 남는다.
- [ ] 확인 필요이거나 처리 못함인 곡은 사용자가 마무리하기 전까지 출력 폴더에 만들어지지 않는다.
- [ ] "다른 폴더 정리"로 폴더 선택 화면으로 돌아갈 수 있다.
- [ ] 좁은 화면에서는 목록과 상세가 위아래로 쌓이고 곡을 고르면 상세로 이동하며 가로 스크롤이 생기지 않는다. 밝은 테마와 어두운 테마가 모두 동작한다.

## Constraints

- 기준 화면은 [prototype.html](../prototype.html)의 "결과 확인" 화면이다. 곡 목록, 필터, 후보 선택, 태그 충돌 표, 처리 못함 입력, 재생, 좁은 화면 배치를 가져온다. 곡 데이터와 가사는 더미다. 프로토타입의 "출력 폴더 열기" 버튼은 브라우저가 파일 관리자를 열 수 없으므로 가져오지 않는다.
- 화면 구성은 [ui-composition](../../../decisions/ui-composition.md)을 따른다.
- 다시 검색과 후보 조회는 [song-data-sources](../../../decisions/song-data-sources.md)를 따른다.
- 음원은 서버로 보내지 않는다([app-delivery](../../../decisions/app-delivery.md)).

## Verification

- 곡 목록 거르기, 상세 표시, 후보 선택, 태그 충돌 선택(모두 고르기 전에는 적용 불가), 입력과 재검색을 확인하는 구성요소 테스트가 통과한다.
- 확인 필요(후보), 확인 필요(태그 충돌), 처리 못함 각각을 마무리하는 Playwright 시나리오가 통과한다.
- 마무리하지 않은 곡이 출력 폴더에 만들어지지 않고 마무리한 곡만 만들어지는지 확인하는 테스트가 통과한다.
- 좁은 화면과 두 테마에서 가로 스크롤이 없는지 확인하는 테스트가 통과한다.

## Review checkpoint

None.

## Status

<!-- Current values: `pending`, `in-progress`, `completed`, `blocked`, or
`superseded`.
`completed` is valid only while all acceptance criteria and focused
verification pass. Use `superseded` only after an approved replacement of a
task with recorded completion history. Preserve its Execution evidence and name
the replacement and reason under Revision; it is then terminal for that approved
breakdown and outside the current delivery map. -->
in-progress

## Execution

<!-- Append concise evidence and preserve earlier entries when status changes.
Execution Blocker is the current impediment for an active task, not a declared
task dependency. In a superseded task, preserved entries are historical. -->
- Verification: 앱 브라우저에서 필터와 개수, 완료 곡 상세(파일명, 가사), 후보 선택, 처리 못함 제목 입력 후 재검색, 좁은 화면(375)과 어두운 토큰에서 가로 넘침 없음을 확인. 단위 테스트로 집계와 입력 해석 확인. 태그 충돌 선택 흐름은 처리 로직 단위 테스트로 확인.
- Blocker: Playwright e2e를 이 환경에서 돌리지 못했다. 태그 충돌 선택 화면과 가수 입력(no-artist) 화면은 앱 브라우저에서 직접 눌러 보지 못했다.
- Revision: —
