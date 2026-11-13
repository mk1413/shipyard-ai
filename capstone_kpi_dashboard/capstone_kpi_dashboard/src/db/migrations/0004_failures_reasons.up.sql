-- 0004_failures_reasons: 설비 고장 이력과 블록 지연 사유 (가상 데이터, data/*.csv에서 적재)
CREATE TABLE equipment_failures (
  id              INTEGER PRIMARY KEY,
  failure_id      TEXT NOT NULL UNIQUE,
  date            TEXT NOT NULL,
  equipment_id    TEXT NOT NULL,
  equipment_type  TEXT NOT NULL,
  process         TEXT NOT NULL,
  duration_min    INTEGER NOT NULL,
  cause           TEXT NOT NULL
);
CREATE INDEX idx_equipment_failures_date ON equipment_failures (date);
CREATE INDEX idx_equipment_failures_equipment ON equipment_failures (equipment_id);

CREATE TABLE block_delay_reasons (
  block_id    TEXT NOT NULL,
  process     TEXT NOT NULL,
  reason      TEXT NOT NULL,
  delay_days  INTEGER NOT NULL,
  PRIMARY KEY (block_id, process)
);
