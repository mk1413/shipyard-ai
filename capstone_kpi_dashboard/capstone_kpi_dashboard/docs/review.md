# 리뷰
- 기준 커밋: 603fe42
- 테스트: 185 tests / 185 pass / 0 fail / 0 skipped
- 판정: 통과

## 지적
| # | 심각도 | 파일:줄 | 내용 | 근거 |
|---|---|---|---|---|
| 1 | 낮음 | src/routes/dashboard.js:10 | 계획 P4의 구현 파일 목록에는 라우트 변경이 있었으나 변경되지 않았다. `block` 파라미터는 `req.query`를 통째로 `buildDashboard`에 넘기는 기존 코드로만 동작한다. 명시적 파라미터 처리가 없으므로, 배열로 들어온 `block` 값은 목록에서 찾지 못해 `null`로 처리된다(동작은 안전함). | docs/plan.md P4 구현 파일 목록 |
| 2 | 낮음 | src/services/dashboard.js:134, views/dashboard.ejs:208 | 필터는 있으나 해당 블록이 DB에 없을 때(`B`가 빈 배열) 도넛은 5개 라벨이 0으로 그려지고, 진척률 막대는 빈 차트가 그려진다. 안내 문구가 없다. 기존 "데이터가 없습니다" 분기는 `processes` 빈 값일 때만 탭 2 전체를 숨긴다. | docs/plan.md P5 (데이터 없음 흐름), AC-07 흐름 |
| 3 | 낮음 | src/services/dashboard.js:134, src/charts/blocks.js:93 | 블록 상태 도넛과 호선·공정별 진척률 막대는 기간 필터를 적용하지 않는다(`blockRows`가 기간을 보지 않음). 블록 선택 목록에 대한 요구만 계획에 있었고, 도넛·막대의 기간 규칙은 계획 docs/plan.md에 적혀 있지 않다. 명세(stage2/spec.md 본문 미확인)와 일치하는지 확인이 필요하다. | docs/plan.md 위험과 가정 (명세 원문 미확인), FR-8 |

## 확인한 것
- 테스트 실행: `npm test` 1회 실행, 185개 전부 통과, 실패와 skip 0.
- 기존 테스트 변경 여부: `test/charts/blocks.test.js`는 import 줄에 새 함수 이름만 추가되었고, 기존 3개 테스트의 기대값과 조건은 그대로다. `test/routes/dashboard.test.js`는 require 한 줄 추가와 테스트 추가뿐이며 기존 테스트 변경이나 skip 추가는 없다.
- 새 공개 함수 테스트 (원칙 1): `ganttChart`, `statusDonutChart`, `progressBarChart`, `buildDashboard`의 블록 연결 모두 테스트가 있다. `ganttBars`는 기존 함수다.
- 블록 목록 필터: `blockRows(db, f)`는 `ships`와 `processes`만 쓰고 기간을 보지 않는다 (src/repo/queries.js:75-85). `blocks`는 `B`에서만 만들어지므로 기간 필터를 쓰지 않는다. 호선·공정 필터만 따른다. 테스트 "블록 선택 목록은 호선·공정 필터를 따르고 기간 필터는 적용하지 않는다"가 이를 확인한다.
- 간트 키 조건: `if (selectedRow) charts.gantt = ...` (src/services/dashboard.js:137) 이므로 선택이 없거나 목록에 없으면 `gantt` 키가 없다. 테스트가 `'gantt' in charts === false`를 확인한다. 뷰도 `data.charts.gantt`가 있을 때만 `#chart-gantt`를 그리고 아니면 안내 문구를 낸다 (views/dashboard.ejs:184-188).
- 원칙 3 (사번, 이름): diff는 로그인, 쿠키, 응답 경로를 건드리지 않는다. 새 로그나 응답 필드에 사번, 이름이 없다.
- 원칙 4 (한국어): 새 화면 문구는 "블록 선택 안 함", "간트 보기", "간트 블록", "블록을 선택하면 간트차트가 표시됩니다.", 차트 제목, 범례(계획, 실적), 상태 라벨(대기, 진행, 완료, 진행(지연), 완료(지연))이 모두 한국어다.
- 원칙 5 (외부 URL): `git diff 603fe42 | grep -E "https?://"` 결과가 없다. Plotly는 기존대로 `/vendor/plotly.min.js`에서 로드하고 (views/dashboard.ejs:113), 새 CDN 참조가 없다.
- 상태 라벨 일치: `src/domain/block-status.js`가 만드는 문자열(`대기`, `진행`, `완료`, `(지연)` 접미)이 도넛의 `STATUS_LABELS`와 같다. 대기(지연)은 나오지 않는다는 계획 가정과도 맞다.
- 진척률 평균: `progressBarChart`는 호선·공정 조합 안에서 `progress_pct`의 단순 평균 (`sum / cell.length`)을 쓴다 (src/charts/blocks.js:105). 계획의 "행별 단순 평균" 가정과 일치한다. 분모 0은 `cell.length === 0`일 때 건너뛰어 막는다. `progress_pct`는 스키마상 NOT NULL이다 (src/db/migrations/0001_init.up.sql:45).
- 범위: 변경 파일은 `src/charts/blocks.js`, `src/services/dashboard.js`, `test/charts/blocks.test.js`, `test/routes/dashboard.test.js`, `views/dashboard.ejs` 5개다. 모두 계획 P1~P5 범위 안이다. 라우트 파일은 바뀌지 않았다 (지적 1).
- 줄바꿈: git이 LF를 CRLF로 바꾼다는 경고가 나오지만, diff 통계(384 추가, 25 삭제)에 줄바꿈 전체 변경은 보이지 않는다. 리뷰 대상 아님.
- 명백한 버그: 발견하지 못했다. 분모 0, 빈 입력, 실적 종료일 null (기준일로 연장, AC-11), 실적 시작일 없음(실적 막대 없음)이 모두 처리되고 테스트가 있다.
