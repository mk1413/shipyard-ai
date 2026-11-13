'use strict';

// libsql 결과(rows 배열 + columns)를 { 열이름: 값 } 객체 배열로 바꾼다.
function plain(rs) {
  return rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])));
}

/** SELECT 결과 전체를 객체 배열로 돌려준다. db는 클라이언트나 트랜잭션 모두 가능하다. */
async function all(db, sql, args = []) {
  return plain(await db.execute({ sql, args }));
}

/** SELECT 결과 첫 행을 돌려준다. 없으면 undefined. */
async function get(db, sql, args = []) {
  return (await all(db, sql, args))[0];
}

module.exports = { all, get, plain };
