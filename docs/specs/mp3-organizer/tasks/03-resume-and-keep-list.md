# 03 — 중단 후 이어서 처리하고 처리하지 못한 목록 유지하기

## Outcome

변환이 중간에 멈춰도 사용자가 다시 접속하면 멈춘 곳부터 이어서 처리할 수 있고, 처리하지 못한 목록이 브라우저를 닫아도 남는다. 접속했을 때 남은 것이 있으면 팝업이 알려 준다.

## Blockers

작업 01(변환 진행 상태를 저장할 변환 흐름)과 작업 02(처리하지 못한 곡 보기로 이동할 결과 확인 화면).

## Acceptance criteria

- [ ] 처리하지 못한 곡이 브라우저를 닫았다 다시 접속해도 목록에 남고, 사용자가 마무리한 곡만 사라진다.
- [ ] 변환이 중간에 멈추면(탭 닫기, 브라우저 종료, 컴퓨터 종료, 오류) 다시 접속했을 때 이미 끝낸 곡은 다시 처리하지 않고 멈춘 곡부터 이어서 처리한다. 이어서 처리해도 출력 폴더에 같은 곡의 파일이 중복으로 만들어지지 않는다.
- [ ] 이어서 처리할 때 브라우저가 폴더 접근 권한을 다시 요구하면 안내하고, 사용자가 허용하면 이어서 진행한다. 허용하지 않으면 진행하지 않고 목록은 그대로 남긴다.
- [ ] 접속했을 때 이어서 처리할 것이나 처리하지 못한 목록이 남아 있으면 팝업이 뜨고, 남은 곡 수와 "이어서 처리하기", "처리하지 못한 곡 보기", "나중에"가 보인다. 남은 것이 없으면 팝업이 뜨지 않는다.
- [ ] "이어서 처리하기"는 변환 진행 화면으로, "처리하지 못한 곡 보기"는 결과 확인 화면으로 이어진다. "나중에"는 팝업을 닫고 폴더 선택 화면을 보여 준다.
- [ ] 입력 폴더의 파일이 그 사이에 바뀌었거나 없어졌으면 이어서 처리할 때 해당 곡을 알리고 건너뛰며, 나머지 곡은 계속 처리한다.

## Constraints

- 변환 진행 상태와 처리하지 못한 목록은 임시로 브라우저 저장소에 저장한다(spec의 "보류"). 다른 브라우저나 기기에서는 이어지지 않으며, 브라우저 저장소가 지워지면 잃을 수 있다.
- 팝업의 문구와 버튼 배치는 프로토타입에 없으므로 [ui-composition](../../../decisions/ui-composition.md)에 맞춰 정한다.
- 폴더 접근 방식은 [app-delivery](../../../decisions/app-delivery.md)를 따른다. 서버에는 진행 상태나 음원을 저장하지 않는다.

## Verification

- 변환 도중 탭을 강제로 닫은 뒤 다시 열어 이어서 처리하는 통합 테스트가 통과한다(이미 끝낸 곡을 다시 처리하지 않고 출력 폴더에 중복 파일이 없는지 확인).
- 처리하지 못한 목록이 저장소에 남아 다시 접속했을 때 보이고, 마무리한 곡만 사라지는지 확인하는 테스트가 통과한다.
- 남은 것이 있을 때와 없을 때 팝업이 뜨는지, 각 버튼이 올바른 화면으로 이동하는지 확인하는 Playwright 시나리오가 통과한다.
- 폴더 권한을 허용하지 않았을 때와 입력 폴더의 파일이 사라졌을 때의 동작을 확인하는 테스트가 통과한다.

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
- Verification: 단위 테스트로 남은 곡 계산, 재개 계획, 저장 시 앨범아트 제외 확인. 앱 브라우저에서 브라우저 내부 저장소의 실제 폴더 핸들로, 변환을 중간에 끊고 다시 접속하자 팝업(남은 곡 2, 완료 1)이 뜨고 이어서 처리하면 남은 2곡만 검색해 3개 파일이 중복 없이 만들어짐, 모두 끝나면 저장 기록이 지워져 팝업이 다시 뜨지 않음, 처리하지 못한 곡 3개가 다시 접속해도 남고 "처리하지 못한 곡 보기"가 결과 화면으로 이어짐을 확인.
- Blocker: Playwright e2e를 돌리지 못했다. 폴더 권한을 거부한 경우와 입력 폴더에서 파일이 사라진 경우는 직접 실행해 보지 못했다. 쓰기 직후 중단 시 번호가 붙은 중복이 생길 수 있는 알려진 틈이 있다(docs/follow-ups/resume-duplicate-after-interrupted-write.md).
- Revision: —
