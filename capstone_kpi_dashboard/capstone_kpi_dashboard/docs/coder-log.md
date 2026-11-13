# Coder 작업 기록 (기준 커밋 603fe42)

| 작업 | 테스트 파일 | 빨강 확인 | npm test (tests/pass/fail) |
|---|---|---|---|
| P1 간트 차트 (ganttChart) | test/charts/blocks.test.js | 예 (ganttChart is not a function, 3건) | 170 / 170 / 0 |
| P2 상태 도넛 (statusDonutChart) | test/charts/blocks.test.js | 예 (statusDonutChart is not a function, 4건) | 174 / 174 / 0 |
| P3 호선·공정별 평균 진척률 (progressBarChart) | test/charts/blocks.test.js | 예 (progressBarChart is not a function, 3건) | 177 / 177 / 0 |
| P4 탭 2 데이터 연결 (services, blocks 목록, charts.gantt) | test/routes/dashboard.test.js | 예 (서비스 키 없음, 4건) | 181 / 181 / 0 (routes/dashboard.js는 req.query를 그대로 넘기므로 변경 없음) |
| P5 탭 2 화면 연결 (views/dashboard.ejs) | test/routes/dashboard.test.js | 예 (3건 빨강: 탭 2 섹션, 간트 안내, select 옵션. 4번째 "데이터 없음 안내" 테스트는 기존 동작 보호용이라 처음부터 통과) | 185 / 185 / 0 |
