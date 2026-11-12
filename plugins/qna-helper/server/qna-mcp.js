#!/usr/bin/env node
// 사내 QnA 게시판 MCP 서버. 외부 패키지 없이 stdio로 JSON-RPC를 한 줄씩 주고받는다.
// 게시판 주소는 환경 변수 QNA_API로 받는다(예: http://localhost:3001). 비밀 값은 쓰지 않는다.
// 로그와 오류 메시지에는 검색어 원문을 남기지 않는다.

const readline = require("node:readline");

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "qna-helper", version: "0.1.0" };

function resolveApi(raw) {
  if (!raw || !raw.trim()) {
    throw new Error("QNA_API 환경 변수가 비어 있습니다. 게시판 주소를 넣어 주세요.");
  }
  const url = new URL(raw.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("QNA_API는 http 또는 https 주소여야 합니다.");
  }
  return url.toString().replace(/\/+$/, "");
}

let API = null;
try {
  API = resolveApi(process.env.QNA_API);
} catch (err) {
  // 설정이 틀려도 프로세스는 살려 두고, 도구 호출 때 안내 문구를 돌려준다.
  API = null;
  process.stderr.write(`[qna-mcp] ${err.message}\n`);
}

const TOOLS = [
  {
    name: "search_questions",
    description:
      "사내 기술 QnA 게시판에서 질문을 검색한다. 도면, 공정, 품질, 안전 절차 질문에 답하기 전에 쓴다. " +
      "검색어는 핵심 용어 1~3개로 짧게 쓴다(예: '선미 블록 도면'). 긴 문장을 넣으면 0건이 나올 수 있다. " +
      "채택된 답변이 있는 질문이 먼저 나온다. 결과가 0건이면 다른 용어로 다시 찾는다.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "검색어. 핵심 용어 1~3개(예: '용접 기호')",
          minLength: 1,
          maxLength: 100,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_question",
    description:
      "질문 번호로 질문 원문과 답변 목록(채택 여부 포함)을 읽는다. " +
      "답하기 전에 반드시 이 도구로 원문을 읽는다. 검색 결과 제목만 보고 답하지 않는다.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "질문 번호(search_questions 결과의 id)",
          minimum: 1,
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

// 게시판 호출. 응답은 { data, error } 형식이다.
async function boardGet(path) {
  if (!API) {
    throw new Error("게시판 주소가 설정되지 않았습니다. QNA_API 환경 변수를 확인하세요.");
  }
  let res;
  try {
    res = await fetch(API + path, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error("게시판에 연결하지 못했습니다. 게시판 주소와 서버 상태를 확인하세요.");
  }
  if (res.status === 404) throw new Error("해당 질문을 찾을 수 없습니다.");
  if (!res.ok) throw new Error(`게시판 응답 오류(HTTP ${res.status}).`);

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error("게시판 응답을 읽지 못했습니다.");
  }
  if (body.error) throw new Error(`게시판 오류: ${body.error.message ?? body.error.code}`);
  return body.data;
}

function questionLink(id) {
  return `${API}/q/${id}`;
}

function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

async function searchQuestions(args) {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) return textResult("검색어를 1자 이상 넣어 주세요.", true);
  if (query.length > 100) return textResult("검색어는 100자 이하로 줄여 주세요.", true);

  const data = await boardGet(`/search?q=${encodeURIComponent(query)}`);
  const items = Array.isArray(data?.items) ? data.items : [];
  if (items.length === 0) {
    return textResult(`검색 결과 없음: '${query}'. 다른 핵심 용어로 다시 찾아보세요.`);
  }

  const lines = items.map((q) => {
    const accepted = q.hasAccepted ? "채택 답변 있음" : "채택 답변 없음";
    return [
      `- [${q.id}] ${q.title}`,
      `  부서: ${q.dept} / 호선: ${q.hullNo ?? "-"} / 공정: ${q.stage ?? "-"}`,
      `  답변 ${q.answerCount ?? 0}개 (${accepted}) / 작성 ${q.createdAt ?? "-"}`,
      `  링크: ${questionLink(q.id)}`,
    ].join("\n");
  });
  return textResult(
    `'${query}' 검색 결과 ${items.length}건 (채택 답변 있는 질문 먼저):\n\n${lines.join("\n\n")}`
  );
}

async function getQuestion(args) {
  const id = args.id;
  if (!Number.isInteger(id) || id < 1) {
    return textResult("질문 번호(id)는 1 이상의 정수여야 합니다.", true);
  }

  const q = await boardGet(`/questions/${id}`);
  const answers = Array.isArray(q.answers) ? q.answers : [];
  const answerLines = answers.length
    ? answers
        .map((a, i) => {
          const mark = a.id === q.acceptedAnswerId ? " [채택]" : "";
          return `${i + 1}.${mark} ${a.authorName ?? "작성자 미상"} (${a.createdAt ?? "-"})\n${a.body ?? ""}`;
        })
        .join("\n\n")
    : "(답변 없음)";

  const text = [
    `[${q.id}] ${q.title}`,
    `부서: ${q.dept} / 호선: ${q.hullNo ?? "-"} / 공정: ${q.stage ?? "-"}`,
    `작성자: ${q.authorName ?? "-"} / 작성 ${q.createdAt ?? "-"} / 수정 ${q.updatedAt ?? "-"}`,
    `링크: ${questionLink(q.id)}`,
    "",
    "## 질문 원문",
    q.body ?? "(본문 없음)",
    "",
    `## 답변 (${answers.length}개)`,
    answerLines,
  ].join("\n");
  return textResult(text);
}

async function callTool(name, args) {
  if (name === "search_questions") return searchQuestions(args);
  if (name === "get_question") return getQuestion(args);
  return textResult(`알 수 없는 도구: ${name}`, true);
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined;

  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      reply(id, {
        protocolVersion: asked ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    }
    case "notifications/initialized":
      return;
    case "ping":
      if (!isNotification) reply(id, {});
      return;
    case "tools/list":
      reply(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};
      try {
        reply(id, await callTool(name, args));
      } catch (err) {
        // 도구 실행 오류는 JSON-RPC 오류가 아니라 isError 결과로 돌려준다.
        reply(id, textResult(err.message, true));
      }
      return;
    }
    default:
      if (!isNotification) fail(id, -32601, `지원하지 않는 메서드: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    fail(null, -32700, "JSON 파싱 오류");
    return;
  }
  handle(msg).catch((err) => {
    if (msg.id !== undefined) fail(msg.id, -32603, err.message);
  });
});
