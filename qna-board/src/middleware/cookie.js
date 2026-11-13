'use strict';

const crypto = require('node:crypto');

const COOKIE_NAME = 'kpi_session';

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64url');
}

/**
 * 세션 토큰을 만든다. 형식은 base64url(JSON 내용) + '.' + HMAC 서명이다.
 * 내용에는 사용자 id와 만료 시각(ms)만 넣는다. 사번과 이름은 넣지 않는다 (원칙 3).
 */
function signToken(payload, secret) {
  if (!secret) throw new Error('세션 비밀키가 없습니다 (SESSION_SECRET)');
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

/**
 * 토큰을 검증한다. 서명이 맞고 만료되지 않았으면 내용을, 아니면 null을 돌려준다. 예외를 던지지 않는다.
 */
function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !secret) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = Buffer.from(sign(body, secret), 'utf8');
  const given = Buffer.from(sig, 'utf8');
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
  return payload;
}

/** Cookie 헤더에서 이름이 같은 값을 꺼낸다. */
function readCookie(header, name) {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return undefined;
}

module.exports = { COOKIE_NAME, signToken, verifyToken, readCookie };
