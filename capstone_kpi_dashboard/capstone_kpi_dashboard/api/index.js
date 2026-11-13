'use strict';

// Vercel 서버리스 진입점. Vercel이 src/app.js를 Express 진입점으로 잘못 고르지 않도록
// api/ 아래에 두고, 실제 앱은 src/server.js가 만든 Express 앱을 그대로 내보낸다.
module.exports = require('../src/server.js');
