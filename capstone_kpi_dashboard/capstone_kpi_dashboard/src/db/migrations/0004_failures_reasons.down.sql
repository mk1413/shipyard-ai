-- 0004_failures_reasons 되돌리기: 고장 이력과 지연 사유 테이블을 지운다. 기존 생산, 설비, 블록 데이터는 그대로다.
DROP TABLE IF EXISTS block_delay_reasons;
DROP INDEX IF EXISTS idx_equipment_failures_equipment;
DROP INDEX IF EXISTS idx_equipment_failures_date;
DROP TABLE IF EXISTS equipment_failures;
