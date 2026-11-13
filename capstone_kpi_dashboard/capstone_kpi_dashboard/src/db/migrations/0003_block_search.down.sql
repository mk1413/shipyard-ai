-- 0003_block_search 되돌리기: 검색 인덱스만 지워진다. 원본 blocks 데이터는 그대로다.
DROP TRIGGER IF EXISTS blocks_au;
DROP TRIGGER IF EXISTS blocks_ad;
DROP TRIGGER IF EXISTS blocks_ai;
DROP TABLE IF EXISTS blocks_fts;
