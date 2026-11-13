# 계획: 탭 2 블록 공정진척 (T035, T036, T037)
- 기준: `.specify/specs/kpi-dashboard-stage2/spec.md`, `.specify/specs/kpi-dashboard-stage2/tasks.md` (T035~T037, Phase 4), `.specify/specs/kpi-dashboard/spec.md` (FR-8, AC-11, AC-12), `.specify/specs/kpi-dashboard/plan.md` (FR-8 매핑)
- 현재 상태 (저장소 확인):
  - `src/charts/blocks.js`: `ganttBars(row, today)` 있음. `test/charts/blocks.test.js`에 AC-11 테스트 3개 있음 (계획 막대, 실적 막대 기준일 끝, 완료 막대).
  - `src/repo/queries.js`: `blockRows`, `topDelayed` 있음. `test/repo/top10.test.js`로 AC-12 확인됨 (T033, T034 완료).
  - `src/domain/block-status.js`: 상태 문자열은 `대기`, `진행`, `완료`, 지연이면 뒤에 `(지연)` (예: `진행(지연)`, `완료(지연)`).
  - `src/services/dashboard.js`: `buildDashboard`가 `top`, `charts` (production, equipment, quality 차트)를 만든다. 블록 차트는 없다.
  - `views/dashboard.ejs`: 탭 구조 없이 한 페이지에 KPI, 생산, 설비, 품질, 지연 TOP 10 표, 원본 표가 있다. 블록 탭 섹션은 없다.
- 범위 밖: 탭 전환 UI 전체 (T028), 탭 3 설비·탭 4 품질 화면 (T047~T051), 간트 블록 목록의 검색 기능 (T052~T056), 실데이터 연동, 2단계 명세 개정 (T001, T062)

## 작업 목록

### P1. 간트 차트 설정 (ganttChart)
- 근거: FR-8 (3번 블록 간트차트), AC-11, T035, T036
- 테스트 파일: `test/charts/blocks.test.js` (기존 파일에 추가, 기존 3개 테스트는 그대로 둔다)
- 테스트가 확인할 것:
  1. 계획 막대는 회색, 실적 막대는 파란색 트레이스로 나오고, 실적 종료일이 null이면 기준일 `2026-10-31`까지 그린다.
  2. 기준일 세로선 shape가 `2026-10-31` 위치에 하나 있다.
  3. 실적 시작일이 없으면 실적 트레이스가 없다.
- 구현 파일: `src/charts/blocks.js` (`ganttChart(row, today)` 추가, `ganttBars` 재사용, 출력은 Plotly `{data, layout}` 형식)
- 선행 작업: 없음
- 완료 기준: `npm test`에서 `test/charts/blocks.test.js`의 간트 테스트가 통과

### P2. 상태 도넛 (statusDonutChart)
- 근거: FR-8 (1번 상태 도넛), T035, T036
- 테스트 파일: `test/charts/blocks.test.js` (P1과 같은 파일에 추가)
- 테스트가 확인할 것:
  1. 라벨은 `대기`, `진행`, `완료`, `진행(지연)`, `완료(지연)` 5개 순서로 고정되고, 해당 건수가 0이어도 라벨이 빠지지 않는다.
  2. 건수 합계는 입력 행 수와 같다.
  3. 입력 행의 `status` 값을 그대로 세며, 알 수 없는 상태 문자열은 세지 않는다 (합계 검사에서 드러나게 한다).
- 구현 파일: `src/charts/blocks.js` (`statusDonutChart(rows)` 추가, Plotly pie 트레이스에 `hole` 설정)
- 선행 작업: 없음 (P1과 독립, 같은 파일이라 순서대로 진행)
- 완료 기준: `npm test`에서 도넛 테스트 통과

### P3. 호선·공정별 평균 진척률 막대 (progressBarChart)
- 근거: FR-8 (2번 호선·공정별 평균 진척률), T036
- 테스트 파일: `test/charts/blocks.test.js` (같은 파일에 추가)
- 테스트가 확인할 것:
  1. 호선마다 공정별 `progress_pct` 평균을 구한다 (행별 평균, 가중 평균 아님). 예: 같은 호선·공정 행 2개의 평균.
  2. 공정 순서는 `src/config.js`의 `PROCESSES` 순서로 고정된다 (`절단 → 탑재`).
  3. 데이터가 없는 호선·공정 조합은 막대를 만들지 않는다 (0으로 채우지 않는다).
- 구현 파일: `src/charts/blocks.js` (`progressBarChart(rows)` 추가, 묶음 막대 트레이스를 공정별로 만든다)
- 선행 작업: 없음 (P1, P2와 독립)
- 완료 기준: `npm test`에서 진척률 막대 테스트 통과

### P4. 탭 2 데이터 연결 (services와 라우트)
- 근거: FR-8 전체, FR-8 (3번) 블록 선택 목록은 호선·공정 필터를 따른다, AC-12, T037
- 테스트 파일: `test/routes/dashboard.test.js` (기존 파일에 추가). 필요하면 `test/charts/blocks.test.js`에 서비스 함수 테스트를 추가한다.
- 테스트가 확인할 것:
  1. `buildDashboard` 결과의 `charts`에 `blockDonut`, `blockProgress`, `gantt`(선택 블록이 있을 때) 키가 있다.
  2. 블록 선택 목록은 호선·공정 필터에 맞는 블록만 담고, 기간 필터는 적용되지 않는다.
  3. 선택한 블록이 없으면 간트 차트 키는 없고 안내 문구용 값이 된다.
- 구현 파일: `src/services/dashboard.js` (charts에 블록 차트 3종 추가, 블록 목록을 `blocks` 키로 추가), `src/routes/dashboard.js` (간트 블록 선택 파라미터 받기, 이름은 `block`으로 제안)
- 선행 작업: P1, P2, P3
- 완료 기준: `npm test`에서 라우트·서비스 테스트 통과, 기존 AC-13 필터 테스트 유지

### P5. 탭 2 화면 연결 (views/dashboard.ejs)
- 근거: FR-8 전체, AC-11 (화면 확인), AC-12 (표 확인), T037
- 테스트 파일: `test/routes/dashboard.test.js` (기존 파일에 추가)
- 테스트가 확인할 것:
  1. 응답 HTML에 탭 2 섹션(`data-tab="blocks"`)이 있고, 도넛, 호선·공정 막대, 간트 영역, 지연 TOP 10 표(`top-row` 행 수 최대 10)가 들어 있다.
  2. 데이터가 없으면 탭 2 섹션 대신 기존 안내 문구가 나온다 (AC-07 흐름 유지).
  3. 블록 선택 목록의 `<select>` 옵션이 현재 호선·공정 필터를 따른다.
- 구현 파일: `views/dashboard.ejs` (탭 2 섹션 추가, Plotly `newPlot` 스크립트 3개, 지연 TOP 10 표를 탭 2 안으로 옮긴다)
- 선행 작업: P4. 그리고 탭 전환 방식이 정해져야 한다 (아래 위험 참고).
- 완료 기준: `npm test`에서 라우트 화면 테스트 통과, 로컬 서버에서 탭 2 화면을 수동 확인 (T037 완료 조건)

## 위험과 가정
- 탭 구조 미정: 지금 `views/dashboard.ejs`에는 탭이 없다. `tasks.md`의 T037은 `views/tabs/blocks.ejs`를 말하고, 요청은 `views/dashboard.ejs` 안의 탭 2 섹션을 말한다. 이번 계획은 요청대로 `views/dashboard.ejs` 안에 섹션을 둔다고 가정한다. 탭 전환 UI(T028)는 아직 미완료라 P5는 섹션을 보여 주는 수준까지만 한다. 탭 전환이 필요하면 T028 완료 뒤에 맞춘다.
- 상태 5종: `blockStatus`는 시작 전 행에 지연을 0으로 두므로 `대기(지연)`은 나오지 않는다. 도넛은 5종 라벨을 그대로 두되 `대기(지연)`은 항상 0이 된다는 점을 가정한다.
- 진척률 평균: 행별 `progress_pct`의 단순 평균을 쓴다 (FR-4의 가중 비율과 다르다). 명세에 평균 방식이 없어 이 가정을 적는다.
- 간트 블록 선택: 선택 파라미터 이름(`block`)은 제안이다. 여러 공정을 가진 블록은 선택한 공정 행만 간트에 그린다 (FR-8 3번).
- 기준일: 기준일은 `src/config.js`의 `TODAY`(2026-10-31)를 쓴다. 테스트는 `today`를 인자로 넘겨 고정한다.
- 명세 원문: 2단계 명세 본문은 확인되지 않았다 (`stage2/spec.md` 입력 근거 항목). FR-8 내용은 기준 명세 1단계 기준으로 적었다.
- 기존 TOP 10 표: 지금은 한 페이지 하단에 있다. P5에서 탭 2 안으로 옮기면 화면 테스트 (`top-row` 기준) 위치 가정이 바뀐다. 기존 테스트가 깨지면 P5에서 함께 고친다.
