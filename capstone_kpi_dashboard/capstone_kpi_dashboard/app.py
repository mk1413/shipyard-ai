"""
조선소 생산 KPI 대시보드 (Streamlit)
실행: streamlit run app.py
"""
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from kpi_alerts import STATUS_ICON, TARGET, blocks_in_period, gap_text, kpi_status

st.set_page_config(page_title="조선소 생산 KPI 대시보드", page_icon="🚢", layout="wide")

DATA = Path(__file__).parent / "data"
PROCESSES = ["절단", "소조립", "중조립", "대조립", "도장", "탑재"]
TODAY = pd.Timestamp("2026-10-31")  # 데이터 기준일


# ------------------------------------------------------------------ 데이터 로드
@st.cache_data
def load():
    prod = pd.read_csv(DATA / "daily_production.csv", parse_dates=["date"])
    eq = pd.read_csv(DATA / "equipment.csv", parse_dates=["date"])
    blk = pd.read_csv(
        DATA / "blocks.csv",
        parse_dates=["planned_start", "planned_end", "actual_start", "actual_end"],
        dtype={"ship_no": str},
    )
    # 블록 지연 판정: 완료 후 계획보다 늦게 끝났거나, 미완료인데 계획 종료일을 넘긴 경우
    end_ref = blk["actual_end"].fillna(TODAY)
    started = blk["actual_start"].notna()
    blk["delay_days"] = ((end_ref - blk["planned_end"]).dt.days).where(started, 0).clip(lower=0)
    blk["status"] = "대기"
    blk.loc[started & blk["actual_end"].isna(), "status"] = "진행"
    blk.loc[blk["actual_end"].notna(), "status"] = "완료"
    blk.loc[blk["delay_days"] > 0, "status"] = blk.loc[blk["delay_days"] > 0, "status"] + "(지연)"
    return prod, eq, blk


prod, eq, blk = load()


def oee_calc(df):
    """OEE = 가동률 × 성능효율 × 양품률"""
    planned = df["planned_min"].sum()
    run = planned - df["downtime_min"].sum()
    avail = run / planned if planned else 0
    perf = (df["ideal_ct_min"] * df["total_cnt"]).sum() / run if run else 0
    qual = df["good_cnt"].sum() / df["total_cnt"].sum() if df["total_cnt"].sum() else 0
    return avail * 100, perf * 100, qual * 100, avail * perf * qual * 100


def kpis(p, e, b):
    achieve = p["actual_ton"].sum() / p["planned_ton"].sum() * 100
    defect = p["defect_cnt"].sum() / p["inspected_cnt"].sum() * 100
    oee = oee_calc(e)[3]
    done = b.dropna(subset=["actual_mh"])
    mh_eff = done["planned_mh"].sum() / done["actual_mh"].sum() * 100 if len(done) else 0
    return achieve, oee, defect, mh_eff


# ------------------------------------------------------------------ 사이드바 필터
st.sidebar.header("🔎 필터")
d_min, d_max = prod["date"].min().date(), prod["date"].max().date()
period = st.sidebar.date_input("기간", (d_min, d_max), min_value=d_min, max_value=d_max)
if isinstance(period, tuple) and len(period) == 2:
    start, end = map(pd.Timestamp, period)
else:
    start, end = pd.Timestamp(d_min), pd.Timestamp(d_max)
sel_proc = st.sidebar.multiselect("공정", PROCESSES, default=PROCESSES)
ships = sorted(blk["ship_no"].unique())
sel_ship = st.sidebar.multiselect("호선 (블록 현황에 적용)", ships, default=ships)
st.sidebar.caption(f"데이터 기준일: {TODAY.date()}  \n※ 교육용 가상 데이터")

P = prod[prod["date"].between(start, end) & prod["process"].isin(sel_proc)]
E = eq[eq["date"].between(start, end) & eq["process"].isin(sel_proc)]
B = blk[blk["ship_no"].isin(sel_ship) & blk["process"].isin(sel_proc)]

if P.empty:
    st.warning("선택한 조건에 해당하는 데이터가 없습니다.")
    st.stop()

# 비교 기준: 직전 동일 기간
span = end - start + pd.Timedelta(days=1)
P_prev = prod[prod["date"].between(start - span, start - pd.Timedelta(days=1)) & prod["process"].isin(sel_proc)]
E_prev = eq[eq["date"].between(start - span, start - pd.Timedelta(days=1)) & eq["process"].isin(sel_proc)]

# ------------------------------------------------------------------ 헤더 & KPI 카드
st.title("🚢 조선소 생산 KPI 대시보드")
st.caption(f"{start.date()} ~ {end.date()} · 공정 {len(sel_proc)}개 · 호선 {len(sel_ship)}척")

ach, oee, dfc, mh = kpis(P, E, blocks_in_period(B, start, end, TODAY))
if not P_prev.empty:
    prev_end = start - pd.Timedelta(days=1)
    ach_p, oee_p, dfc_p, _ = kpis(P_prev, E_prev, blocks_in_period(B, start - span, prev_end, TODAY))
    d_ach, d_oee, d_dfc = f"{ach-ach_p:+.1f}%p", f"{oee-oee_p:+.1f}%p", f"{dfc-dfc_p:+.2f}%p"
else:
    d_ach = d_oee = d_dfc = None
delayed_blocks = B.loc[B["delay_days"] > 0, "block_id"].nunique()

# KPI별 상태 (정상 🟢 / 주의 🟡 / 미달 🔴 / 데이터 없음 ⚪)
KPI_ROWS = [
    ("achieve", "생산계획 달성률", ach, lambda v: f"{v:.1f}%", f"{TARGET['achieve']}% 이상"),
    ("oee", "설비 종합효율(OEE)", oee, lambda v: f"{v:.1f}%", f"{TARGET['oee']}% 이상"),
    ("defect", "용접·검사 불량률", dfc, lambda v: f"{v:.2f}%", f"{TARGET['defect']}% 이하"),
    ("mh_eff", "맨아워 효율", mh, lambda v: f"{v:.1f}%", f"{TARGET['mh_eff']}% 이상"),
    ("delay", "지연 블록 수", delayed_blocks, lambda v: f"{int(v)}개", f"{TARGET['delay']}개 이하"),
]
statuses = {k: kpi_status(k, v) for k, _, v, _, _ in KPI_ROWS}
ic = {k: STATUS_ICON[s] for k, s in statuses.items()}

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric(f"{ic['achieve']} 생산계획 달성률", f"{ach:.1f}%", d_ach, help=f"실적 물량 ÷ 계획 물량 · 목표 {TARGET['achieve']}%")
c2.metric(f"{ic['oee']} 설비 종합효율(OEE)", f"{oee:.1f}%", d_oee, help=f"가동률×성능×양품률 · 목표 {TARGET['oee']}%")
c3.metric(f"{ic['defect']} 용접·검사 불량률", f"{dfc:.2f}%", d_dfc, delta_color="inverse", help=f"불량 ÷ 검사 · 목표 {TARGET['defect']}% 이하")
c4.metric(f"{ic['mh_eff']} 맨아워 효율", f"{mh:.1f}%", help=f"계획 MH ÷ 실적 MH · 목표 {TARGET['mh_eff']}%")
c5.metric(f"{ic['delay']} 지연 블록 수", f"{delayed_blocks}개", help="계획 종료일을 넘긴 공정이 하나라도 있는 블록")

# KPI별 경고: 미달은 error, 주의는 warning으로 항목마다 한 줄씩 표시
problems = [(k, name, v, fmt, tgt) for k, name, v, fmt, tgt in KPI_ROWS if statuses[k] in ("warn", "crit")]
for k, name, v, fmt, tgt in problems:
    msg = f"{ic[k]} **{name}** {fmt(v)} · 목표 {tgt} · 목표 대비 {gap_text(k, v)}"
    if statuses[k] == "crit":
        st.error(msg)
    else:
        st.warning(msg)
if not problems:
    st.success("✅ 모든 KPI가 목표를 충족하고 있습니다.")

# ------------------------------------------------------------------ 탭
def item_alert(key, value, text):
    """세부 항목 하나에 대한 경고. 정상이면 아무것도 표시하지 않는다."""
    s = kpi_status(key, value)
    if s in ("ok", "na"):
        return
    (st.error if s == "crit" else st.warning)(f"{STATUS_ICON[s]} {text}")


t1, t2, t3, t4 = st.tabs(["📈 생산실적", "🧱 블록 공정진척", "🔧 설비 OEE", "🧪 품질"])

with t1:
    daily = P.groupby("date")[["planned_ton", "actual_ton"]].sum().reset_index()
    daily["달성률"] = daily["actual_ton"] / daily["planned_ton"] * 100
    fig = go.Figure()
    fig.add_bar(x=daily["date"], y=daily["planned_ton"], name="계획(ton)", marker_color="#cbd5e1")
    fig.add_bar(x=daily["date"], y=daily["actual_ton"], name="실적(ton)", marker_color="#2563eb")
    fig.add_scatter(x=daily["date"], y=daily["달성률"], name="달성률(%)", yaxis="y2",
                    mode="lines+markers", line=dict(color="#dc2626"))
    fig.add_hline(y=TARGET["achieve"], line_dash="dot", line_color="#dc2626", yref="y2")
    fig.update_layout(
        title="일별 계획 대비 실적", barmode="overlay", height=420,
        yaxis=dict(title="물량(ton)"),
        yaxis2=dict(title="달성률(%)", overlaying="y", side="right", range=[40, 110]),
        legend=dict(orientation="h", y=1.1),
    )
    st.plotly_chart(fig, width="stretch")

    col1, col2 = st.columns(2)
    by_proc = P.groupby("process")[["planned_ton", "actual_ton"]].sum().reindex(sel_proc).reset_index()
    by_proc["달성률"] = (by_proc["actual_ton"] / by_proc["planned_ton"] * 100).round(1)
    for _, r in by_proc.iterrows():
        item_alert("achieve", r["달성률"], f"공정 **{r['process']}** 달성률 {r['달성률']:.1f}% · 목표 {TARGET['achieve']}% 미달")
    col1.plotly_chart(
        px.bar(by_proc, x="process", y="달성률", text="달성률", title="공정별 계획 달성률(%)",
               color="달성률", color_continuous_scale="RdYlGn", range_color=[80, 100])
        .add_hline(y=TARGET["achieve"], line_dash="dot")
        .update_layout(height=380, xaxis_title=None, coloraxis_showscale=False),
        width="stretch",
    )
    heat = P.assign(week=P["date"].dt.to_period("W").dt.start_time.dt.strftime("%m/%d주"))
    heat = heat.groupby(["process", "week"])[["actual_ton", "planned_ton"]].sum()
    heat = (heat["actual_ton"] / heat["planned_ton"] * 100).unstack().reindex(sel_proc)
    col2.plotly_chart(
        px.imshow(heat.round(0), text_auto=True, color_continuous_scale="RdYlGn", zmin=60, zmax=100,
                  title="공정 × 주차 달성률 히트맵(%)", aspect="auto")
        .update_layout(height=380, xaxis_title=None, yaxis_title=None),
        width="stretch",
    )

with t2:
    col1, col2 = st.columns([1, 2])
    status_cnt = B["status"].value_counts().reset_index()
    status_cnt.columns = ["상태", "건수"]
    col1.plotly_chart(
        px.pie(status_cnt, names="상태", values="건수", hole=0.5, title="블록-공정 상태",
               color="상태", color_discrete_map={"완료": "#16a34a", "진행": "#2563eb", "대기": "#94a3b8",
                                                 "완료(지연)": "#f59e0b", "진행(지연)": "#dc2626"})
        .update_layout(height=380),
        width="stretch",
    )
    ship_prog = B.groupby(["ship_no", "process"])["progress_pct"].mean().reset_index()
    col2.plotly_chart(
        px.bar(ship_prog, x="ship_no", y="progress_pct", color="process", barmode="group",
               category_orders={"process": PROCESSES}, title="호선·공정별 평균 진척률(%)")
        .update_layout(height=380, xaxis_title="호선", yaxis_title="진척률(%)"),
        width="stretch",
    )

    st.subheader("블록 공정 간트차트 (계획 vs 실적)")
    pick = st.selectbox("블록 선택", sorted(B["block_id"].unique()))
    g = B[B["block_id"] == pick]
    gantt = pd.concat([
        g.assign(구분="계획", 시작=g["planned_start"], 종료=g["planned_end"]),
        g.dropna(subset=["actual_start"]).assign(
            구분="실적", 시작=lambda x: x["actual_start"], 종료=lambda x: x["actual_end"].fillna(TODAY)),
    ])
    fig = px.timeline(gantt, x_start="시작", x_end="종료", y="process", color="구분",
                      color_discrete_map={"계획": "#cbd5e1", "실적": "#2563eb"},
                      category_orders={"process": PROCESSES})
    fig.update_layout(barmode="group", height=360, yaxis_title=None)
    fig.add_vline(x=TODAY, line_dash="dash", line_color="#dc2626")
    st.plotly_chart(fig, width="stretch")

    st.subheader("⏰ 지연 블록 TOP 10")
    top = (B[B["delay_days"] > 0].sort_values("delay_days", ascending=False)
           [["block_id", "ship_type", "process", "planned_end", "actual_end", "delay_days", "status"]].head(10))
    top.columns = ["블록", "선종", "공정", "계획종료", "실적종료", "지연일수", "상태"]
    st.dataframe(top, width="stretch", hide_index=True)

with t3:
    a, pf, q, o = oee_calc(E)
    c = st.columns(4)
    c[0].metric("가동률", f"{a:.1f}%")
    c[1].metric("성능효율", f"{pf:.1f}%")
    c[2].metric("양품률", f"{q:.1f}%")
    c[3].metric("OEE", f"{o:.1f}%")

    rows = [dict(equipment_id=k, 설비=g["equipment_type"].iloc[0],
                 **dict(zip(["가동률", "성능효율", "양품률", "OEE"], oee_calc(g))))
            for k, g in E.groupby("equipment_id")]
    eq_tbl = pd.DataFrame(rows).sort_values("OEE")
    for _, r in eq_tbl.iterrows():
        item_alert("oee", r["OEE"], f"설비 **{r['equipment_id']}** ({r['설비']}) OEE {r['OEE']:.1f}% · 목표 {TARGET['oee']}% 미달")
    col1, col2 = st.columns(2)
    col1.plotly_chart(
        px.bar(eq_tbl, y="equipment_id", x="OEE", orientation="h", text=eq_tbl["OEE"].round(1),
               color="OEE", color_continuous_scale="RdYlGn", range_color=[50, 85], title="설비별 OEE(%)",
               hover_data=["설비"])
        .add_vline(x=TARGET["oee"], line_dash="dot")
        .update_layout(height=400, yaxis_title=None, coloraxis_showscale=False),
        width="stretch",
    )
    down = E.groupby(["date", "equipment_id"])["downtime_min"].sum().reset_index()
    col2.plotly_chart(
        px.line(down, x="date", y="downtime_min", color="equipment_id", title="설비별 일 정지시간(분)")
        .update_layout(height=400, xaxis_title=None),
        width="stretch",
    )

with t4:
    col1, col2 = st.columns(2)
    q = P.groupby("date")[["defect_cnt", "inspected_cnt"]].sum().reset_index()
    q["불량률"] = q["defect_cnt"] / q["inspected_cnt"] * 100
    over = q[q["불량률"] > TARGET["defect"]]
    if not over.empty:
        worst = over.loc[over["불량률"].idxmax()]
        item_alert("defect", worst["불량률"],
                   f"불량률 목표 상한 초과 {len(over)}일 · 최고 {worst['불량률']:.2f}% ({worst['date']:%m/%d})")
    col1.plotly_chart(
        px.line(q, x="date", y="불량률", markers=True, title="일별 불량률 추이(%)")
        .add_hline(y=TARGET["defect"], line_dash="dot", line_color="#dc2626",
                   annotation_text="목표 상한")
        .update_layout(height=400, xaxis_title=None),
        width="stretch",
    )
    pq = P.groupby("process")[["defect_cnt", "rework_hr"]].sum().reindex(sel_proc).reset_index()
    pq = pq.sort_values("defect_cnt", ascending=False)
    pq["누적비율"] = pq["defect_cnt"].cumsum() / pq["defect_cnt"].sum() * 100
    fig = go.Figure()
    fig.add_bar(x=pq["process"], y=pq["defect_cnt"], name="불량 건수", marker_color="#f59e0b")
    fig.add_scatter(x=pq["process"], y=pq["누적비율"], name="누적 비율(%)", yaxis="y2",
                    mode="lines+markers", line=dict(color="#dc2626"))
    fig.update_layout(title="공정별 불량 파레토", height=400,
                      yaxis2=dict(overlaying="y", side="right", range=[0, 105]),
                      legend=dict(orientation="h", y=1.1))
    col2.plotly_chart(fig, width="stretch")
    st.metric("총 재작업 시간", f"{P['rework_hr'].sum():,.0f} 시간",
              help="불량 1건당 재작업 시간 합계 → 비용으로 환산하여 개선효과 제시 가능")

with st.expander("📄 원본 데이터 보기"):
    st.dataframe(P, width="stretch", hide_index=True)
