"""KPI 목표값과 상태(정상/주의/미달) 판정 로직. streamlit에 의존하지 않는다."""
import math

# KPI 목표값 (발표 때 근거를 함께 설명)
TARGET = {"achieve": 95.0, "oee": 75.0, "defect": 3.0, "mh_eff": 95.0, "delay": 0}

# 주의(warn) 구간 폭: 목표에서 이 값 이내이면 주의, 그보다 나쁘면 미달(crit)
WARN_MARGIN = {"achieve": 3.0, "oee": 5.0, "defect": 0.5, "mh_eff": 3.0, "delay": 4}

# True면 값이 클수록 좋음, False면 작을수록 좋음
HIGHER_IS_BETTER = {"achieve": True, "oee": True, "defect": False, "mh_eff": True, "delay": False}

STATUS_ICON = {"ok": "🟢", "warn": "🟡", "crit": "🔴", "na": "⚪"}
STATUS_LABEL = {"ok": "정상", "warn": "주의", "crit": "미달", "na": "데이터 없음"}


def kpi_status(key, value):
    """KPI 값을 'ok' / 'warn' / 'crit' / 'na'(데이터 없음)로 판정한다."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "na"
    target = TARGET[key]
    margin = WARN_MARGIN[key]
    if HIGHER_IS_BETTER[key]:
        if value >= target:
            return "ok"
        if value >= target - margin:
            return "warn"
        return "crit"
    if value <= target:
        return "ok"
    if value <= target + margin:
        return "warn"
    return "crit"


def blocks_in_period(b, start, end, today):
    """실적 기간이 선택 기간과 겹치는 블록-공정 행만 남긴다.

    - 실적 시작일이 없는 행(대기)은 제외한다.
    - 실적 종료일이 없는 행(진행 중)은 기준일(today)까지를 실적 기간으로 본다.
    """
    started = b["actual_start"].notna()
    end_ref = b["actual_end"].fillna(today)
    mask = started & (b["actual_start"] <= end) & (end_ref >= start)
    return b[mask]


def gap_text(key, value):
    """목표 대비 차이를 사람이 읽을 문자열로 만든다. 예: '−3.8%p'"""
    diff = value - TARGET[key]
    if key == "delay":
        return f"{diff:+.0f}건"
    return f"{diff:+.1f}%p"
