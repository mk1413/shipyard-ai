from pathlib import Path

from streamlit.testing.v1 import AppTest

APP = Path(__file__).resolve().parents[1] / "app.py"


def _messages(at):
    return [w.value for w in at.error] + [w.value for w in at.warning]


def test_app_runs_without_exception():
    at = AppTest.from_file(str(APP), default_timeout=60).run()
    assert not at.exception, [e.value for e in at.exception]
    assert len(at.metric) >= 5


def test_crane_incident_period_raises_alerts():
    # README 발견 포인트 1: 10/13~10/17 대조립 크레인 고장 구간
    at = AppTest.from_file(str(APP), default_timeout=60).run()
    at.sidebar.date_input[0].set_value(
        (__import__("datetime").date(2026, 10, 13), __import__("datetime").date(2026, 10, 17))
    ).run()
    assert not at.exception
    msgs = " ".join(_messages(at))
    assert "대조립" in msgs


def test_defect_period_raises_defect_alert():
    # README 발견 포인트 2: 9/14~9/19 소조립 불량률 상승
    import datetime as dt

    at = AppTest.from_file(str(APP), default_timeout=60).run()
    at.sidebar.date_input[0].set_value((dt.date(2026, 9, 14), dt.date(2026, 9, 19))).run()
    assert not at.exception
    msgs = " ".join(_messages(at))
    assert "불량률" in msgs
