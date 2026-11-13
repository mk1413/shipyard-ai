# qna-helper

사내 기술 QnA 게시판을 찾아 근거와 링크를 붙여 답하는 Claude Code 플러그인입니다.

- `server/qna-mcp.js`: 게시판 검색 API를 부르는 MCP 서버(stdio, 외부 패키지 없음, Node 22 이상)
- `skills/ask/SKILL.md`: 게시판만 근거로 답하고, 없으면 없다고 말하는 규칙
- `.mcp.json`: 플러그인이 켜지면 서버를 `node ${CLAUDE_PLUGIN_ROOT}/server/qna-mcp.js`로 띄움
- `.claude-plugin/plugin.json`: 설치할 때 게시판 주소(`qna_api`)를 묻습니다

## 설치와 시험

1. 게시판 주소를 확인합니다. 혼자 연습할 때는 `http://localhost:3001`입니다.
2. 플러그인 폴더 밖에서 Claude Code를 엽니다.
   `claude --plugin-dir C:\work\qna-helper`
3. 게시판 주소를 입력합니다. 나중에 바꿀 때는 `/plugin configure qna-helper`를 씁니다.
4. 질문을 던져 봅니다. 예: "선미 블록 개정 도면은 언제 반영돼?"

## 검사

```powershell
claude plugin validate C:\work\qna-helper
```

## 서버가 지키는 것

- 읽기 전용입니다. 게시판에 GET 요청만 보냅니다.
- 도구 인자를 서버에서 다시 검사합니다. 빈 검색어, 100자를 넘는 검색어, 정수가 아닌 질문 번호는 게시판에 보내지 않고 이유를 돌려줍니다.
- 게시판이 꺼졌거나 주소가 틀리면 "게시판에 연결하지 못했습니다" 문장으로 무엇을 확인할지 알려 줍니다. 스킬은 이 문장을 보면 답을 지어내지 않고 멈춥니다.

## 회사에서 쓸 때

관리자 설정의 MCP 허용 목록(`allowedMcpServers`)에 이 서버 명령을 넣어야 할 수 있습니다. 플러그인 MCP 도구 이름은 `mcp__plugin_qna-helper_qna__search_questions`, `mcp__plugin_qna-helper_qna__get_question`입니다.
