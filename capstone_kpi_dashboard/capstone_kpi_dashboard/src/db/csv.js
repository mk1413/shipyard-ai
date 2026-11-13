'use strict';

/**
 * 단순 CSV 파서. BOM 제거, CRLF/LF, 큰따옴표 안의 쉼표와 "" 이스케이프를 처리한다.
 * 첫 줄은 열 이름으로 쓰고, 각 행을 객체로 돌려준다. 빈 줄은 무시한다.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0] === ''));
  if (nonEmpty.length === 0) return [];
  const [header, ...body] = nonEmpty;
  return body.map((cells) => {
    const obj = {};
    header.forEach((name, idx) => {
      obj[name] = cells[idx] === undefined ? '' : cells[idx];
    });
    return obj;
  });
}

module.exports = { parseCsv };
