# 구현 계획: 조선소 생산 KPI 대시보드 (Node.js 전환)

- 상태: 초안 (계획 단계, 코드 미작성)
- 작성일: 2026-11-13
- 입력 명세: `.specify/specs/kpi-dashboard/spec.md` (현재 As-built 기준)
- 상위 원칙: `.specify/memory/constitution.md` (v1.0.0)
- 요청 스택: Node.js 24 이상, Express, SQLite(`node:sqlite`), 서버 렌더링(EJS), 사내 SSO 제외, 사번+이름 간이 로그인, 검색은 SQLite FTS5

---

## 0. 구현 전에 정리할 불일치

| # | 불일치 | 처리 |
|---|---|---|
| D-1 | 명세 §1.3은 "사용자 인증"을 **제외**로 적었다. 이번 요청은 간이 로그인과 검색을 **포함**한다. | 명세에 FR-12(로그인), FR-13(검색)을 추가하고 §1.3을 고친다 (4절). |
| D-2 | 명세에는 `SC-` ID가 없다. 검증 기준은 `AC-01`~`AC-18`이다. | 이 계획은 AC를 SC 역할로 쓴다. SC를 따로 두려면 명세를 바꿔야 한다. 신규 검증 기준은 AC-19 이후로 번호를 잇는다. |
| D-3 | 명세 §1.4, §9, FR-1(캐시)은 Python/Streamlit 실행을 전제로 한다. | 전환 후 Node 기준으로 고친다. FR-1의 "캐시"는 요청마다 DB 조회로 바꾼다 (데이터가 블록 360행, 생산 약 360행 규모라 영향이 작다). |
| D-4 | 헌법 원칙 3: 이름·사번은 로그에 남기지 않는다. 현재 데이터에는 없지만 로그인이 생기면 개인정보가 들어온다. | 7절에서 해시 저장과 로그 차단을 설계하고 테스트한다. |
| D-5 | 헌법 원칙 2: 새 패키지는 이 `plan.md`에 근거를 적어야 한다. | 2절 표에 `express`, `ejs`를 기록한다. |
| D-6 | 헌법 원칙 5: 외부 CDN 금지. | Plotly.js는 파일을 `public/vendor/`에 넣어 제공한다. |

---

## 1. 범위

- **포함**
  - 명세 FR-1 ~ FR-11 전부를 Node로 옮긴다. 계산 결과(숫자)는 Python 버전과 같아야 한다.
  - FR-12 간이 로그인 (사번 + 이름)
  - FR-13 검색 (SQLite FTS5)
- **제외**: 사내 SSO, 실데이터 연동(MES/ERP), 자동 알림, 데이터 편집, 예지보전
- **고정 값 유지**: 기준일 2026-10-31 (명세 §9 결정 사항)
- **Streamlit 앱**: 전환 커밋 전까지 `app.py`를 유지한다 (9.3 롤백 절차).

---

## 2. 기술 결정

| 영역 | 선택 | 이유 | 버린 대안 |
|---|---|---|---|
| 런타임 | Node.js 24 이상 | 요청 조건 | 없음. 로컬에 Node v26.13.0이 있으나 **24.x에서는 직접 확인이 필요하다** (R1) |
| 웹 프레임워크 | `express` 5.x | 라우팅, 미들웨어, 정적 파일 | `node:http` 직접 사용: 라우팅과 폼 파싱 코드가 늘어난다 |
| 템플릿 | `ejs` 3.x | 요청한 서버 렌더링 | 없음 |
| DB | `node:sqlite` (내장) | 외부 패키지 없음. 이 환경에서 FTS5 생성이 동작함을 확인했다 (SQLite 3.54.0) | `better-sqlite3`: 네이티브 빌드가 필요해 사내 PC에서 실패할 수 있다 |
| 검색 토크나이저 | FTS5 `trigram` | 한글 부분 일치 (예: `대조립`, `운반선`, `2401`이 모두 매칭됨을 확인했다) | `unicode61`: 한글 단어 경계가 약해 부분 일치가 어렵다 |
| 차트 | `plotly.js` 고정 버전 파일을 `public/vendor/plotly.min.js`에 복사 | 기존 Plotly 차트를 그대로 옮긴다. 원칙 5 준수 | CDN (금지), 서버에서 SVG 직접 그리기 (작업량이 크다) |
| 테스트 | `node:test` + `node:assert`, 내장 `fetch` | 개발 의존성 0 | `jest`, `supertest`: 패키지 추가 |
| 세션 | HMAC 서명 쿠키 (`node:crypto`) | 패키지와 서버 세션 저장소가 필요 없다 | `express-session`: 패키지 추가 |
| CSV 읽기 | 자체 파서 (BOM 제거, 큰따옴표 처리) | 데이터 형식이 단순하다 | `csv-parse`: 패키지 추가 |

**패키지 기록 (원칙 2)**

| 패키지 | 범위 | 용도 | 대체 불가 이유 |
|---|---|---|---|
| `express` | `^5` | HTTP 라우팅, 미들웨어 | 직접 구현하면 코드가 많아지고 검증 부담이 커진다 |
| `ejs` | `^3` | 서버 렌더링 템플릿 | 요청 조건 |
| `plotly.js` (파일 복사) | 설치 시점 버전 고정 | 차트 렌더링 | 차트 직접 구현은 작업량이 크다. 라이선스는 설치 전에 확인한다 |

개발 의존성은 추가하지 않는다. 설치 명령 `npm install express ejs` 후 `package.json`에 정확한 버전을 기록한다.

---

## 3. 구조

```
src/
  server.js            Express 앱 생성, 미들웨어, 라우트 등록
  config.js            환경 변수 (SESSION_SECRET, DB 경로, 기준일 2026-10-31)
  db/
    open.js            DatabaseSync 열기, PRAGMA foreign_keys=ON, journal_mode=WAL
    migrate.js         up/down 러너, schema_migrations 테이블
    migrations/        0001_init, 0002_users, 0003_block_search (각 .up.sql / .down.sql)
    import-csv.js      data/*.csv → 테이블 (트랜잭션, 전체 재적재)
  domain/              순수 함수 (DB와 HTTP에 의존하지 않음). 기존 Python 계산을 옮긴다.
    block-status.js    FR-1 (대기 / 진행 / 완료, 지연일수)
    period.js          FR-5 직전 기간, AC-18 blocksInPeriod
    kpi.js             FR-4 달성률, OEE, 불량률, 맨아워 효율, 지연 블록 수
    alerts.js          FR-6 상태 판정, 경고 문구
  repo/
    queries.js         기간·공정·호선 조건 SQL (FR-2), TOP 10 (FR-8)
    search.js          FTS5 검색 (FR-13)
  routes/
    dashboard.js       GET /  (FR-2, FR-3, FR-7 ~ FR-11)
    auth.js            GET/POST /login, POST /logout (FR-12)
  middleware/
    require-login.js   로그인 확인
    cookie.js          쿠키 파싱, HMAC 서명 검증
  charts/              Plotly 설정 객체를 만드는 순수 함수 (FR-7 ~ FR-10)
views/                 EJS: layout, dashboard, login, search, tabs/*
public/vendor/         plotly.min.js
test/                  node --test
  domain/*.test.js
  db/migrate.test.js, import.test.js
  repo/*.test.js
  charts/*.test.js
  routes/*.test.js
  golden/baseline.json  Python 기준값 (6절 0단계)
```

`domain/`이 순수 함수이므로 원칙 1(테스트 먼저)을 DB 없이 적용할 수 있다.

---

## 4. 명세 개정 목록 (구현 전 필수)

1. **§1.3 범위**: 포함에 "간이 로그인(FR-12)", "검색(FR-13)"을 추가한다. 제외에서 "사용자 인증"을 빼고 "사내 SSO"만 남긴다.
2. **§1.4 실행 환경**: Node.js 24 이상, 실행 `npm start`, 테스트 `npm test`(`node --test`)로 바꾼다.
3. **§3 데이터 명세**: §3.5 `users` 테이블(해시만 저장)을 추가한다.
4. **FR-1 캐시 문구**: "요청마다 DB 조회"로 바꾼다.
5. **FR-12 간이 로그인 (신규)**: 사번과 이름을 입력받아 `users` 해시와 대조한다. 일치하면 서명 쿠키를 발급한다 (유효 8시간). 대시보드와 검색은 로그인이 필요하다. 실패 문구는 "사번 또는 이름이 일치하지 않습니다"로 통일하고, 사번 존재 여부를 알려 주지 않는다. 로그아웃하면 쿠키를 지운다.
6. **FR-13 검색 (신규)**: 블록 ID, 호선 번호, 선종, 공정명으로 검색한다. 결과는 블록-공정 행(블록, 호선, 선종, 공정, 상태)이며 최대 100건이다. 3자 이상은 FTS5, 2자 이하는 `LIKE`를 쓴다.
7. **§5 수용 기준**: AC-19 ~ AC-24를 추가한다 (5절).
8. **§6 한계 4**: 이 `plan.md`가 생기면 해소된다고 적는다.
9. **버전**: 명세 개정 이력을 추가한다.

---

## 5. 요구사항 → 설계·테스트 매핑

설계 담당은 모듈 경로, 테스트 담당은 테스트 파일과 주요 케이스다.

### 5.1 기능 요구사항 (FR)

| ID | 요구사항 (요약) | 설계 담당 | 테스트 담당 |
|---|---|---|---|
| FR-1 | 세 CSV 로드, 블록-공정 상태와 지연일수 판정 | `db/import-csv.js`, `domain/block-status.js` | `test/db/import.test.js` (생산 행 수, 설비 8대, 블록 360행, 빈 실적 → NULL), `test/domain/block-status.test.js` (대기, 진행, 완료, 지연, 음수는 0, 시작 없음은 지연 0) |
| FR-2 | 기간·공정·호선 필터, 빈 선택은 전체, 호선은 블록에만 적용 | `routes/dashboard.js`, `repo/queries.js` | `test/routes/filters.test.js` (빈 선택 = 전체, 기간 한쪽만 입력, 호선 변경이 생산 탭 KPI를 바꾸지 않음) |
| FR-3 | 생산 데이터가 없으면 안내 문구를 보이고 탭을 그리지 않음 | `routes/dashboard.js`, `views/dashboard.ejs` (empty 분기) | `test/routes/dashboard.test.js` (안내 문구 포함, 탭 마크업 없음) |
| FR-4 | KPI 5종, 가중 비율, 분모 0 처리 | `domain/kpi.js` | `test/domain/kpi.test.js` (합계 나눗셈이 행별 평균과 다른 케이스, 분모 0 규칙, OEE 세부 값) |
| FR-5 | 직전 기간 비교 (같은 길이, 부분 데이터는 있는 만큼, 전무하면 생략) | `domain/period.js` | `test/domain/period.test.js` (경계 날짜, 부분 데이터, 전무) |
| FR-6 | 상태 판정 🟢🟡🔴⚪, 경고 줄 문구 | `domain/alerts.js` | `test/domain/alerts.test.js` (경계값 92, 95, 70, 75, 3, 3.5, 지연 0/1/4/5, null) |
| FR-7 | 탭 1 생산실적: 일별 막대와 선, 공정별 달성률, 주차 히트맵, 경고 | `charts/production.js`, `views/tabs/production.ejs` | `test/charts/production.test.js` (달성률 축 40~110, 목표선 95, 공정 순서 고정, 히트맵 색 범위 60~100) |
| FR-8 | 탭 2 블록: 도넛, 호선·공정 진척률, 간트, 지연 TOP 10 | `charts/blocks.js`, `repo/queries.js` | `test/charts/blocks.test.js` (간트 종료일 null → 2026-10-31, 기준선), `test/repo/top10.test.js` (지연일수 내림차순, 최대 10행) |
| FR-9 | 탭 3 설비 OEE: 요약 카드 4개, 설비별 막대, 정지 추이 | `domain/kpi.js`(oee), `charts/equipment.js` | `test/domain/kpi.test.js`(OEE), `test/charts/equipment.test.js` (낮은 순 정렬, 색 범위 50~85, 기준선 75, 경고는 미달 설비만) |
| FR-10 | 탭 4 품질: 불량률 추이, 파레토, 재작업 시간 | `charts/quality.js` | `test/charts/quality.test.js` (상한 초과 일수, 최고값과 날짜, 누적 비율 0~105) |
| FR-11 | 원본 데이터 표 (필터된 생산 데이터) | `routes/dashboard.js`, `views/tabs/raw.ejs` | `test/routes/dashboard.test.js` (표 행 수 = 같은 조건의 쿼리 결과 행 수) |
| **FR-12** (신규) | 사번+이름 간이 로그인, 서명 쿠키, 로그아웃 | `routes/auth.js`, `middleware/require-login.js`, `middleware/cookie.js`, `db/migrations/0002_users` | `test/routes/auth.test.js` (AC-19, AC-20, AC-21) |
| **FR-13** (신규) | FTS5 검색 (블록, 호선, 선종, 공정) | `repo/search.js`, `db/migrations/0003_block_search` | `test/repo/search.test.js` (AC-22, AC-23, AC-24) |

### 5.2 수용 기준 (AC)

| ID | 기준 | 설계 담당 | 테스트 담당 |
|---|---|---|---|
| AC-01 | 달성률 = Σ실적 ÷ Σ계획 × 100, 소수 첫째 자리 | `domain/kpi.js` | `kpi.test.js` (단위 계산), `golden.test.js` |
| AC-02 | 달성률 92% 미만이면 빨간 줄에 현재 값과 차이 (예: `-3.8%p`) | `domain/alerts.js` (문구 형식) | `alerts.test.js` |
| AC-03 | 불량률 3% 초과 시 카드 라벨에 🟡 또는 🔴 | `domain/alerts.js` | `alerts.test.js` (경계값) |
| AC-04 | 지연 블록 5개 이상 🔴, 1~4개 🟡, 0개 🟢 | `domain/alerts.js` | `alerts.test.js` |
| AC-05 | 값이 없으면 ⚪ | `domain/alerts.js` | `alerts.test.js` (null) |
| AC-06 | 직전 기간이 없으면 증감을 표시하지 않음 | `domain/period.js`, `views/dashboard.ejs` | `period.test.js`, `dashboard.test.js` |
| AC-07 | 생산 데이터 없음 → 안내 문구, 나머지 탭 미렌더링 | FR-3과 같은 분기 | `dashboard.test.js` |
| AC-08 | 10/13~10/17 조회 시 대조립 달성률 경고와 CR-02 OEE 경고 | `kpi.js`, `alerts.js`, `charts/equipment.js` | `golden.test.js` (경고 존재), 설비 경고 문구는 화면 확인 (수동) |
| AC-09 | 9/14~9/19 조회 시 불량률 상한 초과 경고 | `charts/quality.js` | `golden.test.js` |
| AC-10 | 전체 기간 기본 화면: 지연 블록 18개(🔴), 불량률 초과 5일(🔴), 대조립 93.7%(🟡) | `kpi.js`, `alerts.js`, `charts/quality.js` | `golden.test.js` |
| AC-11 | 간트에서 실적 종료일 없는 막대는 2026-10-31까지 그림 | `charts/blocks.js` | `blocks.test.js` |
| AC-12 | 지연 TOP 10은 지연일수 내림차순, 최대 10행 | `repo/queries.js` | `top10.test.js` |
| AC-13 | 호선 필터는 블록 탭과 지연 블록 수에만 영향 | `routes/dashboard.js` (필터 적용 범위) | `filters.test.js` |
| AC-14 | `generate_data.py`를 두 번 실행하면 CSV가 같음 | `generate_data.py` (Python 유지, 포팅하지 않음) | 해시 비교 스크립트 (수동, 9.3 이후에도 유지) |
| AC-15 | `npm test` 종료 코드 0 | `package.json` scripts | 전체 실행 |
| AC-16 | 화면 문구는 한국어, 외부 URL을 불러오지 않음 | `views/*`, `public/` | `test/routes/no-external.test.js` (응답 HTML에 `http(s)://` 리소스 참조 없음) + grep 점검 |
| AC-17 | 10/13~10/17 맨아워 효율 92.3%(🟡), 전체 기간 값과 다름 | `kpi.js` (MH 겹침 조건), `period.js` | `golden.test.js` |
| AC-18 | 실적 기간이 선택 기간과 겹치는 블록만 맨아워에 포함 | `domain/period.js` (`blocksInPeriod`) | `period.test.js` (Python의 4개 케이스를 그대로 옮김) |
| **AC-19** (신규) | 명단에 있는 사번+이름이면 로그인되고, 없거나 이름이 다르면 실패 | `routes/auth.js` | `auth.test.js` |
| **AC-20** (신규) | 쿠키를 변조하거나 만료되면 로그인 화면으로 돌아감 | `middleware/cookie.js` | `auth.test.js` |
| **AC-21** (신규) | 로그와 응답 본문에 사번·이름 평문이 나오지 않음 | `routes/auth.js` (로그 함수) | `auth.test.js` (로그 출력 캡처 후 값 검색) |
| **AC-22** (신규) | 3자 이상 한글 질의가 부분 일치로 찾힘 (예: `대조립` → 해당 블록) | `repo/search.js` | `search.test.js` |
| **AC-23** (신규) | 2자 질의(예: `도장`)도 결과가 나옴 (LIKE 폴백) | `repo/search.js` | `search.test.js` |
| **AC-24** (신규) | 빈 질의, FTS 특수문자(`"`, `*`, `:`)가 오류 없이 처리되고 결과는 100건 이하 | `repo/search.js` (이스케이프) | `search.test.js` |

---

## 6. 구현 순서 (테스트 먼저, 원칙 1)

0. **기준값 고정**: 현재 Python 앱의 계산 결과(AC-01, 08~10, 17의 숫자)를 `test/golden/baseline.json`에 저장한다. 이 값은 이식 후에도 바뀌면 안 된다. 명세 값이 실제와 다르면 이 단계에서 확인한다.
1. 마이그레이션 러너와 `0001_init`. 테스트: `test/db/migrate.test.js`.
2. CSV 임포터. 테스트: `test/db/import.test.js`.
3. `domain/` 순수 함수. 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.
4. 라우트와 EJS 뷰: 탭 1 → 탭 4 순서. 0단계 기준값 테스트를 통과시킨다.
5. FR-12 간이 로그인 (`0002_users`).
6. FR-13 검색 (`0003_block_search`).
7. 전환 커밋: `package.json` scripts, `README.md`, 명세 버전 올림. `requirements.txt`와 Python 파일 삭제는 별도 커밋으로 한다 (9.3).

---

## 7. 보안과 개인정보 (원칙 3)

- **사번·이름 저장**: 평문으로 저장하지 않는다. `HMAC-SHA256(키, 값)`으로 `employee_hash`, `name_hash`를 저장한다. 대조는 해시 비교이며 `crypto.timingSafeEqual`을 쓴다.
- **쿠키**: 내용은 사용자 id와 만료 시각뿐이다. HMAC 서명을 붙이고 `HttpOnly`, `SameSite=Lax`를 설정한다. 서명 키는 환경 변수 `SESSION_SECRET`에서 읽으며, 없으면 서버가 시작되지 않는다.
- **로그**: 사번, 이름, 쿠키 값을 출력하지 않는다. 로그인 실패는 "실패" 한 줄과 시각만 남긴다.
- **응답 메시지**: 사번이 있는지 없는지 알 수 없도록 실패 문구를 하나로 통일한다.
- **한계**: 명단 대조는 본인 확인이 아니다. 명단에 있는 사번과 이름을 아는 사람은 누구나 들어갈 수 있다. 사내 SSO가 준비되면 교체한다. 이 한계는 README에 적는다.

---

## 8. 위험과 대응

| ID | 위험 | 영향 | 대응 |
|---|---|---|---|
| R1 | Node 24에서 `node:sqlite`가 실험 기능으로 경고를 내거나 API가 다름 | 기동 경고, 동작 차이 | 24.x 실제 설치로 확인한다. `engines`를 `>=24`로 적는다. DB 접근은 `db/open.js` 한 파일에만 둬서, 실패하면 `better-sqlite3`로 바꿀 때 영향을 줄인다 |
| R2 | FTS5 `trigram`은 3자 미만 질의에 맞지 않는다 (2자 질의는 예외 없이 실행됐지만 결과 행은 확인하지 않았다) | 짧은 검색어 결과 누락 | 2자 이하는 `LIKE` 폴백 (AC-23). 테스트로 확인한다 |
| R3 | 이식 중 숫자가 달라짐 | 발표 수치 오류 | 0단계 기준값 테스트 (`golden.test.js`). 다르면 Node 쪽을 고친다 |
| R4 | 간이 로그인으로 타인 사칭 | 감사 기록 신뢰 저하 | 명단 대조, README에 한계 명시, SSO 전환 계획 |
| R5 | 개인정보가 DB, 로그, 쿠키로 새어 나감 | 원칙 3 위반 | 해시 저장, 쿠키 최소화, 로그 캡처 테스트 (AC-21) |
| R6 | `plotly.js` 파일이 수 MB이고 라이선스 확인이 필요함 | 로딩 시간, 반입 절차 | 설치 전에 라이선스를 확인한다. 나중에 필요한 차트만 번들하는 방법을 검토한다 |
| R7 | 마이그레이션 `down`이 데이터를 지움 | 계정 데이터 손실 | 9.1의 백업 절차를 쓴다. 생산 데이터는 CSV가 원본이라 다시 적재할 수 있다. 계정은 명단으로 다시 등록한다 |
| R8 | FR-1 캐시를 없애 응답이 느려짐 | 명세의 반응 시간 기준 | 데이터 규모가 작아 영향이 적다. 측정 후 필요하면 캐시를 다시 넣는다 |
| R9 | 명세와 구현이 어긋난 채 진행됨 | 기준 혼란 | 4절 명세 개정을 구현 전에 끝낸다 |

---

## 9. 마이그레이션과 되돌리는 방법

### 9.1 마이그레이션 목록

| 버전 | up | down | 데이터 영향 |
|---|---|---|---|
| `0001_init` | `daily_production`, `equipment`, `blocks` 생성 (`blocks`는 `id INTEGER PRIMARY KEY`, `UNIQUE(block_id, process)`), 인덱스 (`date`, `process`, `ship_no`) | 세 테이블 `DROP` | down 시 생산 데이터 삭제. CSV에서 다시 적재한다 |
| `0002_users` | `users (id INTEGER PRIMARY KEY, employee_hash TEXT UNIQUE NOT NULL, name_hash TEXT NOT NULL, created_at TEXT NOT NULL)` | `DROP TABLE users` | 계정 삭제. 명단으로 다시 등록한다 |
| `0003_block_search` | `blocks_fts` (FTS5, `tokenize='trigram'`, `content='blocks'`, `content_rowid='id'`), 트리거 `ai`, `ad`, `au`, 기존 행에 `rebuild` | 트리거 3개 `DROP` → `blocks_fts` `DROP` | 검색 인덱스만 삭제된다. 원본 데이터는 그대로다 |

### 9.2 러너 규칙

- 각 마이그레이션은 트랜잭션 안에서 실행한다. 실패하면 롤백한다.
- `schema_migrations(version, applied_at)`로 적용 이력을 남긴다.
- `migrate down --to <버전>`은 기본 1단계만 내린다.
- `down`을 실행하기 전에 `VACUUM INTO 'backup/app-<YYYYMMDD-HHmm>.db'`로 백업을 자동 생성한다. 백업이 실패하면 `down`을 중단한다.
- 적용 시각은 UTC로 저장하고, 화면과 로그에는 KST로 표시한다 (원칙 4).

### 9.3 검증

- `test/db/migrate.test.js`: 빈 DB에서 up 전체 → down 전체 → 테이블 0개 확인 → up 다시 → `sqlite_master` 스냅샷이 처음과 같은지 확인.
- 데이터가 있는 DB에서 `0003` down을 실행하면 `daily_production`, `blocks` 행 수가 그대로인지 확인.

### 9.4 전환 롤백

1. 전환 커밋 전에 태그를 붙인다: `git tag streamlit-final`.
2. Python 파일(`app.py`, `kpi_alerts.py`, `tests/`, `requirements.txt`)은 전환 커밋에서 지우지 않는다. 인수 테스트가 통과한 뒤 별도 커밋으로 지운다.
3. 전환 후 문제가 생기면 `git revert <전환 커밋>` 하거나 `git checkout streamlit-final` 후 `streamlit run app.py`를 실행한다.
4. `data/*.csv`는 건드리지 않으므로 Streamlit은 그대로 동작한다. `data/app.db`는 `.gitignore`에 넣어 Streamlit에 영향을 주지 않는다.
5. DB를 되돌려야 하면 백업을 복원하거나, `migrate down --to 0001` 후 CSV를 다시 적재한다.

---

## 10. 열린 질문 (기본값으로 진행합니다. 답을 주시면 반영합니다)

1. **로그인 명단**: 사전 등록 명단과 대조할까요? → 기본: **대조한다**. 명단의 출처(인사 파일 등)가 필요합니다.
2. **Node 앱의 역할**: Streamlit을 **교체**할까요, **병행**할까요? → 기본: **교체**하고 태그로 롤백한다.
3. **검색 대상**: 블록만 검색할까요? → 기본: **블록**(블록 ID, 호선, 선종, 공정).
4. **명세 개정**: 4절 개정을 진행해도 될까요? → 기본: **진행**. 헌법 원칙은 바꾸지 않는다.
