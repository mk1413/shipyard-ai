-- 0002_users: 간이 로그인 명단. 사번과 이름은 HMAC 해시로만 저장한다 (평문 저장 금지, 원칙 3).
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  employee_hash TEXT NOT NULL UNIQUE,
  name_hash     TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
