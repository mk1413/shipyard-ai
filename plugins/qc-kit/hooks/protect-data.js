#!/usr/bin/env node
// PreToolUse 훅: data\ 아래 원본 파일 편집을 막는다. (exit 2 = 차단)
// 한계: 스크립트 파일(python make.py ...) 안에서 저장하는 것은 명령 줄만으로 알 수 없어 막지 못한다.
const path = require("path");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  const block = (what) => {
    process.stderr.write("차단: data\\ 원본은 수정할 수 없습니다 (" + what + "). 결과는 out\\ 에 저장하세요.\n");
    process.exit(2);
  };

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    block("훅 입력을 읽지 못함"); // 읽지 못하면 안전하게 막는다
  }
  if (!input || typeof input !== "object") block("훅 입력이 객체가 아님");

  // 프로젝트 폴더: 환경변수 → 훅 입력의 cwd → 현재 작업 폴더 순
  // (플러그인 안에 있으므로 훅 파일 위치로는 프로젝트 폴더를 알 수 없다)
  const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  const baseDir = path.resolve(input.cwd || projectDir);
  const dataDir = path.join(projectDir, "data");
  const norm = (p) => path.resolve(p).toLowerCase();
  // Windows는 경로 조각 끝의 점·공백을 무시한다 (data. = data)
  const fixSegments = (p) =>
    p.split(/[\\/]/).map((s) => (s === "." || s === ".." ? s : s.replace(/[. ]+$/, ""))).join(path.sep);

  const isInData = (p) => {
    if (!p || typeof p !== "string") return false;
    const rel = path.relative(norm(dataDir), norm(path.resolve(baseDir, fixSegments(p))));
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };

  const tool = input.tool_name;
  const ti = input.tool_input || {};

  // 1) 파일 편집 도구
  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const target = ti.file_path || ti.notebook_path;
    if (isInData(target)) block(tool + ": " + target);
  }

  // 2) 셸 명령 (최선의 탐지). 읽기는 허용하고 data 대상 쓰기·삭제·이동·리다이렉션만 막는다.
  if (tool === "Bash" || tool === "PowerShell") {
    const cmd = String(ti.command || "");
    const show = (s) => tool + ": " + s.trim().slice(0, 120);
    const clean = (t) => t.replace(/^[("'`]+|[)"'`;,]+$/g, "");
    const mutating =
      /^(rm|del|erase|mv|move|move-item|ren|rename|rename-item|remove-item|rmdir|rd|touch|tee|tee-object|set-content|add-content|out-file|new-item|clear-content|set-itemproperty|expand-archive|compress-archive|export-\w+|chmod|attrib|truncate|ni|ri|sc|ac|mi|ii)$/i;
    const copying = /^(cp|copy|copy-item|cpi|xcopy|robocopy|install)$/i;
    const gitWrite = /^(checkout|restore|clean|rm|mv|stash|reset|apply|am|cherry-pick|merge|pull|rebase|switch|revert)$/i;

    // 2-a) 명령 단위(;, &&, ||, |, 줄바꿈)로 나눠 검사
    for (const seg of cmd.split(/&&|\|\||[;|\n]/)) {
      const tokens = (seg.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(clean).filter(Boolean);
      if (!tokens.length) continue;

      // 리다이렉션 대상이 data: > path, >> path, >path
      for (let i = 0; i < tokens.length; i++) {
        const m = tokens[i].match(/^\d*>>?&?(.*)$/);
        if (!m) continue;
        const dest = m[1] || tokens[i + 1];
        if (dest && isInData(clean(dest))) block(show(seg));
      }

      const args = tokens.slice(1).filter((t) => !t.startsWith("-") && !/^\d*>/.test(t));
      const head = tokens[0].toLowerCase();
      if (mutating.test(head) && args.some(isInData)) block(show(seg));
      // 복사는 data에서 읽어 나가는 것은 허용, 목적지(마지막 인자)가 data일 때만 막는다
      if (copying.test(head) && args.length && isInData(args[args.length - 1])) block(show(seg));
      if (head === "sed" && tokens.some((t) => /^-\w*i/.test(t)) && args.some(isInData)) block(show(seg));
      if (head === "git") {
        const sub = tokens.slice(1).find((t) => !t.startsWith("-"));
        if (sub && gitWrite.test(sub) && args.slice(1).some(isInData)) block(show(seg));
      }
    }

    // 2-b) 한 줄짜리 스크립트(python -c, node -e, [IO.File]::WriteAllText 등)에서 쓰기 호출의 대상이 data인지
    const lit = String.raw`\s*r?["']([^"']+)["']`;
    const writers = [
      // .save("경로"), to_excel/to_csv/write_text("경로"), Path("경로").write_text(...)
      new RegExp(String.raw`\.(?:save|to_excel|to_csv|to_json|to_parquet|saveas)\(` + lit, "gi"),
      new RegExp(String.raw`["']([^"']+)["']\s*\)\s*\.(?:write_text|write_bytes|unlink|rename|replace|touch|rmdir|open)\(`, "gi"),
      // open("경로", "w"/"a"/"x"/"+"/"wb")
      new RegExp(String.raw`\bopen\(` + lit + String.raw`\s*,\s*r?["'][^"']*[wax+][^"']*["']`, "gi"),
      // shutil / os / node fs 의 변경 함수의 첫 인자 (이동·삭제·이름변경·쓰기)
      new RegExp(String.raw`\b(?:move|rmtree|remove|unlink|rename|renames|replace|writeFile(?:Sync)?|appendFile(?:Sync)?|rmSync|unlinkSync|renameSync|truncate(?:Sync)?|WriteAll\w+|Delete|Move|Create\w*)\(` + lit, "gi"),
    ];
    for (const re of writers) {
      let m;
      while ((m = re.exec(cmd))) if (isInData(m[1])) block(show(cmd));
    }
    // 복사류는 목적지(두 번째 문자열)가 data일 때만
    const copyRe = new RegExp(String.raw`\b(?:copy|copy2|copyfile|copytree|copyFile(?:Sync)?|cpSync|CopyTo)\(` + lit + String.raw`\s*,` + lit, "gi");
    let cm;
    while ((cm = copyRe.exec(cmd))) if (isInData(cm[2])) block(show(cmd));
  }

  process.exit(0);
});
