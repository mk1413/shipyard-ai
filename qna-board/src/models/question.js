'use strict';

// Question 모델 (T007). DB에 의존하지 않는 순수 함수만 둔다. 저장은 T008에서 한다.

const TITLE_MAX = 200;

function isBlankOrNotString(v) {
  return typeof v !== 'string' || v.trim() === '';
}

/**
 * 질문 입력을 검사한다.
 * - title: 문자열, 앞뒤 공백을 자른 뒤 1자 이상 200자 이하 (글자 수는 코드 포인트 기준).
 * - body: 문자열, 앞뒤 공백을 자른 뒤 1자 이상.
 * @returns {{ok: true, value: {title: string, body: string}} | {ok: false, fields: string[]}}
 */
function validateQuestion(input) {
  const src = input && typeof input === 'object' ? input : {};
  const fields = [];

  const titleBad =
    isBlankOrNotString(src.title) || [...src.title.trim()].length > TITLE_MAX;
  if (titleBad) fields.push('title');

  if (isBlankOrNotString(src.body)) fields.push('body');

  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, value: { title: src.title.trim(), body: src.body.trim() } };
}

/** 응답에 내보낼 필드만 고른다. 작성자 정보 같은 다른 열은 빠진다 (원칙 3). */
function toQuestionResponse(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    created_at: row.created_at,
  };
}

function questionLocation(id) {
  return `/questions/${id}`;
}

module.exports = { TITLE_MAX, validateQuestion, toQuestionResponse, questionLocation };
