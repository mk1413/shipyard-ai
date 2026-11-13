-- 0001_init 되돌리기: 생산 데이터가 삭제된다. CSV에서 다시 적재한다.
DROP TABLE IF EXISTS blocks;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS daily_production;
