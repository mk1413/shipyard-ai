'use strict';

const express = require('express');
const { requireApiLogin } = require('../middleware/require-api-login');
const { validateQuestion, toQuestionResponse, questionLocation } = require('../models/question');

/**
 * 질문 라우트 (T008). 순서: 로그인 확인 → JSON 읽기 → 검사 → 저장.
 * @param {{db: import('node:sqlite').DatabaseSync, sessionSecret: string}} deps
 */
function questionsRouter({ db, sessionSecret }) {
  const router = express.Router();

  router.post('/questions', requireApiLogin(sessionSecret), express.json(), (req, res) => {
    const checked = validateQuestion(req.body);
    if (!checked.ok) {
      res.status(400).json({ error: 'validation_error', fields: checked.fields });
      return;
    }

    const createdAt = new Date().toISOString();
    const info = db
      .prepare('INSERT INTO questions (title, body, created_at) VALUES (?, ?, ?)')
      .run(checked.value.title, checked.value.body, createdAt);

    const row = db
      .prepare('SELECT id, title, body, created_at FROM questions WHERE id = ?')
      .get(info.lastInsertRowid);

    res.status(201);
    res.location(questionLocation(row.id));
    res.json(toQuestionResponse(row));
  });

  return router;
}

module.exports = { questionsRouter };
