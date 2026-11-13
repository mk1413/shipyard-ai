-- 0001_questions_answers 되돌리기: 질문과 답변 데이터가 모두 삭제된다.
DROP INDEX IF EXISTS idx_answers_question;
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS questions;
