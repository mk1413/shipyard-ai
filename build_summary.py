# summary.xlsx 생성 스크립트 (CLAUDE.md 데이터 처리 규칙 기준)
# 사용: uv run -q --with openpyxl python -I build_summary.py [weekly-qc 폴더] [로그파일]
#   폴더를 생략하면 이 스크립트가 있는 폴더, 로그를 생략하면 %TEMP%\build_summary.log
#   보고 기간은 아래 START, END를 바꿔서 정합니다.
import sys, re, os, tempfile, datetime as dt, collections
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, Reference

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
LOG = open(sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), 'build_summary.log'), 'w', encoding='utf-8')
def log(*a): print(*a, file=LOG)

START, END = dt.date(2026, 11, 2), dt.date(2026, 11, 8)
DEPTS = [('조립팀', '조립팀_자주검사기록.xlsx'),
         ('품질팀(도장)', '품질팀_도장검사기록.xlsx'),
         ('품질팀(선각)', '품질팀_선각검사기록.xlsx')]
HIDDEN_EXCLUDE = '삭제예정_입력오류'
DFT_MIN = 250

COLS = {  # 규칙 4: 열 이름으로 찾음 (판정 열은 '결과' / '판정')
    'date': ['날짜', '검사일'], 'ho': ['호선'], 'blk': ['블록', '블록번호'],
    'item': ['검사항목', '항목'], 'judge': ['결과', '판정'],
    'time': ['소요시간(분)', '시간'], 'note': ['비고'],
}
JUDGE = {'합격': '합격', 'OK': '합격', '합': '합격',
         '불합격': '불합격', 'NG': '불합격', '불': '불합격'}

class Stop(Exception): pass

def norm_date(v):
    if isinstance(v, dt.datetime): return v.date()
    if isinstance(v, dt.date): return v
    s = str(v).strip()
    m = re.fullmatch(r'(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})', s)
    if m: return dt.date(*map(int, m.groups()))
    m = re.fullmatch(r'(\d{1,2})/(\d{1,2})', s)
    if m: return dt.date(START.year, int(m[1]), int(m[2]))
    raise Stop(f'날짜 형식을 알 수 없음: {v!r}')

def norm_ho(v): return str(v).strip().replace('-', '').upper()
def norm_blk(v): return str(v).strip().replace('-', '').upper()

def read_sheet(dept, fname, ws):
    hdr_row, hdr = None, None
    for r in range(1, 6):
        vals = [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]
        names = [str(v).strip() if v is not None else '' for v in vals]
        if any(n in COLS['date'] for n in names):
            hdr_row, hdr = r, {n: i + 1 for i, n in enumerate(names) if n}
            break
    if hdr is None: raise Stop(f'{fname}/{ws.title}: 머리글 행을 못 찾음')
    col = {}
    for k, cands in COLS.items():
        col[k] = next((hdr[c] for c in cands if c in hdr), None)
    col['dft'] = next((i for n, i in hdr.items() if 'DFT' in n), None)
    for k in ('date', 'ho', 'blk', 'item', 'judge'):
        if col[k] is None: raise Stop(f'{fname}/{ws.title}: {k} 열을 못 찾음 (머리글 {list(hdr)})')
    log(f'{fname}/{ws.title}: 머리글 {hdr_row}행, 열 {col}')
    rows = []
    for r in range(hdr_row + 1, ws.max_row + 1):
        g = lambda k: ws.cell(r, col[k]).value if col.get(k) else None
        if all(ws.cell(r, c).value is None for c in range(1, ws.max_column + 1)): continue
        jr = g('judge')
        if jr is None or str(jr).strip() == '':
            raise Stop(f'{fname}/{ws.title}/{r}행: 판정 값이 비어 있음')
        j = JUDGE.get(str(jr).strip())
        if j is None: raise Stop(f'{fname}/{ws.title}/{r}행: 규칙에 없는 판정 값 {jr!r}')
        rows.append(dict(dept=dept, file=fname, sheet=ws.title, hidden=ws.sheet_state != 'visible',
                         row=r, date=norm_date(g('date')), ho=norm_ho(g('ho')), blk=norm_blk(g('blk')),
                         blk_raw=g('blk'), ho_raw=g('ho'), item=str(g('item')).strip(),
                         judge=j, judge_raw=jr, time=g('time'),
                         note=str(g('note')).strip() if g('note') else '', dft=g('dft'),
                         has_note_col=col['note'] is not None))
    return rows

# ---------- 읽기 ----------
recs, sheets_seen = [], []
for dept, fname in DEPTS:
    wb = openpyxl.load_workbook(os.path.join(ROOT, 'data', fname))
    for ws in wb.worksheets:
        sheets_seen.append((fname, ws.title, ws.sheet_state))
        recs += read_sheet(dept, fname, ws)
log('시트:', sheets_seen)

def ref(x): return f"{x['file']} / {x['sheet']} / {x['row']}행"
def key(x): return (x['dept'], x['ho'], x['blk'], x['item'])
def after(a, b): return (b['date'], b['row']) > (a['date'], a['row'])

visible = [x for x in recs if not x['hidden']]
hidden = [x for x in recs if x['hidden']]
inper = [x for x in visible if START <= x['date'] <= END]
before = [x for x in visible if x['date'] < START]
afterp = [x for x in visible if x['date'] > END]

checks = []  # 확인필요: (구분, 부서, 근거, 내용, 숫자 영향, 처리)
def chk(*a): checks.append(a)

# ---------- 불합격 판단 (규칙 10, 11) ----------
def classify(f):
    later = [y for y in visible if key(y) == key(f) and after(f, y) and y['judge'] == '합격']
    re_ = [y for y in later if '재검사' in y['note']]
    nonote = [y for y in later if '재검사' not in y['note']]
    return re_, nonote

fails = []
for f in [x for x in inper if x['judge'] == '불합격']:
    re_, nonote = classify(f)
    if re_:
        st, basis = '조치완료', '재검사 합격: ' + ', '.join(f"{y['row']}행({y['date']:%m/%d})" for y in re_)
        if nonote:
            chk('비고 없는 후속 합격(조치완료 건)', f['dept'], f"{f['file']} / {f['sheet']} / {f['row']}→{','.join(str(y['row']) for y in nonote)}행",
                f"{f['row']}행 불합격 뒤 비고 없이 합격({', '.join(str(y['row']) for y in nonote)}행). 이후 재검사 합격({re_[0]['row']}행)이 있어 조치완료",
                '숫자 영향 없음', '재검사였는지 확인')
    else:
        st = '미해결'
        basis = '재검사 합격 행 없음'
        if nonote:
            st = '미해결(확인 필요)'
            basis = '비고 없이 합격: ' + ', '.join(f"{y['row']}행({y['date']:%m/%d})" for y in nonote)
            chk('비고 없는 후속 합격', f['dept'], f"{f['file']} / {f['sheet']} / {f['row']}→{','.join(str(y['row']) for y in nonote)}행",
                f"{f['row']}행 불합격({f['date']:%m/%d} {f['ho']} {f['blk']} {f['item']}) 뒤 비고 없이 합격 → 재검사였는지 확인 필요",
                '재검사로 확인되면 미해결 1건 감소', '미해결로 셈')
    if not f['has_note_col']:
        basis += ' (원본에 비고 열 없음)'
    fails.append(dict(f, status=st, basis=basis, resolved_by=re_))

# ---------- 집계 ----------
summary = []
for dept, fname in DEPTS:
    I = [x for x in inper if x['dept'] == dept]
    F = [x for x in fails if x['dept'] == dept]
    U = [x for x in F if x['status'] != '조치완료']
    rr = f"{min(x['row'] for x in I)}~{max(x['row'] for x in I)}행"
    summary.append(dict(dept=dept, file=fname, sheet=I[0]['sheet'], n=len(I), f=len(F), u=len(U),
                        n_ref=f"{fname} / {I[0]['sheet']} / {rr}",
                        f_ref=', '.join(str(x['row']) for x in F) + '행',
                        u_ref=', '.join(str(x['row']) for x in U) + '행'))
    log(dept, len(I), len(F), len(U))

# ---------- 이월 (규칙 14) ----------
carry = []
for f in [x for x in before if x['judge'] == '불합격']:
    re_, nonote = classify(f)
    if re_:
        cat = '이월 조치완료'
    elif nonote:
        cat = '재검사였는지 확인 필요'
    else:
        cat = '이월 미조치 의심'
    carry.append((f, cat, nonote))
    chk(cat, f['dept'], ref(f), f"기간 직전 {f['date']:%m/%d} 불합격 ({f['ho']} {f['blk']} {f['item']})"
        + (f" → 기간 내 {', '.join(str(y['row']) for y in nonote)}행에 비고 없이 합격" if nonote else ' → 이후 기록 없음'),
        '기간 내 집계에 넣지 않음', '따로 표시')

# ---------- DFT (규칙 12) ----------
dft_low = [x for x in inper if x['dft'] is not None and isinstance(x['dft'], (int, float)) and x['dft'] < DFT_MIN and x['judge'] == '합격']
for x in dft_low:
    same = [y for y in inper if key(y) == key(x) and y['date'] == x['date'] and y['row'] != x['row'] and y['dft'] is not None]
    extra = f" 같은 날 {', '.join(str(y['row'])+'행('+str(y['dft'])+')' for y in same)}에서 다시 잼 → 재측정이었을 수 있음" if same else ''
    chk('DFT 기준 미달 합격', x['dept'], ref(x), f"DFT {x['dft']}μm < {DFT_MIN}인데 '합격' ({x['ho']} {x['blk']}).{extra}",
        '기준대로면 불합격 +1', '원본 판정대로 셈')
dept_paint = next(s for s in summary if s['dept'] == '품질팀(도장)')
chk('비고 열 없음', '품질팀(도장)', f"{dept_paint['file']} / {dept_paint['sheet']} / 머리글",
    '도장 파일에는 비고 열이 없어 "재검사" 합격을 확인할 수 없음 → 불합격이 모두 미해결로 나옴',
    f"도장 미해결 {dept_paint['u']}건은 판단 근거 없음", '요약에 명시')

# ---------- 중복 의심 (규칙 13) ----------
def tnorm(t): return None if t is None else str(t).strip()
dups, near = [], []
grp = collections.defaultdict(list)
for x in inper: grp[(x['dept'], x['date'], x['ho'], x['blk'], x['item'])].append(x)
for k, v in grp.items():
    for i in range(len(v)):
        for j in range(i + 1, len(v)):
            a, b = v[i], v[j]
            ta, tb = tnorm(a['time']), tnorm(b['time'])
            if ta == tb: dups.append((a, b, '시간이 같음'))
            elif ta == '-' or tb == '-': dups.append((a, b, "시간만 '-'"))
            else: near.append((a, b))
for a, b, why in dups:
    chk('중복 의심', a['dept'], f"{a['file']} / {a['sheet']} / {a['row']}/{b['row']}행",
        f"{a['date']:%m/%d} {a['ho']} {a['blk']} {a['item']}, {why} (시간 {a['time']}/{b['time']}, 판정 {a['judge']}/{b['judge']})",
        '중복이면 검사 -1' + (', 불합격 -1' if b['judge'] == '불합격' else ''), '둘 다 셈, 사람이 판단')
for a, b in near:
    chk('참고: 시간만 다른 같은 검사', a['dept'], f"{a['file']} / {a['sheet']} / {a['row']}/{b['row']}행",
        f"{a['date']:%m/%d} {a['ho']} {a['blk']} {a['item']}, 시간 {a['time']}/{b['time']}, 판정 {a['judge']}/{b['judge']}",
        '규칙 13 중복 아님', '둘 다 셈')

# ---------- 숨김 시트 (규칙 3) ----------
hid_f = [x for x in hidden if x['judge'] == '불합격']
sg = next(s for s in summary if s['dept'] == '품질팀(선각)')
chk('숨김 시트 제외', '품질팀(선각)', f"{hidden[0]['file']} / {HIDDEN_EXCLUDE} / {hidden[0]['row']}~{hidden[-1]['row']}행",
    f"숨김 시트 {len(hidden)}행 제외 (그중 불합격 {len(hid_f)}건: {', '.join(str(x['row']) for x in hid_f)}행)",
    f"넣으면 선각 검사 {sg['n']}→{sg['n']+len(hidden)}, 불합격 {sg['f']}→{sg['f']+len(hid_f)}", '집계하지 않음')

# ---------- 원본 밖 자료: 현장점검표 사진 (규칙 3) ----------
PHOTO = '현장점검표_사진.jpg'
photo_items = [  # 사진 판독 (조립2팀, H2701, B13, '11/7(금)')
    (1, '취부 간격(갭)', '2~4 mm', '3', '합', '', False),
    (2, '치수 검사', '±3 mm', '+2', '합', '', False),
    (3, '용접 외관', '언더컷 없음', '-', '불→합 정정', '재검 14:30 OK', False),
    (4, '각변형', '6 mm 이하', '7', '합', '', True),
    (5, '취부 간격(갭)', '2~4 mm', '4.5', '합', '반장님 확인', True),
    (6, '치수 검사', '±3 mm', '-1', '합', '블록 (판독 불가) 도 같이 봄', False),
]
sa = next(s for s in summary if s['dept'] == '조립팀')
chk('원본 밖 자료: 엑셀에 없는 검사', '조립팀', f'{PHOTO} (조립2팀 H2701 B13 11/7) ↔ 조립팀_자주검사기록.xlsx / 검사기록 / 62~79행',
    '현장점검표 6건이 엑셀에 없음 (엑셀 11/7에 H2701 B13 행 없음)',
    f"넣으면 조립팀 검사 {sa['n']}→{sa['n']+6} 이상, 불합격 {sa['f']}→{sa['f']+1}(원본 판정)~{sa['f']+3}(측정 기준)",
    '집계하지 않음, 사람이 판단')
chk('원본 밖 자료: 판정 정정', '조립팀', f'{PHOTO} / 3번 용접 외관', "'불'을 지우고 '합'으로 정정, 비고 '재검 14:30 OK'",
    '엑셀에 없는 불합격 1건 + 재검사 1건', '표시만')
chk('원본 밖 자료: 기준 벗어난 합', '조립팀', f'{PHOTO} / 4번 각변형', '측정 7 mm, 기준 6 mm 이하인데 합', '측정 기준이면 불합격 +1', '표시만')
chk('원본 밖 자료: 기준 벗어난 합', '조립팀', f'{PHOTO} / 5번 취부 간격(갭)', "측정 4.5 mm, 기준 2~4 mm인데 합 (비고 '반장님 확인')", '측정 기준이면 불합격 +1', '표시만')
chk('원본 밖 자료: 다른 블록 검사', '조립팀', f'{PHOTO} / 6번 비고', "'블록 ?? 도 같이 봄' — 블록 번호 판독 불가", '기록되지 않은 검사가 더 있을 수 있음', '사람이 확인')
chk('날짜 확인 필요', '조립팀', f'{PHOTO} / 검사일', "'11/7(금)'이라고 적혀 있으나 2026-11-07은 토요일. 연도 없음(2026으로 읽음)", '실제 11/6인지 11/7인지 확인', '사람이 확인')
chk('부서 확인 필요', '조립팀', f'{PHOTO} / 머리말', "점검표 부서가 '조립2팀' — 조립팀 파일과 같은 부서인지 확인", '-', '사람이 확인')

# ---------- 엑셀 작성 ----------
RED = Font(color='C00000', bold=True)
REDF = Font(color='C00000')
B = Font(bold=True)
H = PatternFill('solid', fgColor='DDEBF7')
WARN = PatternFill('solid', fgColor='FFF2CC')
thin = Side(style='thin', color='BFBFBF')
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
WRAP = Alignment(wrap_text=True, vertical='top')

def table(ws, r0, c0, headers, rows, fonts=None, widths=None):
    for j, h in enumerate(headers):
        c = ws.cell(r0, c0 + j, h); c.font = B; c.fill = H; c.border = BOX; c.alignment = WRAP
    for i, row in enumerate(rows, 1):
        for j, v in enumerate(row):
            c = ws.cell(r0 + i, c0 + j, v); c.border = BOX; c.alignment = WRAP
            if isinstance(v, dt.date): c.number_format = 'yyyy-mm-dd'
            if fonts and fonts[i - 1]: c.font = fonts[i - 1]
    return r0 + len(rows) + 1

wb = openpyxl.Workbook()
ws = wb.active; ws.title = '요약'
ws['A1'] = f'주간 검사 요약 ({START:%Y-%m-%d} ~ {END:%Y-%m-%d}, 검사일 기준)'; ws['A1'].font = Font(bold=True, size=14)
ws['A2'] = '원본: data\\ 부서별 엑셀 3개 (수정하지 않음). 숫자마다 근거(파일 / 시트 / 행)를 붙임.'

T = 4
rows = [(s['dept'], s['n'], s['f'], s['u'], f"검사: {s['n_ref']}\n불합격: {s['f_ref']}\n미해결: {s['u_ref']}") for s in summary]
tot = ('합계', sum(s['n'] for s in summary), sum(s['f'] for s in summary), sum(s['u'] for s in summary), '세 부서 합')
end = table(ws, T, 1, ['부서', '검사 건수', '불합격', '미해결', '근거 (파일 / 시트 / 행)'], rows + [tot])
for r in range(T + 1, end):
    ws.cell(r, 4).font = RED
for c in range(1, 5): ws.cell(end - 1, c).font = Font(bold=True, color='C00000' if c == 4 else None)
for r in range(T + 1, end - 1): ws.row_dimensions[r].height = 48

# 그래프: 집계표 바로 아래, 왼쪽
ch1 = BarChart(); ch1.title = '부서별 검사 건수'; ch1.type = 'col'; ch1.legend = None
ch1.add_data(Reference(ws, min_col=2, min_row=T, max_row=T + 3), titles_from_data=True)
ch1.set_categories(Reference(ws, min_col=1, min_row=T + 1, max_row=T + 3))
ch1.height, ch1.width = 7, 13; ch1.y_axis.title = '건'
ch2 = BarChart(); ch2.title = '부서별 불합격/미해결'; ch2.type = 'col'
ch2.add_data(Reference(ws, min_col=3, max_col=4, min_row=T, max_row=T + 3), titles_from_data=True)
ch2.set_categories(Reference(ws, min_col=1, min_row=T + 1, max_row=T + 3))
ch2.height, ch2.width = 7, 13; ch2.y_axis.title = '건'
try:
    ch2.series[1].graphicalProperties.solidFill = 'C00000'
    ch2.series[0].graphicalProperties.solidFill = '7F7F7F'
except Exception: pass
G1 = end + 1
ws.add_chart(ch1, f'A{G1}')
ws.add_chart(ch2, f'A{G1 + 15}')

# 오른쪽: 가정 + 확인 필요 요약 (첫 화면에서 보이게)
R = 'G'
rc = 4
ws[f'{R}{rc}'] = '미해결 판단은 가정입니다'; ws[f'{R}{rc}'].font = RED; rc += 1
for line in [
    '원본에 "조치 완료" 열이 없습니다.',
    '조치완료 = 같은 부서·호선·블록·항목에서 불합격 이후(같은 날 포함) 비고가 "재검사"인 합격 행이 있는 경우',
    '미해결 = 그 밖의 경우. 비고 없이 나중에 합격한 건은 미해결로 세고 "확인 필요"로 표시',
    f"도장 파일에는 비고 열이 없어 도장 미해결 {dept_paint['u']}건은 판단 근거가 없습니다.",
]:
    ws[f'{R}{rc}'] = '· ' + line; ws[f'{R}{rc}'].alignment = Alignment(wrap_text=True, vertical='top'); rc += 1
rc += 1
ws[f'{R}{rc}'] = '확인 필요 요약 (원본대로 셈, 아래는 사람이 판단)'; ws[f'{R}{rc}'].font = B; rc += 1
n_nonote = sum(1 for c in checks if c[0] == '비고 없는 후속 합격')
dup_exact = [d for d in dups if d[2] == '시간이 같음']
ctot = tot[1]
summ_lines = [
    (f"DFT 250μm 미만인데 '합격' {len(dft_low)}행 ({', '.join(str(x['row']) for x in dft_low)}행)",
     f"기준대로면 도장 불합격 {dept_paint['f']}→{dept_paint['f']+len(dft_low)}"),
    (f"중복 의심 {len(dups)}쌍 (" + ', '.join(f"{a['row']}/{b['row']}" for a, b, _ in dups) + '행, 조립팀)',
     f"빼면 조립팀 검사 {sa['n']}→{sa['n']-len(dups)} (시간 같은 {len(dup_exact)}쌍만이면 {sa['n']-len(dup_exact)}), 불합격 변화 없음"),
    (f"비고 없이 나중에 합격한 불합격 {n_nonote}건 (미해결로 셈)",
     '재검사로 확인되면 미해결 감소'),
    (f"숨김 시트 '{HIDDEN_EXCLUDE}' {len(hidden)}행 제외 (불합격 {len(hid_f)}건)",
     f"넣으면 선각 불합격 {sg['f']}→{sg['f']+len(hid_f)}"),
    ("현장점검표 사진(조립2팀 H2701 B13 '11/7(금)') 6건이 엑셀에 없음",
     f"넣으면 조립팀 검사 {sa['n']+6} 이상, 불합격 {sa['f']+1}~{sa['f']+3}. 날짜(11/7은 토요일)·부서 확인 필요"),
    ('이월(11/01) 불합격 ' + ', '.join(f"{f['row']}행 {cat}" for f, cat, _ in carry), '기간 내 집계에 넣지 않음'),
]
rc = table(ws, rc, 7, ['항목', '숫자 영향'], summ_lines, fonts=[WARN and None] * len(summ_lines))
for r in range(rc - len(summ_lines), rc):
    for c in (7, 8): ws.cell(r, c).fill = WARN
ws[f'{R}{rc}'] = "자세한 근거는 '확인필요' 시트"; rc += 2

# 아래: 미해결 목록, 재검사 합격 목록 (그래프 아래)
L = G1 + 31
ws[f'A{L}'] = '미해결 불합격 목록'; ws[f'A{L}'].font = Font(bold=True, color='C00000', size=12)
unres = [x for x in fails if x['status'] != '조치완료']
L = table(ws, L + 1, 1, ['부서', '날짜', '호선', '블록', '항목', '판단', '근거 (파일 / 시트 / 행)'],
          [(x['dept'], x['date'], x['ho'], x['blk'], x['item'], x['status'], ref(x) + ' — ' + x['basis']) for x in unres],
          fonts=[REDF] * len(unres))
L += 1
ws[f'A{L}'] = '재검사 합격 목록 (조치완료)'; ws[f'A{L}'].font = Font(bold=True, size=12)
done = [x for x in fails if x['status'] == '조치완료']
L = table(ws, L + 1, 1, ['부서', '불합격 날짜', '호선', '블록', '항목', '재검사 합격 행', '근거 (파일 / 시트 / 행)'],
          [(x['dept'], x['date'], x['ho'], x['blk'], x['item'],
            ', '.join(f"{y['row']}행 ({y['date']:%m/%d})" for y in x['resolved_by']), ref(x)) for x in done])
for col, w in zip('ABCDEFGH', [14, 11, 9, 9, 15, 16, 62, 46]): ws.column_dimensions[col].width = w

# 불합격목록
ws2 = wb.create_sheet('불합격목록')
table(ws2, 1, 1, ['부서', '파일', '시트', '행', '날짜', '호선', '블록', '항목', '원본 판정값', '판단', '근거'],
      [(x['dept'], x['file'], x['sheet'], x['row'], x['date'], x['ho'], x['blk'], x['item'], str(x['judge_raw']),
        x['status'], x['basis']) for x in fails],
      fonts=[REDF if x['status'] != '조치완료' else None for x in fails])
for col, w in zip('ABCDEFGHIJK', [13, 26, 10, 6, 11, 8, 7, 14, 10, 16, 50]): ws2.column_dimensions[col].width = w
ws2.freeze_panes = 'A2'

# 확인필요
ws3 = wb.create_sheet('확인필요')
table(ws3, 1, 1, ['구분', '부서', '근거 (파일 / 시트 / 행)', '내용', '숫자 영향', '처리'], checks)
for col, w in zip('ABCDEF', [26, 13, 48, 60, 36, 18]): ws3.column_dimensions[col].width = w
ws3.freeze_panes = 'A2'
r = len(checks) + 4
ws3.cell(r, 1, '현장점검표 사진 판독 (조립2팀 · H2701 · B13 · 11/7(금) · 검사자 김○○ · 확인 박○○)').font = B
table(ws3, r + 1, 1, ['No', '검사 항목', '기준', '측정', '판정', '비고'],
      [(n, it, std, ms, jd, nt) for n, it, std, ms, jd, nt, _ in photo_items],
      fonts=[WARN and REDF if bad or '정정' in jd else None for n, it, std, ms, jd, nt, bad in photo_items])

# 집계규칙
ws4 = wb.create_sheet('집계규칙')
rules = [
    ('기간', f'{START:%Y-%m-%d} ~ {END:%Y-%m-%d}, 검사일 기준. 파일 제목의 기간은 쓰지 않음'),
    ('부서', '파일 기준: 조립팀 / 품질팀(도장) / 품질팀(선각)'),
    ('시트', f"모든 시트 확인. 선각 숨김 시트 '{HIDDEN_EXCLUDE}'는 집계하지 않고 제외행에 적음"),
    ('열 찾기', "열 이름으로 찾음. 판정 열은 '결과'(조립팀·도장) / '판정'(선각). 못 찾거나 빈 값이면 멈춤"),
    ('판정 통일', '합격/OK/합 → 합격, 불합격/NG/불 → 불합격. 그 밖의 값이면 멈춤'),
    ('날짜 통일', '날짜형, 2026.11.02, 2026-11-02, 11/2 는 같은 날'),
    ('호선·블록', 'H-2702 → H2702. 블록은 공백·하이픈 제거 후 대문자 (d22, D21 , B-12 → D22, D21, B12). 비교는 통일 후'),
    ('소요시간', "'약 40', '30분', '-' 같은 글자는 건수 집계에 쓰지 않음"),
    ('검사 건수', '기록 행 수. 재검사 행도 1건'),
    ('불합격', '판정이 불합격인 행 수. 나중에 재검사로 합격했어도 포함'),
    ('미해결(가정)', "조치완료 = 같은 부서·호선·블록·항목에서 불합격 이후(같은 날 포함) 비고 '재검사'인 합격 행이 있음. 그 밖은 미해결. 비고 없는 후속 합격은 미해결 + 확인 필요"),
    ('원본 판정 유지', 'DFT 250μm 미만 합격 등은 원본대로 세고 확인필요에 표시'),
    ('중복 의심', "날짜·호선·블록·항목·시간이 같거나 시간만 '-'인 행은 둘 다 세고 표시. 시간만 다른 행은 참고"),
    ('이월', '기간 직전 불합격은 집계하지 않고 따로 표시 (후속 기록 없음 = 이월 미조치 의심, 비고 없는 합격 = 확인 필요)'),
    ('원본 밖 자료', '현장점검표 사진은 집계에 넣지 않고 확인필요에 넣었을 때의 숫자를 적음'),
]
table(ws4, 1, 1, ['항목', '규칙'], rules)
ws4.column_dimensions['A'].width = 16; ws4.column_dimensions['B'].width = 110

# 제외행
ws5 = wb.create_sheet('제외행')
ex = [(x['dept'], x['file'], x['sheet'], x['row'], x['date'], x['ho'], x['blk'], x['item'], x['judge'],
       '숨김 시트 (삭제예정_입력오류)' if x['hidden'] else '기간 밖 (검사일 ' + f"{x['date']:%m/%d})") for x in hidden + before + afterp]
ws5['A1'] = (f"제외 {len(ex)}행: 기간 밖 {len(before)+len(afterp)}행 (불합격 {sum(1 for x in before+afterp if x['judge']=='불합격')}건), "
             f"숨김 시트 {len(hidden)}행 (불합격 {len(hid_f)}건)"); ws5['A1'].font = B
table(ws5, 3, 1, ['부서', '파일', '시트', '행', '날짜', '호선', '블록', '항목', '판정', '제외 이유'], ex,
      fonts=[REDF if e[8] == '불합격' else None for e in ex])
for col, w in zip('ABCDEFGHIJ', [13, 26, 18, 6, 11, 8, 7, 14, 8, 28]): ws5.column_dimensions[col].width = w

out = os.path.join(ROOT, 'summary.xlsx')
try:
    wb.save(out)
except PermissionError:
    log('SAVE_FAILED: summary.xlsx가 열려 있음'); print('SAVE_FAILED'); sys.exit(2)
log('저장:', out)
log('요약:', [(s['dept'], s['n'], s['f'], s['u']) for s in summary], tot[1:4])
log('확인필요 행 수:', len(checks), '중복', len(dups), '근접', len(near), '이월', [(f['row'], c) for f, c, _ in carry])
for c in checks: log(' ', c)
print('OK')
