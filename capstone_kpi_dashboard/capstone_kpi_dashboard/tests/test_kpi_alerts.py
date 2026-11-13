import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from kpi_alerts import TARGET, WARN_MARGIN, blocks_in_period, gap_text, kpi_status  # noqa: E402

TODAY = pd.Timestamp("2026-10-31")
START, END = pd.Timestamp("2026-10-13"), pd.Timestamp("2026-10-17")


def _blk(**kw):
    base = dict(actual_start=pd.NaT, actual_end=pd.NaT)
    base.update(kw)
    return pd.DataFrame([base])


def test_block_overlapping_period_is_included():
    # 10/10 ~ 10/14 작업: 기간과 겹침
    b = _blk(actual_start=pd.Timestamp("2026-10-10"), actual_end=pd.Timestamp("2026-10-14"))
    assert len(blocks_in_period(b, START, END, TODAY)) == 1


def test_block_entirely_outside_period_is_excluded():
    b = _blk(actual_start=pd.Timestamp("2026-10-01"), actual_end=pd.Timestamp("2026-10-05"))
    assert len(blocks_in_period(b, START, END, TODAY)) == 0


def test_block_not_started_is_excluded():
    assert len(blocks_in_period(_blk(), START, END, TODAY)) == 0


def test_unfinished_block_uses_today_as_end():
    # 진행 중(종료 없음): 기준일까지 기간과 겹치므로 포함
    b = _blk(actual_start=pd.Timestamp("2026-10-15"))
    assert len(blocks_in_period(b, START, END, TODAY)) == 1
    b2 = _blk(actual_start=pd.Timestamp("2026-10-20"))
    assert len(blocks_in_period(b2, START, END, TODAY)) == 0


@pytest.mark.parametrize("key", ["achieve", "oee", "mh_eff"])
def test_higher_is_better_boundaries(key):
    t, m = TARGET[key], WARN_MARGIN[key]
    assert kpi_status(key, t) == "ok"            # 목표와 정확히 같음
    assert kpi_status(key, t + 10) == "ok"
    assert kpi_status(key, t - 0.01) == "warn"   # 주의 구간 바로 아래
    assert kpi_status(key, t - m) == "warn"      # 주의 구간 하한 (포함)
    assert kpi_status(key, t - m - 0.01) == "crit"


def test_defect_rate_lower_is_better():
    t, m = TARGET["defect"], WARN_MARGIN["defect"]
    assert kpi_status("defect", 0.0) == "ok"
    assert kpi_status("defect", t) == "ok"       # 상한과 같으면 정상
    assert kpi_status("defect", t + 0.01) == "warn"
    assert kpi_status("defect", t + m) == "warn"
    assert kpi_status("defect", t + m + 0.01) == "crit"


def test_delay_count_crit_from_five():
    assert kpi_status("delay", 0) == "ok"
    assert kpi_status("delay", 1) == "warn"
    assert kpi_status("delay", 4) == "warn"
    assert kpi_status("delay", 5) == "crit"


@pytest.mark.parametrize("bad", [None, float("nan")])
def test_missing_value_is_na(bad):
    assert kpi_status("achieve", bad) == "na"


def test_gap_text_signed():
    assert gap_text("achieve", 91.2) == "-3.8%p"
    assert gap_text("defect", 3.5) == "+0.5%p"
    assert gap_text("delay", 5) == "+5건"
