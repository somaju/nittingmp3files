# Song data sources

## Decisions

- 곡 확정과 앨범명, 장르, 출시년도, 앨범아트는 iTunes Search와 MusicBrainz에서 얻고, 가사는 LRCLIB에서 얻는다.
- 사용자에게 API 키, 토큰, 계정을 요구하지 않는다. 키 없이 쓸 수 있는 서비스만 쓴다.
- 서비스가 허용하지 않는 방식으로 웹 페이지를 자동 조회하지 않는다.

## Boundaries

- 서비스마다 어떤 필드를 맡기고 어떤 순서로 쓰는지는 이 계약이 정하지 않는다.
- 이 결정은 곡 정보의 출처를 정한다. 곡이 "하나로 정해졌다"고 보는 기준은 정하지 않는다.

## Why

사용자는 혼자 쓰는 앱에 설정을 요구하는 것을 원하지 않는다. 구글 검색은 공식 API가 키를 요구하고, 검색 결과 페이지는 robots.txt가 자동 조회를 허용하지 않아 키 없이 허용된 방법으로 쓸 수 없다. 위 세 서비스는 키 없이 응답하고 공식 응답 형식이 있어 검색 결과 페이지에서 정보를 뽑는 것보다 정확하고 약관상 안전하다.

## Reconsider when

- 선택한 서비스가 키를 요구하거나 키 없는 호출을 막을 때
- 실제 곡 몇십 곡으로 확인했을 때 한국 곡이나 YouTube에서 받은 곡의 확정 비율이 낮아 사용자 수작업이 크게 늘 때
- 사용자가 설정이나 키 입력을 받아들이게 될 때

## Still-rejected alternatives

- 구글 검색 — 공식 API는 키가 필요하고(403), 검색 결과 페이지는 `Disallow: /search`로 자동 조회가 허용되지 않는다. 키 없는 허용된 방법이 생기면 다시 검토한다.
- Discogs, 멜론뮤직, Apple Music 직접 사용 — 키나 인증이 필요하거나 공식 공개 접근 방법을 확인하지 못했다.
- Deezer — 같은 질의("IU Good Day")에서 다른 곡을 먼저 돌려주었다. 결과 순서가 개선되면 다시 검토한다.

## Evidence worth preserving

- 구글 공식 검색 API를 키 없이 호출하면 403 PERMISSION_DENIED("Method doesn't allow unregistered callers")가 돌아온다.
- 구글 robots.txt에 `Disallow: /search`가 있다.
- 질의 "IU Good Day"에서 LRCLIB는 제목, 가수, 앨범, 일반 텍스트 가사를, iTunes Search는 가수, 앨범, 제목을, MusicBrainz는 점수 100의 일치 결과를 키 없이 돌려주었다.
