"""
조선소 생산 KPI 대시보드용 가상 데이터 생성기
- 기간: 2026-09-01 ~ 2026-10-31 (61일)
- 생성 파일 (data/ 폴더)
    1) daily_production.csv : 일자별·공정별 계획/실적 물량(ton), 검사/불량, 재작업시간
    2) equipment.csv        : 일자별·설비별 가동/정지 시간, 생산수량 (OEE 계산용)
    3) blocks.csv           : 블록별 공정 계획/실적 일정, 맨아워 (진척·지연 분석용)

※ 발표 스토리를 위해 의도적으로 넣은 이벤트
    - 10/13~10/17 : 대조립 공장 골리앗 크레인(CR-02) 고장 → 대조립 실적 급감, 블록 지연 증가
    - 9월 셋째 주 : 신규 용접사 투입으로 소조립 용접 불량률 일시 상승
실행: python generate_data.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

rng = np.random.default_rng(2026)
OUT = Path(__file__).parent / "data"
OUT.mkdir(exist_ok=True)

DATES = pd.date_range("2026-09-01", "2026-10-31", freq="D")
WORKDAYS = DATES[DATES.dayofweek < 6]  # 일요일 휴무, 토요일 특근

PROCESSES = ["절단", "소조립", "중조립", "대조립", "도장", "탑재"]
# 공정별 일 계획 물량(ton)
PLAN_TON = {"절단": 420, "소조립": 380, "중조립": 350, "대조립": 330, "도장": 300, "탑재": 280}

CRANE_DOWN = pd.date_range("2026-10-13", "2026-10-17")
NEW_WELDER = pd.date_range("2026-09-14", "2026-09-19")

# ---------------------------------------------------------------- 1) 일일 생산실적
rows = []
for d in WORKDAYS:
    sat = d.dayofweek == 5
    for p in PROCESSES:
        plan = PLAN_TON[p] * (0.6 if sat else 1.0)
        rate = rng.normal(0.96, 0.05)
        if p == "대조립" and d in CRANE_DOWN:
            rate = rng.normal(0.55, 0.06)
        if p == "탑재" and d in CRANE_DOWN + pd.Timedelta(days=3):
            rate = rng.normal(0.75, 0.05)  # 후공정 파급
        actual = max(plan * rate, 0)

        inspected = int(rng.integers(40, 70))
        defect_rate = rng.normal(0.025, 0.008)
        if p == "소조립" and d in NEW_WELDER:
            defect_rate = rng.normal(0.07, 0.01)
        if p in ("절단", "도장"):
            defect_rate *= 0.6
        defects = int(max(round(inspected * max(defect_rate, 0)), 0))
        rows.append(
            dict(
                date=d.date(),
                process=p,
                planned_ton=round(plan, 1),
                actual_ton=round(actual, 1),
                inspected_cnt=inspected,
                defect_cnt=defects,
                rework_hr=round(defects * rng.uniform(1.5, 3.5), 1),
            )
        )
pd.DataFrame(rows).to_csv(OUT / "daily_production.csv", index=False, encoding="utf-8-sig")

# ---------------------------------------------------------------- 2) 설비 가동
EQUIP = [
    ("CT-01", "플라즈마 절단기", "절단"),
    ("CT-02", "플라즈마 절단기", "절단"),
    ("WR-01", "용접로봇", "소조립"),
    ("WR-02", "용접로봇", "중조립"),
    ("CR-01", "골리앗 크레인", "대조립"),
    ("CR-02", "골리앗 크레인", "대조립"),
    ("PB-01", "도장 부스", "도장"),
    ("CR-03", "골리앗 크레인", "탑재"),
]
rows = []
for d in WORKDAYS:
    planned_min = 480 if d.dayofweek == 5 else 600
    for eid, etype, proc in EQUIP:
        down = rng.gamma(2, 12)
        if eid == "CR-02" and d in CRANE_DOWN:
            down = planned_min * rng.uniform(0.8, 1.0)
        down = min(down, planned_min)
        run = planned_min - down
        ideal_ct = 2.0  # 분/단위작업
        perf = np.clip(rng.normal(0.9, 0.04), 0.6, 1.0)
        total = int(run / ideal_ct * perf)
        good = int(total * np.clip(rng.normal(0.975, 0.01), 0.9, 1.0))
        rows.append(
            dict(
                date=d.date(),
                equipment_id=eid,
                equipment_type=etype,
                process=proc,
                planned_min=planned_min,
                downtime_min=round(down, 1),
                ideal_ct_min=ideal_ct,
                total_cnt=total,
                good_cnt=good,
            )
        )
pd.DataFrame(rows).to_csv(OUT / "equipment.csv", index=False, encoding="utf-8-sig")

# ---------------------------------------------------------------- 3) 블록 공정 일정
SHIPS = {"2401": "LNG운반선", "2402": "LNG운반선", "2403": "컨테이너선", "2404": "원유운반선"}
STAGE_DAYS = {"절단": 3, "소조립": 5, "중조립": 6, "대조립": 8, "도장": 5, "탑재": 2}
TODAY = pd.Timestamp("2026-10-31")
rows = []
for ship, stype in SHIPS.items():
    for b in range(1, 16):
        block_id = f"{ship}-B{b:02d}"
        weight = round(rng.uniform(120, 450), 0)
        start = pd.Timestamp("2026-08-20") + pd.Timedelta(days=int(rng.integers(0, 65)))
        plan_cursor = start
        act_cursor = start
        for p in PROCESSES:
            dur = STAGE_DAYS[p]
            p_start, p_end = plan_cursor, plan_cursor + pd.Timedelta(days=dur)
            slip = int(rng.choice([0] * 12 + [1, 1, 2]))
            if p == "대조립" and (act_cursor <= CRANE_DOWN[-1]) and (act_cursor + pd.Timedelta(days=dur) >= CRANE_DOWN[0]):
                slip += int(rng.integers(3, 6))
            a_start = act_cursor
            a_end = a_start + pd.Timedelta(days=dur + slip)
            planned_mh = round(weight * {"절단": 0.8, "소조립": 2.5, "중조립": 3.0, "대조립": 3.5, "도장": 1.5, "탑재": 1.0}[p], 0)
            if a_start > TODAY:
                a_start_v, a_end_v, actual_mh, prog = None, None, None, 0
            elif a_end > TODAY:
                a_start_v, a_end_v = a_start.date(), None
                prog = round(min((TODAY - a_start).days / (dur + slip) * 100, 95), 0)
                actual_mh = round(planned_mh * prog / 100 * rng.normal(1.05, 0.06), 0)
            else:
                a_start_v, a_end_v, prog = a_start.date(), a_end.date(), 100
                actual_mh = round(planned_mh * rng.normal(1.04 + slip * 0.03, 0.06), 0)
            rows.append(
                dict(
                    block_id=block_id,
                    ship_no=ship,
                    ship_type=stype,
                    process=p,
                    weight_ton=weight,
                    planned_start=p_start.date(),
                    planned_end=p_end.date(),
                    actual_start=a_start_v,
                    actual_end=a_end_v,
                    planned_mh=planned_mh,
                    actual_mh=actual_mh,
                    progress_pct=prog,
                )
            )
            plan_cursor = p_end + pd.Timedelta(days=1)  # 공정 간 1일 여유(버퍼)
            act_cursor = a_end
pd.DataFrame(rows).to_csv(OUT / "blocks.csv", index=False, encoding="utf-8-sig")

print("생성 완료:", *[f.name for f in sorted(OUT.glob("*.csv"))])
