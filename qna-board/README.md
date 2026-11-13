# qna-board

사내 질문·답변 게시판 (Express, EJS, Node 내장 `node:sqlite`).

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `src/server.js` | 앱 시작점 |
| `src/db/` | `node:sqlite` 연결 모듈 |
| `src/models/` | Question, Answer 모델 |
| `src/routes/` | 라우트 |
| `src/middleware/` | 간이 로그인 미들웨어 |
| `migrations/` | DB 마이그레이션 |
| `views/` | EJS 템플릿 |
| `public/` | 정적 파일 (외부 CDN 사용 금지) |
| `tests/contract/` | API 계약 테스트 |
| `tests/unit/` | 단위 테스트 |
| `scripts/` | 개발용 스크립트 (린트 등) |

## 실행

```bash
npm start    # Node.js 24 이상 필요
npm test
```
