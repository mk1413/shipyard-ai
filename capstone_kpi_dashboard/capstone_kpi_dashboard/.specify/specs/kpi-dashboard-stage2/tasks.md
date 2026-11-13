# 작업 목록 (2단계): 조선소 생산 KPI 대시보드

- 입력: `spec.md` (요구사항, 스토리), `plan.md` (헌법 점검), `kpi-dashboard/plan.md` (기술 설계)
- 표기: `[ ]` 미완료, `[x]` 완료, `[P]` 다른 파일을 건드리고 서로 의존하지 않아 병렬 가능, `[USn]` 사용자 스토리, `(T### 이후)` 선행 작업

---

## Phase 1: 준비 (Setup)

- [ ] T001 기준 명세 개정: `kpi-dashboard/spec.md` §1.3(사용자 인증 제외 삭제, 검색 추가)과 §1.4(Node 실행 환경)를 고친다
- [x] T002 Node 프로젝트 골격: `package.json`(engines `>=24`, scripts `start`/`test`), `.gitignore`(`data/app.db`, `backup/`), `src/`, `views/`, `public/`, `test/` 폴더 (start/test 전환은 T060에서)
- [x] T003 [P] `npm install express ejs`로 패키지를 설치하고, 정확한 버전을 `package.json`에 기록한다
- [x] T004 [P] Plotly.js 라이선스를 확인하고 `public/vendor/plotly.min.js`에 고정 버전을 복사한다 (R6)
- [x] T005 [P] `src/db/open.js`: `node:sqlite` 연결, `PRAGMA foreign_keys=ON`, `journal_mode=WAL`

---

## Phase 2: 기반 (Foundational) — 모든 스토리의 선행 조건

- [x] T006 Python 기준값 저장: 현재 `app.py` 계산 결과(AC-01, 08, 09, 10, 17의 숫자)를 `test/golden/baseline.json`에 기록한다
- [x] T007 마이그레이션 테스트 먼저: `test/db/migrate.test.js`에 up → down → up 시나리오와 스키마 스냅샷 비교를 쓴다 (실패 확인)
- [x] T008 마이그레이션 러너 `src/db/migrate.js` 구현 (T007 이후). 트랜잭션, `schema_migrations`, `down --to`, `VACUUM INTO` 백업
- [x] T009 `src/db/migrations/0001_init.up.sql`, `0001_init.down.sql`: 세 테이블과 인덱스 (T008 이후)
- [x] T010 [P] CSV 파서 테스트 먼저: `test/db/csv.test.js` (BOM 제거, 큰따옴표, 빈 값은 NULL)
- [x] T011 CSV 파서 `src/db/csv.js` 구현 (T010 이후)
- [x] T012 임포터 테스트 먼저: `test/db/import.test.js` (블록 360행, 설비 8대, 빈 `actual_start`는 NULL) (T009 이후)
- [x] T013 임포터 `src/db/import-csv.js` 구현 (T011, T012 이후). 전체 재적재를 트랜잭션으로 한다
- [x] T014 [P] FR-1 테스트 먼저: `test/domain/block-status.test.js` (대기, 진행, 완료, 지연, 음수는 0, 시작 없음은 지연 0)
- [x] T015 FR-1 `src/domain/block-status.js` 구현 (T014 이후)
- [x] T016 [P] FR-5 테스트 먼저: `test/domain/period.test.js` (직전 기간 경계, 부분 데이터, 전무, AC-18 `blocksInPeriod` 4개 케이스)
- [x] T017 FR-5, AC-18 `src/domain/period.js` 구현 (T016 이후)
- [x] T018 [P] FR-4 테스트 먼저: `test/domain/kpi.test.js` (가중 비율과 행별 평균의 차이, 분모 0, OEE 세부 계산, AC-01, AC-17 맨아워 92.3%)
- [x] T019 FR-4 `src/domain/kpi.js` 구현 (T018, T017 이후)
- [x] T020 [P] FR-6 테스트 먼저: `test/domain/alerts.test.js` (경계값 92, 95, 70, 75, 3, 3.5, 지연 0/1/4/5, null, AC-02 문구 `-3.8%p`)
- [x] T021 FR-6 `src/domain/alerts.js` 구현 (T020 이후)
- [x] T022 [P] FR-2 테스트 먼저: `test/repo/filters.test.js` (빈 선택 = 전체, 기간 한쪽만 입력, 호선은 블록에만 적용, AC-13)
- [x] T023 FR-2 `src/repo/queries.js` 구현 (T022, T013 이후)

**체크포인트**: Phase 2가 끝나면 `npm test`의 도메인과 DB 테스트가 모두 통과해야 한다. 아직 화면은 없다.

---

## Phase 3: US1 — 생산실적과 KPI 달성 여부 (P1)

**목표**: 로그인 없이 호출하는 라우트 테스트로 탭 1과 필터를 검증한다 (로그인은 Phase 5에서 붙인다).
**독립 테스트**: 기간과 공정을 바꾸면 KPI 카드와 탭 1 차트가 바뀌고, 데이터가 없으면 안내 문구가 나온다.

- [x] T024 [US1] FR-3 테스트 먼저: `test/routes/dashboard.test.js` (데이터 없음 → 안내 문구, 탭 마크업 없음, AC-07)
- [x] T025 [US1] FR-5 화면 테스트 먼저: 직전 기간이 없으면 증감을 표시하지 않는다 (AC-06). `test/routes/dashboard.test.js`에 추가
- [x] T026 [US1] FR-7 차트 테스트 먼저: `test/charts/production.test.js` (달성률 축 40~110, 목표선 95, 공정 순서 고정, 히트맵 색 범위 60~100)
- [x] T027 [US1] FR-7 `src/charts/production.js` 구현 (T026 이후)
- [ ] T028 [US1] 레이아웃과 탭 1 뷰: `views/layout.ejs`, `views/dashboard.ejs`, `views/tabs/production.ejs`, KPI 카드와 경고 줄 (T024, T025, T027 이후)
- [x] T029 [US1] `src/routes/dashboard.js`: GET `/`에서 필터 파라미터(기간, 공정, 호선)를 받아 조회한다 (T023, T024 이후)
- [x] T030 [US1] FR-11 테스트 먼저: 원본 데이터 표의 행 수가 같은 조건의 쿼리 결과와 같다 (`test/routes/dashboard.test.js`)
- [x] T031 [US1] FR-11 원본 데이터 표 `views/tabs/raw.ejs` 구현 (T030, T029 이후)
- [ ] T032 [US1] 골든 테스트: `test/routes/golden.test.js`에서 AC-01, AC-08 (대조립 경고), AC-09, AC-10, AC-17 값을 `baseline.json`과 비교한다 (T006, T029 이후)

---

## Phase 4: US2 — 블록 공정진척과 지연 추적 (P1)

**독립 테스트**: 블록 탭에 도넛, 호선·공정 진척률, 간트, 지연 TOP 10이 나오고, 호선 필터가 이 탭에만 영향을 준다.

- [x] T033 [US2] FR-8 TOP 10 테스트 먼저: `test/repo/top10.test.js` (지연일수 내림차순, 최대 10행, AC-12)
- [x] T034 [US2] FR-8 TOP 10 쿼리 구현 `src/repo/queries.js`에 추가 (T033 이후)
- [ ] T035 [US2] FR-8 차트 테스트 먼저: `test/charts/blocks.test.js` (간트 종료일 null → 2026-10-31, 기준선, 도넛 상태 5종) (AC-11)
- [ ] T036 [US2] FR-8 `src/charts/blocks.js` 구현 (T035 이후)
- [ ] T037 [US2] 탭 2 뷰 `views/tabs/blocks.ejs`와 탭 전환 연결 (T034, T036, T029 이후)

---

## Phase 5: US5 — 간이 로그인 (P1) — FR-12

**목표**: FR-12를 구현하고, 대시보드와 검색을 로그인 뒤에만 열린다.
**독립 테스트**: 명단에 있는 사번과 이름으로 로그인하면 대시보드가 열리고, 틀리면 실패 문구만 나온다.

- [x] T038 [US5] 마이그레이션 `src/db/migrations/0002_users.up.sql`, `0002_users.down.sql`: `users (id, employee_hash UNIQUE, name_hash, created_at)` (T008 이후)
- [x] T039 [US5] 0002 마이그레이션 테스트 추가: `test/db/migrate.test.js`에 0002 up/down을 포함한다 (T038 이후)
- [x] T040 [P] [US5] 쿠키 테스트 먼저: `test/middleware/cookie.test.js` (서명 검증, 변조 거부, 만료 거부, AC-20)
- [x] T041 [P] [US5] 로그인 테스트 먼저: `test/routes/auth.test.js` (명단 일치 → 로그인, 사번 없음 또는 이름 불일치 → 같은 실패 문구, AC-19)
- [x] T042 [P] [US5] 로그 차단 테스트 먼저: `test/routes/auth-log.test.js` (로그와 응답 본문에 사번·이름 평문이 없다, AC-21)
- [x] T043 [US5] `src/middleware/cookie.js` 구현: HMAC 서명, `HttpOnly`, `SameSite=Lax`, `SESSION_SECRET` 없으면 기동 실패 (T040 이후)
- [x] T044 [US5] `src/routes/auth.js`와 `src/middleware/require-login.js` 구현: 해시 대조, `timingSafeEqual`, 로그아웃 (T041, T042, T043 이후)
- [x] T045 [US5] 명단 시드 스크립트 `scripts/seed-users.js`: (T039 이후) — 완료: `data/users.csv`를 읽는 `npm run seed:users`, 실제 명단은 Q4 결정에 따라 관리자가 제공
- [x] T046 [US5] 로그인 뷰 `views/login.ejs`와 `require-login`을 `/`에 적용 (T044 이후). T024, T025, T030 테스트가 로그인 뒤에서도 통과하도록 테스트 설정을 바꾼다

---

## Phase 6: US3 — 설비 OEE (P2)

- [x] T047 [US3] FR-9 차트 테스트 먼저: `test/charts/equipment.test.js` (OEE 낮은 순 정렬, 색 범위 50~85, 기준선 75, 미달 설비만 경고)
- [x] T048 [US3] FR-9 `src/charts/equipment.js`와 `views/tabs/equipment.ejs` 구현 (T047 이후)
- [ ] T049 [US3] 설비 경고 확인: 10/13 ~ 10/17에서 CR-02 OEE 경고가 나온다 (AC-08의 설비 부분). 자동 테스트에 넣고, 화면은 수동으로 확인한다 (T048 이후)

---

## Phase 7: US4 — 품질 (P2)

- [x] T050 [US4] FR-10 차트 테스트 먼저: `test/charts/quality.test.js` (상한 초과 일수, 최고값과 날짜, 누적 비율 0~105, AC-09 경고 문구)
- [x] T051 [US4] FR-10 `src/charts/quality.js`와 `views/tabs/quality.ejs` 구현 (T050 이후)

---

## Phase 8: US6 — 블록 검색 (P2)

- [x] T052 [US6] 마이그레이션 `src/db/migrations/0003_block_search.up.sql`, `0003_block_search.down.sql`: `blocks_fts` (trigram), 트리거 `ai`/`ad`/`au`, `rebuild` (T008 이후)
- [x] T053 [US6] 0003 마이그레이션 테스트 추가: 데이터가 있는 DB에서 0003 down 후 `daily_production`, `blocks` 행 수가 그대로인지 확인 (T052 이후)
- [x] T054 [US6] FR-13 검색 테스트 먼저: `test/repo/search.test.js` (AC-22 3자 이상 부분 일치, AC-23 2자 LIKE 폴백, AC-24 빈 질의와 특수문자, 100건 상한)
- [x] T055 [US6] FR-13 `src/repo/search.js` 구현: 3자 이상 FTS5, 2자 이하 LIKE, FTS 특수문자 이스케이프 (T054, T052 이후)
- [x] T056 [US6] 검색 라우트와 뷰 `src/routes/search.js`, `views/search.ejs`: 로그인 필요 (T055, T046 이후)

---

## Phase 9: 마무리 (Polish)

- [ ] T057 [P] AC-16 테스트: `test/routes/no-external.test.js`로 응답 HTML에 외부 리소스 참조가 없는지 확인한다. grep 점검을 함께 한다
- [x] T058 [P] AC-14 점검: `generate_data.py`를 두 번 실행해 CSV 해시가 같은지 확인하는 스크립트 `scripts/check-data-hash.js`
- [x] T059 AC-15: `npm test`가 종료 코드 0으로 끝나는지 확인한다 (전체 테스트 실행)
- [ ] T060 전환 커밋: `package.json` scripts를 Node 기준으로 바꾸고, 태그 `streamlit-final`을 먼저 붙인다 (기술 설계 9.4). Python 파일은 이 커밋에서 지우지 않는다 (T059 이후)
- [ ] T061 README 갱신: 간이 로그인의 한계(명단 대조는 본인 확인이 아님)와 실행 방법을 적는다 (기술 설계 7절)
- [ ] T062 명세 버전 올리기: 2단계 `spec.md`의 상태를 "확정"으로 바꾸고 개정 이력을 갱신한다
- [ ] T063 인수 후 Python 파일 삭제: `app.py`, `kpi_alerts.py`, `tests/`, `requirements.txt`를 별도 커밋으로 지운다 (T060 이후, 인수 확인 뒤)

---

## 의존 관계 요약

- Phase 1 → Phase 2 → Phase 3 → Phase 4 (Phase 3, 4는 Phase 2 이후 순서대로 진행)
- Phase 5 (T046)는 Phase 3의 화면 테스트를 로그인 뒤 상태로 바꾼다. 그래서 Phase 3 이후에 진행한다.
- Phase 5 (T038 이후) → Phase 8 (T056)
- Phase 6, Phase 7은 Phase 3 이후 병렬 진행 가능
- Phase 9는 모든 Phase 이후

---

## 진행 상황 (2026-11-13)

- 완료: T001 제외 Phase 1 전체, Phase 2 전체(T006~T023), US5 전체(T038~T046), US1 중 필터·빈 데이터·직전 기간·원본 표(T024, T025, T029~T031)
- 부분 완료
  - T028: KPI 카드, 경고, 필터, 레이아웃은 구현. 탭 1 차트는 T026~T027 대기.
  - T032: 도메인 수준 골든 테스트(14개)는 통과. 라우트 수준 골든 테스트는 차트 탭과 함께 진행.
- 미완료: T001, T026~T027, T033~T037, T047~T056, T057~T063
- 전체 Node 테스트: 106개 통과 (`npm run test:node`)
- 실행 확인: 서버 기동, 로그인 화면 200, 로그인 없이 대시보드 접근 시 302 /login, Plotly 정적 파일 200

---

## 04 converge 결과 (2026-11-13)

판정: **Converged 아님**. 목록과 저장소를 대조해 목록을 맞췄고, 아래 항목이 남았습니다.

- 목록을 맞춘 항목: T033, T034, T052, T054, T055, T056, T058, T059 (테스트와 구현이 저장소에 있음)
- 부분 완료 (테스트 또는 구현 일부만 있음)
  - T035, T036: 간트 막대 함수(`src/charts/blocks.js`)만 있음. 간트 차트 화면과 도넛 차트는 없음
  - T037: 탭 2 화면 없음
  - T057: AC-16 점검은 `test/routes/dashboard.test.js`에 있음. 별도 파일 `no-external.test.js`는 없음
  - T032: 도메인 수준 골든 테스트만 있음. 라우트 수준은 없음
- 남은 구현: T047~T051 (설비 OEE, 품질 차트), T053 (0003 데이터 보존 테스트), T060~T063 (전환, 정리)
- 남은 수동 확인: T049 (CR-02 경고 화면 확인), T001 (명세 개정)

---

## 진행 상황 갱신 (FR-9, T053)

- T053 완료: 0003 되돌리기 후 행 수 보존, 백업, 재적용 후 검색 동작 확인 (회귀 테스트, 처음부터 통과)
- FR-9 완료: 요약 카드 4개(가동률, 성능효율, 양품률, OEE), 설비별 일 정지시간 추이
- 전체 테스트: 167개 통과 (`npm test`)
