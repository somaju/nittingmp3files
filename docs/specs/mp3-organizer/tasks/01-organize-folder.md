# 01 — 폴더를 골라 정리하고 결과 폴더 만들기

## Outcome

사용자가 웹서비스에 접속해 브라우저의 폴더 선택창으로 입력 폴더와 출력 폴더를 고르고 "변환 시작"을 누르면, 브라우저가 폴더 안의 mp3를 읽고 곡을 찾아 파일명과 태그를 바꿔 출력 폴더에 쓴다. 진행 상황이 보이고, 끝나면 완료 팝업이 뜬다. 앱이 확정하지 못한 곡은 출력 폴더에 만들지 않고 건너뛰며, 그 곡 수만 세어 알린다.

## Blockers

None.

## Acceptance criteria

- [ ] 정리할 폴더를 고르기 전에는 "변환 시작"을 누를 수 없다.
- [ ] 시작 위치(음악, 다운로드, 바탕화면)를 한 번 눌러 브라우저의 폴더 선택창을 그 위치에서 열 수 있고, 입력 폴더와 출력 폴더를 고를 수 있다. 고른 입력 폴더에 mp3가 없으면 알리고 시작할 수 없다.
- [ ] 출력 폴더를 고르면 쓰기 권한을 허용하도록 안내하고, 허용하지 않으면 변환을 시작할 수 없다.
- [ ] Chromium 계열이 아닌 브라우저에서 접속하면 지원하지 않는 브라우저임을 알리고 Chrome이나 Edge를 쓰도록 안내한다.
- [ ] 입력 폴더의 어떤 파일도 변환 중이나 변환 후에 수정, 삭제, 이동되지 않는다.
- [ ] 음원 파일이 서버로 전송되거나 서버에 저장되지 않는다. 서버로 가는 요청에는 곡 정보 검색어만 담긴다.
- [ ] 완료한 곡은 제목 태그가 `노래이름 - 가수이름`이고 파일명이 그 제목과 같은(`노래이름 - 가수이름.mp3`) 파일로 출력 폴더에 만들어진다. 가수 이름은 제목 안에 한 번만 들어간다. 운영체제가 허용하지 않는 문자는 안전한 문자로 바뀌거나 제거되고, 같은 이름이 이미 있으면 덮어쓰지 않고 그 곡은 건너뛴다.
- [ ] 완료한 곡에는 제목, 가수, 앨범, 장르, 출시년도, 앨범아트, 가사 중 찾은 정보가 태그로 들어간다. 가사는 시간 정보가 없는 일반 텍스트다.
- [ ] 기존 태그에 값이 있고 검색 결과와 같으면 그대로 두고, 비어 있으면 채우며, 값이 서로 다르면 쓰지 않고 그 곡을 확인 필요로 센다.
- [ ] 곡이 하나로 정해진 경우에만 자동으로 적용한다. 후보가 여러 개이거나 정해지지 않은 곡은 확인 필요로, 파일명이 깨졌거나 검색 결과가 없거나 가수를 찾지 못한 곡은 처리 못함으로 세고, 둘 다 출력 폴더에 만들지 않는다.
- [ ] 확인 필요나 처리 못함인 곡이 있어도 나머지 곡의 처리는 멈추지 않는다.
- [ ] 변환 중 처리한 곡 수와 전체 곡 수, 완료/확인 필요/처리 못함/남은 곡 수, 방금 처리한 곡이 갱신되어 보인다.
- [ ] 변환이 끝나면 "변환 완료" 팝업에 출력 폴더 이름과 완료, 확인 필요, 처리 못함의 곡 수가 보인다. 출력 폴더를 자동으로 열지 않는다.
- [ ] 약 100곡을 한 번에 처리할 수 있다.
- [ ] 곡 정보는 iTunes Search와 MusicBrainz에서, 가사는 LRCLIB에서 사용자에게 키나 계정을 요구하지 않고 가져온다. 장르, 출시년도, 앨범아트가 실제로 오는지, 브라우저에서 태그(앨범아트, 가사 포함)를 쓸 수 있는지 확인한 결과가 작업 기록에 남는다. 오지 않는 정보는 채우지 않는다.

## Constraints

- 웹서비스 배포, 음원 파일을 서버에 올리지 않는 방식, Chromium 계열 한정은 [app-delivery](../../../decisions/app-delivery.md)를 따른다. 서버는 화면 제공과 곡 정보 검색 요청 전달만 한다.
- 곡 정보 출처와 키를 요구하지 않는 조건은 [song-data-sources](../../../decisions/song-data-sources.md)를 따른다. 서비스가 허용하지 않는 방식으로 웹 페이지를 자동 조회하지 않는다.
- 화면은 [ui-composition](../../../decisions/ui-composition.md)을 따른다.
- 기준 화면은 [prototype.html](../prototype.html)의 "폴더 선택"과 "변환 진행" 화면과 "변환 완료" 상태다. 곡 데이터는 더미다. 프로토타입의 앱 안 폴더 탐색기 팝업과 추천 경로 목록은 이 배포 방식에서 만들 수 없으므로 가져오지 않고, 시작 위치 버튼과 브라우저의 폴더 선택창으로 대신한다. 프로토타입의 "출력 폴더 열기" 동작과 완료 후 출력 폴더 열림도 가져오지 않는다.
- 곡이 "하나로 정해졌다"고 보는 기준과 서비스별 담당 필드는 spec의 "보류"에 있는 임시 동작을 따른다.
- 처리 전 미리보기 단계와 변환 중 취소 버튼은 만들지 않는다.
- 변환 진행 상태와 처리하지 못한 목록을 브라우저를 닫아도 남게 저장하는 것은 이 작업의 범위가 아니다(작업 03).

## Verification

- 고정된 샘플 mp3와 기록된 서비스 응답으로 이름 변경, 태그 쓰기, 확인 필요와 처리 못함 분류를 확인하는 단위 테스트가 통과한다.
- 입력 폴더 파일의 내용 해시가 변환 전후로 같고 파일 목록도 같은지 확인하는 테스트가 통과한다.
- 같은 이름이 있을 때 건너뛰고 덮어쓰지 않는지, 허용되지 않는 문자가 바뀌는지 확인하는 테스트가 통과한다.
- 변환 중 서버로 가는 요청에 음원 파일 데이터가 없는지 확인하는 테스트가 통과한다.
- 폴더 선택부터 "변환 완료" 팝업까지를 확인하는 Playwright 시나리오가 통과한다. 폴더 선택창은 테스트에서 가짜 폴더로 대체한다.
- 실제 네트워크로 몇십 곡을 검색한 결과(필드별 도착 여부, 확정 비율)를 기록한다. 이 항목은 자동 테스트가 아니라 작업 기록으로 남긴다.

## Review checkpoint

One review pass after this task. 범위는 작업 01 전체이고, 위험은 원본 파일 보존, 출력 폴더에 쓸 때의 안전성(덮어쓰기, 번호 부여, 권한), 음원이 서버로 나가지 않는다는 보장, 외부 서비스의 응답 형식과 이용 규칙이다. 서비스 응답은 결정적 검사로 충분히 확인되지 않는다.

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
- Verification: 단위 테스트(식별, 서비스 응답 해석, 파일명, 태그 읽기와 쓰기, 처리 흐름, 100곡, 원본 바이트 보존)와 lint, tsc 통과. 앱 브라우저에서 가짜 폴더로 폴더 선택부터 완료 팝업까지 실행해 완료 1, 확인 필요 1, 처리 못함 2, 출력 파일 1개, 입력 폴더 불변, 서버 요청은 본문 없는 GET뿐임을 확인.
- Blocker: Playwright e2e는 이 환경의 샌드박스가 Chrome 실행을 막아 돌리지 못했다. iTunes Search의 장르, 출시일, 앨범아트 도착은 사용자가 "IU Good Day"로 확인했다. MusicBrainz와 Cover Art Archive의 응답, 한국 곡과 YouTube에서 받은 곡의 확정 비율은 아직 확인하지 못했다(서버가 외부 서비스에 접속할 수 없었다). Playwright e2e와 이 확인이 끝나야 completed로 바꾼다.
- Revision: 출력 폴더 기본값(입력 폴더 옆 새 폴더)은 브라우저에서 만들 수 없어 spec에서 제거하고 사용자가 직접 고르게 했다. 앱 안 폴더 탐색기는 만들지 않았다.
