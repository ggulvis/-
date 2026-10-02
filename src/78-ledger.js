/* 보담 — 📒 장부 · 세무 (관리자 전용)
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 📒 장부 (세무기장) ----------------
   통장·카드 내역을 계정과목으로 나눠 «주택임대 개인사업자» 장부를 만든다. (관리자 전용)
   ⚠️ 단위: ledger_entries.amount 는 **원**, leases 의 월세·보증금은 **만원** — 미납 관리와 같다.
   분류 순서 (먼저 걸린 것이 이긴다):
     ① 사람이 가르친 규칙(ledger_rules) — 한 번 고치면 같은 적요는 다음부터 자동
     ② 세입자 입금 — 미납 관리의 매칭(payer_alias·이름·호수)을 그대로 쓴다
     ③ 내장 키워드 (한전·재산세·도배…)
     ④ AI — Edge Function «ledger-classify» (배포 전이면 이 단계만 빠진다)
     ⑤ 사람
   ⛔ 자동으로 붙은 분류는 «초안»이다. 신고에 쓰기 전에 사람이 훑어본다(「자동분류 확인」 필터).
   테이블·권한: supabase/ledger.sql · AI: supabase/functions/ledger-classify */

/** 계정과목 — AI 분류 함수도 이 목록을 그대로 받아 쓴다(원본은 여기 하나).
    kind: income=총수입금액 · expense=필요경비 · asset=자산(감가상각 대상) · transfer=수입·경비 아님 · nonbiz=사업 외
    dir: 이 과목의 «정상» 방향. 반대 방향 거래(카드 환불, 월세 환불)는 합계에서 뺀다. */
const LEDGER_CATS = [
  { key: "rent", label: "임대료 수입", kind: "income", dir: "in", hint: "세입자가 낸 월세·관리비" },
  { key: "other_income", label: "기타 사업수입", kind: "income", dir: "in", hint: "주차비·위약금·원상복구비 등 임대와 관련해 받은 돈" },
  { key: "repair", label: "수선비", kind: "expense", dir: "out", hint: "수리·도배·장판·설비·보일러·누수·도어락 등 고치는 비용" },
  { key: "mgmt_service", label: "관리용역비", kind: "expense", dir: "out", hint: "청소·소독·승강기·정화조·경비·관리업체 용역" },
  { key: "utilities", label: "수도광열비", kind: "expense", dir: "out", hint: "공용 전기·수도·가스·난방 요금" },
  { key: "telecom", label: "통신비", kind: "expense", dir: "out", hint: "세대 인터넷·TV·전화 요금" },
  { key: "tax_dues", label: "세금과공과", kind: "expense", dir: "out", hint: "재산세·종합부동산세·환경개선부담금·사업주 지역 건강보험료·협회비 (종합소득세·지방소득세는 제외)" },
  { key: "insurance", label: "보험료", kind: "expense", dir: "out", hint: "화재보험·임대인 배상책임보험 등 건물 보험" },
  { key: "interest", label: "이자비용", kind: "expense", dir: "out", hint: "건물·사업용 대출 이자 (원금 제외)" },
  { key: "fees", label: "지급수수료", kind: "expense", dir: "out", hint: "중개수수료·세무사·법무사·변호사·은행 수수료" },
  { key: "advertising", label: "광고선전비", kind: "expense", dir: "out", hint: "매물 광고·플랫폼 광고비" },
  { key: "supplies", label: "소모품비", kind: "expense", dir: "out", hint: "전구·청소용품·공구 등 소액 물품" },
  { key: "salary", label: "인건비", kind: "expense", dir: "out", hint: "관리인·직원 급여, 일용직 인건비" },
  { key: "vehicle", label: "차량유지비", kind: "expense", dir: "out", hint: "업무용 차량 주유·주차·통행료·수리" },
  { key: "travel", label: "여비교통비", kind: "expense", dir: "out", hint: "업무 이동 교통비" },
  { key: "entertainment", label: "기업업무추진비", kind: "expense", dir: "out", hint: "거래처 접대 (옛 접대비)" },
  { key: "other_expense", label: "기타 경비", kind: "expense", dir: "out", hint: "임대 사업에 쓴 그 밖의 비용" },
  { key: "asset_purchase", label: "자산 취득", kind: "asset", dir: "out", hint: "건물·설비·에어컨·냉장고 등 오래 쓰는 큰 구입 (감가상각 대상)" },
  { key: "deposit_in", label: "보증금 받음", kind: "transfer", dir: "in", hint: "세입자에게 받은 임대보증금 (돌려줄 돈)" },
  { key: "deposit_out", label: "보증금 돌려줌", kind: "transfer", dir: "out", hint: "퇴실 세입자에게 반환한 보증금" },
  { key: "loan_in", label: "대출 받음", kind: "transfer", dir: "in", hint: "은행 대출 실행금" },
  { key: "loan_principal", label: "대출 원금 상환", kind: "transfer", dir: "out", hint: "대출 원금 상환 (이자는 이자비용)" },
  { key: "internal", label: "내 계좌 간 이체", kind: "transfer", dir: "both", hint: "사업자 본인 계좌끼리 옮긴 돈" },
  { key: "card_payment", label: "카드대금 결제", kind: "transfer", dir: "out", hint: "통장에서 빠져나간 카드값 (카드 내역에서 따로 셈)" },
  { key: "owner_in", label: "사업주 입금", kind: "transfer", dir: "in", hint: "사업주가 개인 돈을 사업 통장에 넣은 것" },
  { key: "owner_draw", label: "개인용·인출 (경비 아님)", kind: "nonbiz", dir: "out", hint: "생활비·개인 쇼핑·종합소득세·지방소득세·국민연금 등" },
  { key: "interest_income", label: "예금이자 (이자소득)", kind: "nonbiz", dir: "in", hint: "통장 이자 — 사업소득이 아니라 이자소득" },
];
const LEDGER_CAT = Object.fromEntries(LEDGER_CATS.map((c) => [c.key, c]));
const LEDGER_KINDS = { income: "수입", expense: "필요경비", asset: "자산", transfer: "수입·경비 아님", nonbiz: "사업 외" };
/** 부동산임대업 기준 수입금액 (소득세법 시행령) — 개정되면 여기만 고친다 */
const LEDGER_LIMITS = { double: 75000000, external: 150000000, sincere: 500000000 };

/** 내장 키워드 [방향, 출처(null=둘 다), 정규식, 계정과목]. 위에서부터 먼저 걸린 것이 이긴다.
    ⛔ 통장에서 나간 «카드값»을 경비로 세면 카드 내역과 **두 번** 센다 — 그래서 맨 위에 둔다. */
const LEDGER_KEYWORDS = [
  ["out", "bank", /카드대금|카드결제|카드값|(신한|삼성|현대|국민|KB|롯데|하나|우리|비씨|BC|농협|NH|씨티|IBK)카드/i, "card_payment"],
  ["out", null, /종합소득세|지방소득세|국민연금/, "owner_draw"],
  ["out", null, /재산세|종부세|종합부동산세|환경개선부담금|교통유발부담금/, "tax_dues"],
  ["out", null, /원금상환|대출원금/, "loan_principal"],
  ["out", null, /도배|장판|인테리어|수리|보수공사|설비|보일러|배관|누수|방수|철물|열쇠|도어락|샷시|창호|페인트|타일|싱크대/, "repair"],
  ["out", null, /청소|소독|방역|승강기|엘리베이터|정화조|관리용역|폐기물/, "mgmt_service"],
  ["out", null, /KTX|코레일|SRT|고속버스|시외버스|택시|카카오T|티머니/i, "travel"],
  ["out", null, /한국전력|한전|전기요금|상수도|수도요금|수도사업|도시가스|지역난방|삼천리|예스코/, "utilities"],
  ["out", null, /SK브로드밴드|SKB|LG유플러스|LGU\+|엘지유플러스|유플러스|케이티|\bKT\b|헬로비전|딜라이브|인터넷요금/i, "telecom"],
  ["out", null, /화재보험|손해보험|화재해상|배상책임/, "insurance"],
  ["out", null, /중개수수료|공인중개|부동산중개|세무사|세무회계|회계사무|법무사|변호사/, "fees"],
  ["out", null, /수수료/, "fees"],
  ["out", null, /주유|SK에너지|GS칼텍스|S-OIL|에쓰오일|현대오일|하이패스|주차장|도로공사/i, "vehicle"],
  ["out", null, /다이소/, "supplies"],
  ["out", null, /급여|월급|인건비/, "salary"],
  ["out", null, /이자/, "interest"],
  ["in", null, /이자/, "interest_income"],
  ["in", null, /대출실행|대출금|여신실행/, "loan_in"],
];

/** 규칙 비교용 적요 — 공백·숫자·기호를 뺀다. «502호류지훈»과 «호류지훈 9월»이 같은 사람으로 묶인다. */
const ledgerKey = (d) => String(d || "").replace(/[\s\d\-_.,:;/()*\[\]#+~]+/g, "").toLowerCase();
/** 합계에 넣을 값: 과목의 정상 방향이면 +, 반대면 −(환불). 양방향 과목(계좌 간 이체)은 그냥 더한다. */
const ledgerNet = (e) => {
  const c = LEDGER_CAT[e.category];
  if (!c) return 0;
  if (c.dir === "both") return e.amount;
  return e.direction === c.dir ? e.amount : -e.amount;
};

function ledgerSerialDate(n) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);   // 시각(소수부)은 버린다 — 밤 거래가 다음 날로 넘어가지 않게
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}
/** 날짜 칸 → YYYY-MM-DD. "2026.01.05 14:22" · "2026-01-05" · "20260105" · "26.01.05" · "01/05"(기본 연도) · 엑셀 일련번호 */
function ledgerDate(v, defYear) {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) return ledgerSerialDate(v);
    if (v > 19000101 && v < 21001231) { const s = String(Math.floor(v)); return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8); }
    return "";
  }
  const s = String(v).trim();
  let m, y, mo, d;
  if ((m = s.match(/(20\d{2})\s*[-./년]?\s*(\d{1,2})\s*[-./월]?\s*(\d{1,2})/))) { y = m[1]; mo = m[2]; d = m[3]; }
  else if ((m = s.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/))) { y = "20" + m[1]; mo = m[2]; d = m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-./](\d{1,2})(?!\d)/)) && defYear) { y = String(defYear); mo = m[1]; d = m[2]; }
  else return "";
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return "";
  return y + "-" + pad2(mo) + "-" + pad2(d);
}
function ledgerNum(v) {
  if (typeof v === "number") return v;
  let s = String(v == null ? "" : v).replace(/[,\s원₩]/g, "");
  if (!s) return 0;
  if (/^\(.*\)$/.test(s)) s = "-" + s.slice(1, -1);   // (12,000) = 음수
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

/** 은행·카드사 엑셀의 «머리 줄»을 찾아 칸을 짚는다. 은행마다 이름이 달라 느슨하게 본다. */
function ledgerFindHeader(aoa) {
  for (let r = 0; r < Math.min(aoa.length, 40); r++) {
    const cells = (aoa[r] || []).map((v) => String(v == null ? "" : v).replace(/\s/g, ""));
    const cols = { desc: [] };
    cells.forEach((h, i) => {
      if (!h || h.length > 20) return;
      if (/잔액|잔고/.test(h)) { if (cols.balance == null) cols.balance = i; return; }
      if (/입금|맡기신|받으신/.test(h) && !/입금자|입금인|입금처/.test(h)) { if (cols.in == null) cols.in = i; return; }
      if (/출금|찾으신|지급액|인출/.test(h) && !/출금처/.test(h)) { if (cols.out == null) cols.out = i; return; }
      if (/일자|일시|날짜|거래일|승인일|이용일|매출일|사용일|^date$/i.test(h)) { if (cols.date == null) cols.date = i; return; }
      if (/구분|취소/.test(h)) { if (cols.kind == null) cols.kind = i; return; }
      if (/금액|합계/.test(h)) { if (cols.amount == null) cols.amount = i; return; }
      if (/적요|내용|받는분|보낸분|입금자|입금인|의뢰인|수취인|가맹점|이용처|사용처|상호|거래처|메모|비고|통장표시/.test(h)) cols.desc.push(i);
    });
    if (cols.date != null && (cols.in != null || cols.out != null || cols.amount != null)) return { row: r, cols };
  }
  return null;
}

/** 표(행×열) → 거래 목록. 입금·출금 칸이 따로 있으면 그걸로, 금액 칸 하나면 «구분» 칸이나 부호로 방향을 정한다. */
function ledgerParseTable(aoa, source, defYear) {
  const h = ledgerFindHeader(aoa);
  if (!h) return [];
  const c = h.cols, out = [];
  for (let r = h.row + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const date = ledgerDate(row[c.date], defYear);
    if (!date) continue;                               // 합계·빈 줄
    let direction = "", amount = 0;
    if (c.in != null || c.out != null) {
      const iv = c.in != null ? ledgerNum(row[c.in]) : 0, ov = c.out != null ? ledgerNum(row[c.out]) : 0;
      if (iv > 0) { direction = "in"; amount = iv; } else if (ov > 0) { direction = "out"; amount = ov; }
    } else {
      const a = ledgerNum(row[c.amount]);
      const k = c.kind != null ? String(row[c.kind] || "") : "";
      if (source === "card") direction = (a < 0 || /취소/.test(k)) ? "in" : "out";   // 카드: 취소·음수 = 환불
      else direction = /입금/.test(k) ? "in" : /출금|지급/.test(k) ? "out" : (a < 0 ? "out" : "in");
      amount = Math.abs(a);
    }
    amount = Math.round(amount);
    if (!direction || !(amount > 0)) continue;
    const description = c.desc.map((i) => String(row[i] == null ? "" : row[i]).trim()).filter(Boolean).join(" ");
    const hasBal = c.balance != null && String(row[c.balance] == null ? "" : row[c.balance]).trim() !== "";
    out.push({ date, direction, amount, description, balance: hasBal ? Math.round(ledgerNum(row[c.balance])) : null,
               raw: row.map((v) => String(v == null ? "" : v)).join(" | ") });
  }
  return out;
}

/** 붙여넣은 글 → 거래 목록. 엑셀에서 표째 복사한 것(탭 구분 + 머리 줄)이면 표로 읽는다.
    아니면 한 줄에 한 건 — 미납 관리의 은행 문자 읽기(parseBankText)를 빌려 쓰고 방향만 더 본다. */
function ledgerParseText(text, source, defYear, defDir) {
  const lines = (text || "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.some((l) => l.includes("\t"))) {
    const aoa = lines.map((l) => l.split("\t"));
    if (ledgerFindHeader(aoa)) return ledgerParseTable(aoa, source, defYear);
  }
  return parseBankText(text, defYear).map((r) => {
    const t = r.raw;
    const hasIn = /입금/.test(t), hasOut = /출금|지급|인출|결제|승인/.test(t);
    let direction = hasOut && !hasIn ? "out" : hasIn && !hasOut ? "in" : defDir;
    if (source === "card") direction = /취소/.test(t) ? "in" : "out";
    const bm = t.match(/잔액[^0-9]{0,6}([0-9,]+)/);
    return { date: r.paid_on, direction, amount: r.amount,
             description: (r.payer_raw || "").replace(/입금|출금|잔액|원/g, " ").replace(/\s+/g, " ").trim(),
             balance: bm ? Number(bm[1].replace(/,/g, "")) : null, raw: t };
  });
}

/** 파일 → 표. CSV 는 은행 것이 EUC-KR 인 경우가 많아 UTF-8 이 깨지면 EUC-KR 로 다시 읽는다. */
async function ledgerReadFile(file) {
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder("euc-kr").decode(buf); }
    wb = XLSX.read(text, { type: "string", raw: true });
  } else {
    wb = XLSX.read(buf, { type: "array" });
  }
  for (const name of wb.SheetNames) {                   // 머리 줄이 잡히는 첫 시트
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
    if (ledgerFindHeader(aoa)) return aoa;
  }
  return null;
}

/** 같은 파일을 두 번 올려도 한 번만 들어가게 하는 열쇠. 잔액이 있으면 잔액이 줄마다 달라 확실히 갈린다.
    같은 날·같은 금액·같은 적요가 여러 번이면 순번(#2, #3)으로 가른다 — 다시 올려도 순번이 같다. */
function ledgerDedup(rows, source) {
  const seen = {};
  rows.forEach((r) => {
    const base = [source, r.date, r.direction, r.amount, String(r.description || "").replace(/\s/g, ""), r.balance == null ? "" : r.balance].join("|");
    seen[base] = (seen[base] || 0) + 1;
    r.dedup_key = base + "#" + seen[base];
  });
}

function ledgerTargets(leases, buildings) {
  const names = {};
  buildings.forEach((b) => { names[b.id] = b.name || ""; });
  return leases.filter((l) => !l.vacant).map((l) => ({
    id: l.id, name: (l.tenant_name || "").replace(/\s/g, ""),
    roomNum: String(l.room_number || "").replace(/\D/g, ""),
    bldKey: (names[l.building_id] || "").replace(/\s/g, ""),
  }));
}
async function ledgerLoadAlias() {
  const { data } = await sb.from("payer_alias").select("*");
  const m = {};
  (data || []).forEach((x) => { m[x.payer_name] = x.lease_id; });
  return m;
}

/** 거래 한 건 → { category, cat_by, lease_id? }. 못 맞추면 category=null (AI·사람 몫). */
function ledgerClassify(e, ctx) {
  const key = ledgerKey(e.description);
  /* 카드 «취소»(들어온 돈)는 산 것과 같은 과목이어야 합계에서 서로 지워진다 — 그래서 나간 돈 규칙으로 찾는다 */
  const dir = e.source === "card" ? "out" : e.direction;
  if (key.length >= 2) {                                          // ① 사람이 가르친 규칙 — 가장 긴 것
    let best = null;
    for (const r of ctx.rules) {
      if (r.direction !== dir || !r.pattern || r.pattern.length < 2 || !LEDGER_CAT[r.category]) continue;
      if (key.includes(r.pattern) && (!best || r.pattern.length > best.pattern.length)) best = r;
    }
    if (best) return { category: best.category, cat_by: "learned" };
  }
  const byKeyword = () => {
    for (const [kd, src, re, cat] of LEDGER_KEYWORDS) {
      if (kd === dir && (!src || src === e.source) && re.test(e.description)) return { category: cat, cat_by: "rule" };
    }
    return null;
  };
  if (dir === "out") { const k = byKeyword(); if (k) return k; }   // 나간 돈은 키워드가 더 확실하다
  if (e.source !== "card" && (e.direction === "in" || e.amount >= 500000)) {   // ② 세입자
    const lid = matchLease(e.description, ctx.targets, ctx.alias);
    const l = lid && ctx.leaseById[lid];
    if (l) {
      const dep = (Number(l.deposit) || 0) * 10000, bill = monthBill(l);
      /* 보증금은 «돌려줄 돈»이라 수입이 아니다. 월세보다 훨씬 크고 보증금의 절반 이상이면 보증금으로 본다
         (계약금처럼 쪼개 받은 건 월세로 잡힐 수 있다 — 사람이 고친다). */
      if (e.direction === "in") return { category: dep > 0 && e.amount >= Math.max(dep * 0.5, bill * 3) ? "deposit_in" : "rent", cat_by: "lease", lease_id: lid };
      if (e.amount >= Math.max(bill * 2, 500000)) return { category: "deposit_out", cat_by: "lease", lease_id: lid };
    }
  }
  if (dir === "in") { const k = byKeyword(); if (k) return k; }            // ③
  return { category: null, cat_by: null };
}

/** 미분류를 AI 분류 함수로 보낸다. 80건씩 나눠 보내고, id → {category, confidence, reason} 로 돌려준다. */
async function ledgerAskAI(items, onProgress) {
  const categories = LEDGER_CATS.map((c) => ({ key: c.key, label: c.label, kind: LEDGER_KINDS[c.kind], hint: c.hint }));
  const out = {};
  const CHUNK = 80;
  for (let i = 0; i < items.length; i += CHUNK) {
    const { data, error } = await sb.functions.invoke("ledger-classify", { body: { items: items.slice(i, i + CHUNK), categories } });
    if (error) {
      let msg = error.message || "AI 분류 실패";
      const res = error.context;
      if (res && res.status === 404) msg = "AI 분류 함수(ledger-classify)가 아직 배포되지 않았습니다.";
      else if (res && typeof res.json === "function") { try { const b = await res.json(); if (b && b.error) msg = b.error; } catch (e) {} }
      else if (/fetch|network/i.test(msg)) msg = "AI 분류 함수에 연결하지 못했습니다. 배포됐는지 확인하세요.";
      const done = Object.keys(out).length;
      throw new Error(done ? `${done}건까지 분류한 뒤 멈췄습니다 — ${msg}` : msg);
    }
    ((data && data.results) || []).forEach((r) => { out[r.id] = r; });
    if (onProgress) onProgress(Math.min(i + CHUNK, items.length), items.length);
  }
  return out;
}

/** 합계 — 요약·신고 준비·엑셀이 같은 숫자를 보게 한 곳에서 센다 */
function ledgerSummary(entries) {
  const byCat = {}, cnt = {};
  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  const uncat = { n: 0, in: 0, out: 0 };
  let income = 0, expense = 0, lastDate = "";
  entries.forEach((e) => {
    if (e.entry_date > lastDate) lastDate = e.entry_date;
    const c = LEDGER_CAT[e.category];
    if (!c) { uncat.n++; uncat[e.direction] += e.amount; return; }
    const v = ledgerNet(e), m = Number(String(e.entry_date).slice(5, 7)) - 1;
    byCat[c.key] = (byCat[c.key] || 0) + v;
    cnt[c.key] = (cnt[c.key] || 0) + 1;
    if (c.kind === "income") { income += v; if (months[m]) months[m].income += v; }
    if (c.kind === "expense") { expense += v; if (months[m]) months[m].expense += v; }
  });
  return { byCat, cnt, months, uncat, income, expense, profit: income - expense, lastDate };
}

/** 세무사에게 넘기거나 홈택스에 옮겨 적을 엑셀 */
function ledgerExport(year, entries, sum) {
  const wb = XLSX.utils.book_new();
  const add = (rows, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  add([
    ["보담 장부 — 주택임대 (" + year + "년)"], [],
    ["총수입금액", sum.income], ["필요경비", sum.expense], ["소득금액 (감가상각 전)", sum.profit],
    ["미분류", sum.uncat.n + "건", "입금 " + sum.uncat.in, "출금 " + sum.uncat.out], [],
    ["※ 감가상각비·간주임대료·통장 밖에서 낸 경비는 들어 있지 않습니다."],
    ["※ 자동 분류(규칙·AI)는 초안입니다. 신고 전에 확인하세요."],
  ], "요약");
  const byCat = [["구분", "계정과목", "금액(원)", "건수"]];
  LEDGER_CATS.forEach((c) => { if (sum.cnt[c.key]) byCat.push([LEDGER_KINDS[c.kind], c.label, sum.byCat[c.key], sum.cnt[c.key]]); });
  add(byCat, "계정별 합계");
  add([["월", "수입", "필요경비", "차이"]].concat(sum.months.map((m, i) => [(i + 1) + "월", m.income, m.expense, m.income - m.expense])), "월별");
  const by = { human: "직접", learned: "학습", lease: "세대", rule: "규칙", ai: "AI" };
  add([["날짜", "입금", "출금", "적요", "계정과목", "구분", "분류", "통장/카드", "메모"]].concat(
    entries.slice().sort((a, b) => a.entry_date.localeCompare(b.entry_date)).map((e) => {
      const c = LEDGER_CAT[e.category];
      return [e.entry_date, e.direction === "in" ? e.amount : "", e.direction === "out" ? e.amount : "", e.description,
              c ? c.label : "미분류", c ? LEDGER_KINDS[c.kind] : "", by[e.cat_by] || "", e.account_label || "", e.memo || ""];
    })), "거래내역");
  XLSX.writeFile(wb, "보담_장부_" + year + ".xlsx");
}

function LedgerCatSelect({ value, onChange, disabled }) {
  return (
    <select className={"border rounded-md px-1.5 py-1 text-xs bg-white max-w-[160px] " + (value ? "border-slate-300" : "border-amber-400 text-amber-700")}
      value={value || ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} aria-label="계정과목">
      <option value="">— 미분류 —</option>
      {Object.keys(LEDGER_KINDS).map((k) => (
        <optgroup key={k} label={LEDGER_KINDS[k]}>
          {LEDGER_CATS.filter((c) => c.kind === k).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
function LedgerByBadge({ e }) {
  const m = {
    human: ["직접", "bg-slate-100 text-slate-600 border-slate-300"],
    learned: ["학습", "bg-emerald-50 text-emerald-700 border-emerald-300"],
    lease: ["세대", "bg-blue-50 text-blue-700 border-blue-300"],
    rule: ["규칙", "bg-sky-50 text-sky-700 border-sky-300"],
    ai: ["AI", "bg-violet-50 text-violet-700 border-violet-300"],
  };
  if (!e.category || !m[e.cat_by]) return null;
  const low = e.cat_by === "ai" && e.ai_confidence === "low";
  const [label, cls] = m[e.cat_by];
  return (
    <span title={e.ai_reason || ""} className={"text-[10px] border rounded-full px-1.5 py-0.5 font-bold whitespace-nowrap " + (low ? "bg-amber-50 text-amber-700 border-amber-400" : cls)}>
      {label}{low ? "?" : ""}
    </span>
  );
}
const ledgerAmt = (e) => (
  <span className={"font-semibold whitespace-nowrap " + (e.direction === "in" ? "text-emerald-600" : "text-slate-700")}>
    {e.direction === "in" ? "+" : "−"}{(Number(e.amount) || 0).toLocaleString("ko-KR")}
  </span>
);

/* 통장·카드 내역 가져오기 → 자동 분류 → (AI) → 저장 */
function LedgerImportModal({ leases, buildings, rules, onClose, onSaved }) {
  const savedLabel = (s) => { try { return localStorage.getItem("bodam_ledger_label_" + s) || ""; } catch (e) { return ""; } };
  const [source, setSource] = useState("bank");
  const [label, setLabel] = useState(() => savedLabel("bank"));
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [defDir, setDefDir] = useState("out");
  const [rows, setRows] = useState(null);
  const [alias, setAlias] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [shown, setShown] = useState(200);
  const year = new Date().getFullYear();

  useEffect(() => { ledgerLoadAlias().then(setAlias); }, []);
  const ctx = useMemo(() => ({ rules, alias, targets: ledgerTargets(leases, buildings),
    leaseById: Object.fromEntries(leases.map((l) => [l.id, l])) }), [rules, alias, leases, buildings]);

  const analyze = async () => {
    setErr(""); setMsg("");
    let parsed;
    try {
      if (file) {
        const aoa = await ledgerReadFile(file);
        if (!aoa) { setErr("날짜·금액 칸이 있는 머리 줄을 찾지 못했습니다. 은행·카드사에서 받은 원본 파일인지 확인하거나, 표를 복사해 붙여넣어 보세요."); return; }
        parsed = ledgerParseTable(aoa, source, year);
      } else {
        parsed = ledgerParseText(text, source, year, defDir);
      }
    } catch (e) { setErr("읽지 못했습니다: " + e.message); return; }
    if (!parsed.length) { setErr("읽을 거래가 없습니다."); return; }
    ledgerDedup(parsed, source);
    setRows(parsed.map((r, i) => ({ ...r, _id: String(i), source, ...ledgerClassify({ ...r, source }, ctx) })));
    setShown(200);
  };

  /* 한 줄을 고치면 **같은 적요의 다른 줄**도 같이 바꾼다(사람이 직접 고른 줄은 건드리지 않는다) */
  const upd = (i, cat) => {
    const k = ledgerKey(rows[i].description), d = rows[i].direction;
    let n = 0;
    const next = rows.map((r, j) => {
      if (j === i) return { ...r, category: cat, cat_by: cat ? "human" : null, ai_confidence: null, ai_reason: null };
      if (cat && k.length >= 2 && r.direction === d && r.cat_by !== "human" && r.category !== cat && ledgerKey(r.description) === k) {
        n++; return { ...r, category: cat, cat_by: "learned", ai_confidence: null, ai_reason: null };
      }
      return r;
    });
    setRows(next);
    setMsg(n ? `같은 적요 ${n}건도 같이 바꿨습니다.` : "");
  };

  const runAI = async () => {
    const todo = rows.filter((r) => !r.category);
    if (!todo.length) return;
    if (!confirm(`미분류 ${todo.length}건의 날짜·금액·적요를 AI(Anthropic Claude)에 보내 분류합니다.\n적요에 사람 이름이 들어 있을 수 있습니다. 계속할까요?`)) return;
    setBusy(true); setErr(""); setMsg("AI 분류 중…");
    try {
      const res = await ledgerAskAI(
        todo.map((r) => ({ id: r._id, date: r.date, direction: r.direction, amount: r.amount, description: r.description, source: r.source })),
        (d, t) => setMsg(`AI 분류 중… ${d}/${t}`));
      setRows((cur) => cur.map((r) => (!r.category && res[r._id]
        ? { ...r, category: res[r._id].category, cat_by: "ai", ai_confidence: res[r._id].confidence, ai_reason: res[r._id].reason } : r)));
      setMsg(`AI가 ${Object.keys(res).length}건을 분류했습니다. 「AI?」 표시는 확신이 낮은 것이니 꼭 확인하세요.`);
    } catch (e) { setErr(e.message); setMsg(""); }
    setBusy(false);
  };

  const save = async () => {
    const ok = rows.filter((r) => r.date && r.amount > 0);
    if (!ok.length) { setErr("저장할 거래가 없습니다."); return; }
    setBusy(true); setErr("");
    try { localStorage.setItem("bodam_ledger_label_" + source, label.trim()); } catch (e) {}
    let inserted = 0;
    for (let i = 0; i < ok.length; i += 500) {
      const chunk = ok.slice(i, i + 500).map((r) => ({
        entry_date: r.date, source: r.source, account_label: label.trim(), direction: r.direction, amount: r.amount,
        description: r.description || "", balance: r.balance == null ? null : r.balance,
        category: r.category || null, cat_by: r.category ? r.cat_by : null,
        ai_confidence: r.ai_confidence || null, ai_reason: r.ai_reason || null,
        lease_id: r.lease_id || null, raw: r.raw || null, dedup_key: r.dedup_key,
      }));
      const { data, error } = await sb.from("ledger_entries")
        .upsert(chunk, { onConflict: "dedup_key", ignoreDuplicates: true }).select("id");
      if (error) { setBusy(false); setErr((inserted ? `${inserted}건 저장 후 멈춤: ` : "") + error.message); return; }
      inserted += (data || []).length;
    }
    // 사람이 고른 분류를 기억한다 — 다음 가져오기부터 같은 적요는 자동
    const learn = {};
    ok.forEach((r) => {
      const k = ledgerKey(r.description);
      if (r.cat_by === "human" && r.category && k.length >= 2)
        learn[r.direction + "|" + k] = { direction: r.direction, pattern: k, category: r.category, updated_at: new Date().toISOString() };
    });
    const lr = Object.values(learn);
    if (lr.length) await sb.from("ledger_rules").upsert(lr, { onConflict: "direction,pattern" });
    const yc = {};
    ok.forEach((r) => { const y = r.date.slice(0, 4); yc[y] = (yc[y] || 0) + 1; });
    const topYear = Number(Object.keys(yc).sort((a, b) => yc[b] - yc[a])[0]);
    setBusy(false);
    onSaved({ inserted, total: ok.length, year: topYear });
    onClose();
  };

  const cnt = rows && {
    none: rows.filter((r) => !r.category).length,
    auto: rows.filter((r) => r.category && r.cat_by !== "human").length,
    nodate: rows.filter((r) => !r.date).length,
    in: rows.filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0),
    out: rows.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0),
  };
  const tabBtn = (on) => "flex-1 rounded-lg py-2 text-sm font-semibold border " + (on ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300");

  return (
    <Modal title="📥 통장·카드 내역 가져오기" onClose={onClose} wide>
      {!rows ? (
        <>
          <div className="flex gap-2 mb-3">
            <button className={tabBtn(source === "bank")} onClick={() => { setSource("bank"); setLabel(savedLabel("bank")); }}>🏦 통장 내역</button>
            <button className={tabBtn(source === "card")} onClick={() => { setSource("card"); setLabel(savedLabel("card")); }}>💳 카드 내역</button>
          </div>
          <Field label={source === "bank" ? "어느 통장인가요?" : "어느 카드인가요?"}>
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder={source === "bank" ? "예: 신한 임대료통장" : "예: 삼성 사업용카드"} />
          </Field>
          <Field label="은행·카드사에서 받은 엑셀·CSV 파일">
            <input type="file" accept=".xlsx,.xls,.csv,.txt" className="block w-full text-sm"
              onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
          </Field>
          {!file && (
            <>
              <Field label="또는 내용을 복사해 붙여넣기">
                <textarea className={inputCls + " h-36 font-mono text-xs"} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={"엑셀에서 머리 줄까지 표째 복사해 붙이면 가장 정확합니다.\n은행 앱 문자처럼 한 줄에 한 건씩 붙여도 됩니다."} />
              </Field>
              {source === "bank" && (
                <label className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  입금·출금 표시가 없는 줄은
                  <select className="border border-slate-300 rounded px-1.5 py-1 text-xs bg-white" value={defDir} onChange={(e) => setDefDir(e.target.value)}>
                    <option value="out">나간 돈(출금)</option>
                    <option value="in">들어온 돈(입금)</option>
                  </select>
                  으로 봅니다
                </label>
              )}
            </>
          )}
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mb-3 leading-relaxed break-keep">
            <b>파일 받는 곳</b> · 통장: 인터넷뱅킹 → 거래내역 조회 → 엑셀 저장 · 카드: 카드사 홈페이지 이용내역 엑셀, 또는 홈택스 → 사업용 신용카드 사용내역.
            <br />같은 파일을 두 번 올려도 한 번만 들어갑니다.
          </div>
          {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
          <button className={btnPrimary + " w-full py-3"} onClick={analyze} disabled={!file && !text.trim()}>분석하기</button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2 text-xs">
            <span className="bg-slate-100 rounded-full px-2.5 py-1 font-semibold">총 {rows.length}건</span>
            <span className="bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-1 font-semibold">입금 {won(cnt.in)}</span>
            <span className="bg-slate-100 text-slate-700 rounded-full px-2.5 py-1 font-semibold">출금 {won(cnt.out)}</span>
            <span className="bg-sky-50 text-sky-700 rounded-full px-2.5 py-1 font-semibold">자동분류 {cnt.auto}</span>
            <span className={"rounded-full px-2.5 py-1 font-semibold " + (cnt.none ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-400")}>미분류 {cnt.none}</span>
            {cnt.nodate > 0 && <span className="bg-red-50 text-red-600 rounded-full px-2.5 py-1 font-semibold">날짜 없음 {cnt.nodate} (저장 안 됨)</span>}
          </div>
          {msg && <p className="text-sm text-violet-700 mb-2">{msg}</p>}
          {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
          <div className="overflow-x-auto -mx-4 sm:mx-0 mb-3">
            <table className="w-full text-xs min-w-[560px]">
              <thead><tr className="text-slate-500 border-b">
                <th className="text-left py-1.5 px-2">날짜</th><th className="text-left px-2">적요</th>
                <th className="text-right px-2">금액</th><th className="text-left px-2">계정과목</th><th className="px-1"></th>
              </tr></thead>
              <tbody>
                {rows.slice(0, shown).map((r, i) => (
                  <tr key={r._id} className="border-b" data-testid="ledger-import-row">
                    <td className={"py-1 px-2 whitespace-nowrap " + (r.date ? "text-slate-500" : "text-red-500")}>{r.date || "날짜 없음"}</td>
                    <td className="px-2 break-all">{r.description || <span className="text-slate-300">·</span>}</td>
                    <td className="px-2 text-right">{ledgerAmt(r)}</td>
                    <td className="px-2"><LedgerCatSelect value={r.category} onChange={(v) => upd(i, v)} disabled={busy} /></td>
                    <td className="px-1"><LedgerByBadge e={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > shown && <button className="text-xs text-blue-600 underline mt-2 px-2" onClick={() => setShown(shown + 300)}>{rows.length - shown}건 더 보기</button>}
          </div>
          <div className="flex gap-2 flex-wrap pb-2">
            <button className={btnGhost} onClick={() => { setRows(null); setMsg(""); setErr(""); }} disabled={busy}>← 다시</button>
            {cnt.none > 0 && <button className={btnGhost + " !border-violet-300 !text-violet-700"} onClick={runAI} disabled={busy}>🤖 미분류 {cnt.none}건 AI로 분류</button>}
            <div className="flex-1" />
            <button className={btnPrimary} onClick={save} disabled={busy}>{busy ? "처리 중…" : `저장 (${rows.length - cnt.nodate}건)`}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* 현금으로 낸 경비·통장 밖 거래(예: 다른 계좌에서 낸 재산세)를 한 건씩 넣는다 */
function LedgerManualModal({ onClose, onSaved }) {
  const today = new Date();
  const [f, setF] = useState({ date: today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate()),
                               direction: "out", amount: "", description: "", category: null, memo: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF({ ...f, [k]: v });
  const save = async () => {
    const amount = Math.round(ledgerNum(f.amount));
    if (!f.date || !(amount > 0) || !f.description.trim()) { setErr("날짜·금액·내용을 채워주세요."); return; }
    setBusy(true); setErr("");
    const { error } = await sb.from("ledger_entries").insert({
      entry_date: f.date, source: "manual", account_label: "직접 입력", direction: f.direction, amount,
      description: f.description.trim(), category: f.category || null, cat_by: f.category ? "human" : null,
      memo: f.memo.trim() || null, dedup_key: "manual|" + Date.now() + "|" + Math.random().toString(36).slice(2, 8),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved(f.date); onClose();
  };
  return (
    <Modal title="✏️ 직접 입력" onClose={onClose}>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="날짜"><input type="date" className={inputCls} value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="구분">
          <select className={inputCls} value={f.direction} onChange={(e) => set("direction", e.target.value)}>
            <option value="out">나간 돈</option><option value="in">들어온 돈</option>
          </select>
        </Field>
      </div>
      <Field label="금액 (원)"><input className={inputCls} inputMode="numeric" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="예: 1,250,000" /></Field>
      <Field label="내용"><input className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="예: 2026년 7월 재산세 (건물분)" /></Field>
      <div className="mb-3">
        <span className="block text-sm font-medium text-slate-600 mb-1">계정과목</span>
        <LedgerCatSelect value={f.category} onChange={(v) => set("category", v)} />
      </div>
      <Field label="메모"><input className={inputCls} value={f.memo} onChange={(e) => set("memo", e.target.value)} placeholder="증빙 위치 등" /></Field>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      <div className="flex gap-2 pb-2">
        <button className={btnPrimary + " flex-1 py-3"} onClick={save} disabled={busy}>{busy ? "저장 중..." : "저장"}</button>
        <button className={btnGhost} onClick={onClose}>취소</button>
      </div>
    </Modal>
  );
}

function LedgerView({ leases, buildings, onBack }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [entries, setEntries] = useState([]);
  const [rules, setRules] = useState([]);
  const [alias, setAlias] = useState({});
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("list");            // list | summary | filing
  const [only, setOnly] = useState("all");           // all | none | auto | income | expense | etc
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(200);
  const [imp, setImp] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async (y) => {
    setLoading(true); setLoadErr(""); setMissing(false);
    /* 한 해 거래는 1000행을 쉽게 넘는다 — PostgREST 상한에 잘리지 않게 끝까지 넘겨 받는다 (fetchTableAll 과 같은 이유) */
    let all = [];
    for (let off = 0; ; off += 1000) {
      const { data, error } = await sb.from("ledger_entries").select("*")
        .gte("entry_date", y + "-01-01").lte("entry_date", y + "-12-31")
        .order("entry_date").order("id").range(off, off + 999);
      if (error) {
        if (error.code === "42P01" || /does not exist|schema cache|Could not find the table/i.test(error.message || "")) setMissing(true);
        else setLoadErr(error.message);
        setLoading(false); return;
      }
      all = all.concat(data || []);
      if (!data || data.length < 1000) break;
    }
    const r = await sb.from("ledger_rules").select("*");
    setEntries(all); setRules(r.data || []); setLoading(false);
  };
  useEffect(() => { load(year); }, [year]);
  useEffect(() => { ledgerLoadAlias().then(setAlias); }, []);

  const sum = useMemo(() => ledgerSummary(entries), [entries]);
  const list = useMemo(() => {
    const qq = q.replace(/\s/g, "");
    return entries.filter((e) => {
      const c = LEDGER_CAT[e.category];
      if (only === "none" && c) return false;
      if (only === "auto" && !(c && e.cat_by && e.cat_by !== "human")) return false;
      if (only === "income" && !(c && c.kind === "income")) return false;
      if (only === "expense" && !(c && c.kind === "expense")) return false;
      if (only === "etc" && !(c && ["asset", "transfer", "nonbiz"].includes(c.kind))) return false;
      if (qq) {
        const t = (e.entry_date + e.description + (e.account_label || "") + (c ? c.label : "미분류") + e.amount + (e.memo || "")).replace(/\s/g, "");
        if (!t.includes(qq)) return false;
      }
      return true;
    }).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }, [entries, only, q]);

  /** 바뀐 행 전체를 upsert — 부분 컬럼 upsert 는 NOT NULL 에 걸리므로 행을 통째로 보낸다 */
  const saveRows = async (rows) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from("ledger_entries").upsert(rows.slice(i, i + 500));
      if (error) return error;
    }
    return null;
  };
  const merge = (changed) => {
    const m = {}; changed.forEach((x) => { m[x.id] = x; });
    setEntries((cur) => cur.map((x) => m[x.id] || x));
  };

  /** 한 건을 고치면 같은 적요(자동 분류된 것)도 같이 바꾸고, 규칙으로 기억한다 */
  const setCat = async (e, cat) => {
    const k = ledgerKey(e.description);
    const same = cat && k.length >= 2 ? entries.filter((x) => x.id !== e.id && x.direction === e.direction && x.cat_by !== "human"
      && x.category !== cat && ledgerKey(x.description) === k) : [];
    const changed = [{ ...e, category: cat, cat_by: cat ? "human" : null, ai_confidence: null, ai_reason: null }]
      .concat(same.map((x) => ({ ...x, category: cat, cat_by: "learned", ai_confidence: null, ai_reason: null })));
    merge(changed);
    const error = await saveRows(changed);
    if (error) { alert("저장 실패: " + error.message); load(year); return; }
    if (cat && k.length >= 2) {
      await sb.from("ledger_rules").upsert({ direction: e.direction, pattern: k, category: cat, updated_at: new Date().toISOString() }, { onConflict: "direction,pattern" });
      setRules((cur) => cur.filter((r) => !(r.direction === e.direction && r.pattern === k)).concat([{ direction: e.direction, pattern: k, category: cat }]));
    }
    setMsg(same.length ? `같은 적요 ${same.length}건도 「${LEDGER_CAT[cat].label}」로 바꿨습니다.` : "");
  };

  const remove = async (e) => {
    if (!confirm(`${e.entry_date} ${e.description} ${won(e.amount)}\n이 거래를 장부에서 지울까요?`)) return;
    const { error } = await sb.from("ledger_entries").delete().eq("id", e.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    setEntries((cur) => cur.filter((x) => x.id !== e.id));
  };

  const reapply = async () => {
    const ctx = { rules, alias, targets: ledgerTargets(leases, buildings), leaseById: Object.fromEntries(leases.map((l) => [l.id, l])) };
    const changed = [];
    entries.forEach((e) => {
      if (LEDGER_CAT[e.category]) return;
      const r = ledgerClassify(e, ctx);
      if (r.category) changed.push({ ...e, ...r });
    });
    if (!changed.length) { setMsg("규칙으로 새로 분류할 거래가 없습니다."); return; }
    setBusy(true);
    const error = await saveRows(changed);
    setBusy(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    merge(changed);
    setMsg(`규칙으로 ${changed.length}건을 분류했습니다.`);
  };

  const runAI = async () => {
    const todo = entries.filter((e) => !LEDGER_CAT[e.category]);
    if (!todo.length) return;
    if (!confirm(`미분류 ${todo.length}건의 날짜·금액·적요를 AI(Anthropic Claude)에 보내 분류합니다.\n적요에 사람 이름이 들어 있을 수 있습니다. 계속할까요?`)) return;
    setBusy(true); setMsg("AI 분류 중…");
    try {
      const res = await ledgerAskAI(
        todo.map((e) => ({ id: e.id, date: e.entry_date, direction: e.direction, amount: e.amount, description: e.description, source: e.source })),
        (d, t) => setMsg(`AI 분류 중… ${d}/${t}`));
      const changed = todo.filter((e) => res[e.id]).map((e) => ({ ...e, category: res[e.id].category, cat_by: "ai",
        ai_confidence: res[e.id].confidence, ai_reason: res[e.id].reason }));
      const error = await saveRows(changed);
      if (error) throw new Error("저장 실패: " + error.message);
      merge(changed);
      setMsg(`AI가 ${changed.length}건을 분류했습니다. 「자동분류 확인」에서 훑어보세요.`);
    } catch (e) { setMsg(""); alert(e.message); }
    setBusy(false);
  };

  const years = [];
  for (let y = thisYear; y >= thisYear - 4; y--) years.push(y);
  const chip = (k, label) => (
    <button key={k} onClick={() => { setOnly(k); setShown(200); }}
      className={"text-xs rounded-full px-3 py-1 font-semibold border " + (only === k ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300")}>{label}</button>
  );
  const tabCls = (k) => "px-4 py-2 text-sm font-semibold border-b-2 " + (tab === k ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500");
  const autoCnt = entries.filter((e) => LEDGER_CAT[e.category] && e.cat_by && e.cat_by !== "human").length;
  const Stat = ({ label, value, tone }) => (
    <div className={"rounded-xl border p-3 " + (tone || "border-slate-200 bg-white")}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg sm:text-xl font-extrabold text-slate-800 break-all">{won(value)}</p>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="font-bold text-xl text-slate-800">📒 장부 · 세무</h2>
        <span className="text-xs bg-purple-100 text-purple-700 border border-purple-300 rounded-full px-2 py-0.5 font-semibold">관리자 전용</span>
        <select className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="연도">
          {years.map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div className="flex-1" />
        <button className={btnGhost} onClick={onBack}>← 관리모드</button>
        {!missing && <button className={btnGhost} onClick={() => setManual(true)}>✏️ 직접 입력</button>}
        {!missing && <button className={btnPrimary} onClick={() => setImp(true)}>📥 내역 가져오기</button>}
      </div>

      {missing ? (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-sm text-amber-900 break-keep leading-relaxed">
          <p className="font-bold mb-1">장부 테이블이 아직 없습니다.</p>
          <p>Supabase 대시보드 → SQL Editor 에서 저장소의 <code className="bg-white px-1 rounded">supabase/ledger.sql</code> 을 한 번 실행하면 바로 쓸 수 있습니다.</p>
        </div>
      ) : loading ? <p className="text-sm text-slate-400 py-8 text-center">불러오는 중…</p>
        : loadErr ? <p className="text-sm text-red-600 py-8 text-center">불러오지 못했습니다: {loadErr}</p> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <Stat label="총수입금액" value={sum.income} tone="border-emerald-200 bg-emerald-50" />
            <Stat label="필요경비" value={sum.expense} />
            <Stat label="소득금액 (감가상각 전)" value={sum.profit} tone="border-blue-200 bg-blue-50" />
          </div>
          {sum.uncat.n > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 mb-3 text-sm text-amber-900 flex items-center gap-2 flex-wrap">
              <span className="break-keep">⚠️ 미분류 <b>{sum.uncat.n}건</b> (입금 {won(sum.uncat.in)} · 출금 {won(sum.uncat.out)})은 위 합계에 빠져 있습니다.</span>
              <div className="flex-1" />
              <button className="text-xs border border-amber-400 rounded-lg px-2.5 py-1 bg-white font-semibold" onClick={reapply} disabled={busy}>규칙 다시 적용</button>
              <button className="text-xs border border-violet-300 text-violet-700 rounded-lg px-2.5 py-1 bg-white font-semibold" onClick={runAI} disabled={busy}>🤖 AI로 분류</button>
            </div>
          )}
          {msg && <p className="text-sm text-violet-700 mb-2">{msg}</p>}

          <div className="flex border-b border-slate-200 mb-3 overflow-x-auto">
            <button className={tabCls("list")} onClick={() => setTab("list")}>📄 거래내역</button>
            <button className={tabCls("summary")} onClick={() => setTab("summary")}>📊 요약</button>
            <button className={tabCls("filing")} onClick={() => setTab("filing")}>🧾 신고 준비</button>
          </div>

          {tab === "list" && (
            <>
              <div className="flex gap-1.5 mb-2 flex-wrap items-center">
                {chip("all", `전체 ${entries.length}`)}
                {chip("none", `미분류 ${sum.uncat.n}`)}
                {chip("auto", `자동분류 확인 ${autoCnt}`)}
                {chip("income", "수입")}
                {chip("expense", "경비")}
                {chip("etc", "기타")}
                <input className={inputCls + " flex-1 min-w-[140px] max-w-xs"} value={q} onChange={(e) => { setQ(e.target.value); setShown(200); }} placeholder="적요·날짜·과목 검색" />
              </div>
              {entries.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-500 break-keep">
                  {year}년 거래가 아직 없습니다.<br />
                  <button className={btnPrimary + " mt-3"} onClick={() => setImp(true)}>📥 통장·카드 내역 가져오기</button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead><tr className="text-slate-500 border-b text-xs">
                      <th className="text-left py-2 px-2">날짜</th><th className="text-left px-2">적요</th>
                      <th className="text-right px-2">금액</th><th className="text-left px-2">계정과목</th><th className="px-1"></th><th className="px-1"></th>
                    </tr></thead>
                    <tbody>
                      {list.length === 0 && <tr><td colSpan="6" className="text-center text-slate-400 py-8">해당하는 거래가 없습니다.</td></tr>}
                      {list.slice(0, shown).map((e) => (
                        <tr key={e.id} className="border-b hover:bg-slate-50" data-testid="ledger-row">
                          <td className="py-1.5 px-2 whitespace-nowrap text-slate-500 text-xs">{e.entry_date}</td>
                          <td className="px-2 text-xs break-all">{e.description || <span className="text-slate-300">·</span>}
                            {e.account_label && <span className="block text-[10px] text-slate-400">{e.source === "card" ? "💳" : e.source === "manual" ? "✏️" : "🏦"} {e.account_label}</span>}</td>
                          <td className="px-2 text-right text-xs">{ledgerAmt(e)}</td>
                          <td className="px-2"><LedgerCatSelect value={e.category} onChange={(v) => setCat(e, v)} disabled={busy} /></td>
                          <td className="px-1"><LedgerByBadge e={e} /></td>
                          <td className="px-1 text-right"><button className="text-slate-300 hover:text-red-500 text-base leading-none" title="지우기" onClick={() => remove(e)}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {list.length > shown && <button className="text-xs text-blue-600 underline mt-2 px-2" onClick={() => setShown(shown + 300)}>{list.length - shown}건 더 보기</button>}
                </div>
              )}
            </>
          )}

          {tab === "summary" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <h3 className="font-bold text-slate-800 mb-2">계정과목별</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.keys(LEDGER_KINDS).map((k) => {
                      const cats = LEDGER_CATS.filter((c) => c.kind === k && sum.cnt[c.key]);
                      if (!cats.length) return null;
                      return (
                        <React.Fragment key={k}>
                          <tr><td colSpan="3" className="pt-2 pb-1 text-xs font-bold text-slate-400">{LEDGER_KINDS[k]}</td></tr>
                          {cats.map((c) => (
                            <tr key={c.key} className="border-b border-slate-100">
                              <td className="py-1">{c.label}</td>
                              <td className="text-right text-xs text-slate-400">{sum.cnt[c.key]}건</td>
                              <td className="text-right font-semibold">{won(sum.byCat[c.key])}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {sum.uncat.n > 0 && <tr><td className="pt-2 text-amber-700">미분류</td><td className="pt-2 text-right text-xs text-slate-400">{sum.uncat.n}건</td><td className="pt-2 text-right text-amber-700 text-xs">입 {won(sum.uncat.in)} / 출 {won(sum.uncat.out)}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <h3 className="font-bold text-slate-800 mb-2">월별</h3>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-400 border-b"><th className="text-left py-1">월</th><th className="text-right">수입</th><th className="text-right">경비</th><th className="text-right">차이</th></tr></thead>
                  <tbody>
                    {sum.months.map((m, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1">{i + 1}월</td>
                        <td className="text-right">{m.income ? m.income.toLocaleString("ko-KR") : <span className="text-slate-300">-</span>}</td>
                        <td className="text-right">{m.expense ? m.expense.toLocaleString("ko-KR") : <span className="text-slate-300">-</span>}</td>
                        <td className={"text-right font-semibold " + (m.income - m.expense < 0 ? "text-red-600" : "")}>{m.income || m.expense ? (m.income - m.expense).toLocaleString("ko-KR") : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "filing" && (() => {
            const R = sum.income;
            const partial = year === thisYear;
            const checks = [
              { hit: R >= LEDGER_LIMITS.double, limit: LEDGER_LIMITS.double,
                yes: `${year + 1}년부터 복식부기의무자 — 재무상태표·손익계산서를 갖춘 장부를 써야 합니다.`,
                no: `${year + 1}년에도 간편장부대상자 — 수입·경비 장부만으로 신고할 수 있습니다. 복식부기로 신고하면 기장세액공제(산출세액 20%, 최대 100만원)도 받습니다.` },
              { hit: R >= LEDGER_LIMITS.external, limit: LEDGER_LIMITS.external,
                yes: `${year + 1}년 귀속 신고부터 외부조정 대상 — 세무사의 조정계산서를 붙여야 합니다. 안 붙이면 무신고로 봅니다.`,
                no: "외부조정 대상 아님 — 세무조정을 직접(자기조정) 해도 됩니다." },
              { hit: R >= LEDGER_LIMITS.sincere, limit: LEDGER_LIMITS.sincere,
                yes: `${year}년 귀속이 성실신고확인 대상 — 세무사 확인서가 필수이고 신고기한이 ${year + 1}년 6월 30일로 늘어납니다.`,
                no: `성실신고확인 대상 아님 — ${year + 1}년 5월 31일까지 직접 신고할 수 있습니다.` },
            ];
            const needCpa = R >= LEDGER_LIMITS.external;
            return (
              <div className="space-y-4 max-w-3xl">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-bold text-slate-800 mb-1">의무 판정 <span className="text-xs font-normal text-slate-400">부동산임대업 기준</span></h3>
                  <p className="text-sm text-slate-600 mb-3 break-keep">
                    {year}년 수입금액 <b>{won(R)}</b>
                    {partial && sum.lastDate && <span className="text-amber-700"> — {Number(sum.lastDate.slice(5, 7))}월 {Number(sum.lastDate.slice(8, 10))}일까지 들어온 것만. 연말까지 더 늘어납니다.</span>}
                  </p>
                  <ul className="space-y-2">
                    {checks.map((c, i) => (
                      <li key={i} className={"rounded-lg border px-3 py-2 text-sm break-keep " + (c.hit ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 text-slate-600")}>
                        <span className="font-bold mr-1">{c.hit ? "⚠️" : "✅"} {won(c.limit)} {c.hit ? "이상" : "미만"}</span> {c.hit ? c.yes : c.no}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-400 mt-2 break-keep">복식부기·외부조정은 직전연도 수입금액으로, 성실신고확인은 그해 수입금액으로 판정합니다. 신규 사업자 특례·세법 개정이 있을 수 있으니 확정 전에 국세청(126)에서 확인하세요.</p>
                </div>

                <div className={"rounded-xl p-4 border text-sm break-keep leading-relaxed " + (needCpa ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-emerald-50 border-emerald-200 text-emerald-900")}>
                  <h3 className="font-bold mb-1">{needCpa ? "세무사는 «연 1회 확인·조정»만" : "직접 신고할 수 있습니다"}</h3>
                  {needCpa ? (
                    <p>이 규모에선 세무사의 조정계산서{R >= LEDGER_LIMITS.sincere ? "·성실신고확인서" : ""}가 법으로 필요해서 세무사를 완전히 뺄 수는 없습니다. 대신 매달 기장을 맡길 필요는 없습니다. 이 장부를 엑셀로 넘기고 <b>신고 대리(조정·확인)만</b> 의뢰하면 기장료를 줄일 수 있습니다.</p>
                  ) : (
                    <p>홈택스에서 직접 종합소득세를 신고할 수 있습니다. 아래 엑셀의 계정별 합계를 신고서의 필요경비 항목에 옮겨 적으면 됩니다.</p>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-bold text-slate-800 mb-2">{year}년 귀속 일정</h3>
                  <ul className="text-sm text-slate-700 space-y-1.5 break-keep">
                    <li>📅 <b>{year + 1}년 2월 10일</b> · 사업장현황신고 — 면세사업자(주택임대)의 {year}년 수입금액을 신고합니다.</li>
                    <li>📅 <b>{year + 1}년 5월 31일</b> · 종합소득세 신고·납부{R >= LEDGER_LIMITS.sincere ? " (성실신고확인 대상은 6월 30일)" : ""}</li>
                    <li className="text-slate-500">주택임대는 부가가치세 면세라 부가세 신고는 없습니다.</li>
                  </ul>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-bold text-slate-800 mb-2">아직 이 장부에 없는 것 — 신고 전에 챙기기</h3>
                  <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5 break-keep">
                    {sum.uncat.n > 0 && <li className="text-amber-800">미분류 {sum.uncat.n}건 분류하기</li>}
                    {autoCnt > 0 && <li>자동 분류 {autoCnt}건 훑어보기 (「자동분류 확인」 필터)</li>}
                    <li><b>감가상각비</b> — 건물 취득가·취득일로 계산합니다(토지는 제외). 복식부기라면 가장 큰 경비입니다.</li>
                    <li><b>간주임대료</b> — 주택 3채 이상이고 보증금 합계가 3억원을 넘으면 보증금 이자 상당액을 수입에 더합니다(소형주택 제외 규정 확인).</li>
                    <li><b>통장 밖에서 낸 경비</b> — 다른 계좌·현금으로 낸 재산세·보험료·수리비는 「직접 입력」으로 넣습니다.</li>
                    <li><b>인건비</b>를 줬다면 원천세 신고·지급명세서 제출이 따로 필요합니다.</li>
                    <li>경비마다 <b>증빙</b>(세금계산서·카드전표·현금영수증·이체내역)을 5년 보관합니다.</li>
                  </ul>
                </div>

                <button className={btnPrimary + " w-full sm:w-auto py-3"} onClick={() => ledgerExport(year, entries, sum)} disabled={!entries.length}>📥 {year}년 장부 엑셀로 받기</button>
              </div>
            );
          })()}
        </>
      )}

      {imp && <LedgerImportModal leases={leases} buildings={buildings} rules={rules} onClose={() => setImp(false)}
        onSaved={({ inserted, total, year: y }) => {
          alert(`${inserted}건을 장부에 넣었습니다.` + (total - inserted > 0 ? `\n(이미 있던 ${total - inserted}건은 건너뜀)` : ""));
          if (y && y !== year) setYear(y); else load(year);
        }} />}
      {manual && <LedgerManualModal onClose={() => setManual(false)}
        onSaved={(d) => { const y = Number(d.slice(0, 4)); if (y !== year) setYear(y); else load(year); }} />}
    </div>
  );
}
