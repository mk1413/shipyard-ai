-- 0001_questions_answers: 질문과 답변 (T004)
CREATE TABLE questions (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE answers (
  id          INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  is_accepted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_answers_question ON answers (question_id);
