-- 0003_block_search: 블록 검색용 FTS5 인덱스 (trigram: 한글 부분 일치, 3자 이상 질의)
-- 원본은 blocks 테이블이다. 인덱스는 트리거로 함께 갱신한다.
CREATE VIRTUAL TABLE blocks_fts USING fts5(
  block_id, ship_no, ship_type, process,
  content='blocks', content_rowid='id', tokenize='trigram'
);

CREATE TRIGGER blocks_ai AFTER INSERT ON blocks BEGIN
  INSERT INTO blocks_fts (rowid, block_id, ship_no, ship_type, process)
  VALUES (new.id, new.block_id, new.ship_no, new.ship_type, new.process);
END;

CREATE TRIGGER blocks_ad AFTER DELETE ON blocks BEGIN
  INSERT INTO blocks_fts (blocks_fts, rowid, block_id, ship_no, ship_type, process)
  VALUES ('delete', old.id, old.block_id, old.ship_no, old.ship_type, old.process);
END;

CREATE TRIGGER blocks_au AFTER UPDATE ON blocks BEGIN
  INSERT INTO blocks_fts (blocks_fts, rowid, block_id, ship_no, ship_type, process)
  VALUES ('delete', old.id, old.block_id, old.ship_no, old.ship_type, old.process);
  INSERT INTO blocks_fts (rowid, block_id, ship_no, ship_type, process)
  VALUES (new.id, new.block_id, new.ship_no, new.ship_type, new.process);
END;

INSERT INTO blocks_fts (blocks_fts) VALUES ('rebuild');
