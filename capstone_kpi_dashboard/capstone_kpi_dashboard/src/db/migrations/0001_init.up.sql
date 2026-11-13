-- 0001_init: 생산, 설비, 블록 세 테이블 (CSV 3종과 열 이름이 같다)

CREATE TABLE daily_production (
  id             INTEGER PRIMARY KEY,
  date           TEXT NOT NULL,
  process        TEXT NOT NULL,
  planned_ton    REAL NOT NULL,
  actual_ton     REAL NOT NULL,
  inspected_cnt  INTEGER NOT NULL,
  defect_cnt     INTEGER NOT NULL,
  rework_hr      REAL NOT NULL,
  UNIQUE (date, process)
);
CREATE INDEX idx_daily_production_date ON daily_production (date);
CREATE INDEX idx_daily_production_process ON daily_production (process);

CREATE TABLE equipment (
  id              INTEGER PRIMARY KEY,
  date            TEXT NOT NULL,
  equipment_id    TEXT NOT NULL,
  equipment_type  TEXT NOT NULL,
  process         TEXT NOT NULL,
  planned_min     INTEGER NOT NULL,
  downtime_min    REAL NOT NULL,
  ideal_ct_min    REAL NOT NULL,
  total_cnt       INTEGER NOT NULL,
  good_cnt        INTEGER NOT NULL,
  UNIQUE (date, equipment_id)
);
CREATE INDEX idx_equipment_date ON equipment (date);

CREATE TABLE blocks (
  id             INTEGER PRIMARY KEY,
  block_id       TEXT NOT NULL,
  ship_no        TEXT NOT NULL,
  ship_type      TEXT NOT NULL,
  process        TEXT NOT NULL,
  weight_ton     REAL NOT NULL,
  planned_start  TEXT NOT NULL,
  planned_end    TEXT NOT NULL,
  actual_start   TEXT,
  actual_end     TEXT,
  planned_mh     REAL NOT NULL,
  actual_mh      REAL,
  progress_pct   REAL NOT NULL,
  UNIQUE (block_id, process)
);
CREATE INDEX idx_blocks_ship_no ON blocks (ship_no);
