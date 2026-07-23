# iHerb 1913 Naver EP 차단 설계

## 목표

2026-07-20 네이버에서 `취급 불가 > 불법 및 온라인판매금지`로 적발된
`iherb-1913` 상품을 현재 공개 Naver EP와 이후 자동 생성되는 Naver EP에서 제외한다.

## 범위

- Naver EP 생성기의 정확한 상품 ID 차단 목록에 `iherb-1913`을 추가한다.
- EP 행 생성 테스트에 적발 상품 회귀 사례를 추가한다.
- 현재 공개 산출물 `ep.txt`에서 `iherb-1913` 행을 제거한다.
- Meta 및 Google 피드는 이번 요청 범위에 포함하지 않는다.

## 설계

`/Users/chance/DEV/imweb/src/app/api/tools/generate-naver-ep/blocklist.ts`가 생성기와
배포 전 검사기가 함께 사용하는 단일 차단 원본이다. 이 집합에 정확한 상품 ID를
추가하면 제목이나 카테고리가 바뀌어도 같은 상품은 계속 제외된다. 광범위한
`당살초` 키워드 차단은 요청되지 않은 다른 상품까지 제외할 수 있어 추가하지 않는다.

현재 GitHub Pages에 제공되는 `/Users/chance/DEV/imweb-naver-ep/ep.txt`에서는 해당
행을 즉시 제거한다. 이후 자동 생성 시에도 중앙 차단 목록과 배포 전 검사가 재노출을
방지한다.

## 테스트 및 검증

1. 차단 목록 변경 전, `buildNaverEpRow`가 `null`이어야 한다는 테스트가 실제 행을
   반환하여 실패하는지 확인한다.
2. 차단 목록 변경 후 같은 테스트가 `null`을 반환하는지 확인한다.
3. Naver EP 관련 테스트와 `lint-naver-ep.ts`를 실행한다.
4. 공개 `ep.txt`의 첫 번째 TSV 열에 정확히 `iherb-1913`인 행이 없는지 확인한다.
   부분 문자열 검색은 정상 ID `iherb-19133`을 오탐할 수 있으므로 사용하지 않는다.
5. 먼저 `imweb`의 중앙 차단 목록과 테스트를 반영한 다음 `imweb-naver-ep`의 현재
   산출물을 제거하여 게시한다.
6. GitHub Pages 실URL에서도 첫 번째 TSV 열이 `iherb-1913`인 행이 없는지 확인한다.
