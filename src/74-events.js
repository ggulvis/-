/* 보담 — 이벤트 개설/수정
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 이벤트 개설/수정 ---------------- */
function EventModal({ event, leases, buildings, me, onClose, onSaved }) {
  const isNew = !event.id;
  const [title, setTitle] = useState(event.title || "");
  const [desc, setDesc] = useState(event.description || "");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(() => new Set(leases.filter((l) => event.id && l.event_id === event.id).map((l) => l.id)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bName = (id) => (buildings.find((b) => b.id === id) || {}).name || "";
  const qq = q.trim().toLowerCase();
  const filtered = leases.filter((l) => {
    if (!qq) return true;
    return bName(l.building_id).toLowerCase().includes(qq) ||
      (l.room_number || "").toLowerCase().includes(qq) ||
      (l.tenant_name || "").toLowerCase().includes(qq);
  });
  const toggle = (id) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectFiltered = () => setSel((p) => { const n = new Set(p); filtered.forEach((l) => n.add(l.id)); return n; });
  const clearFiltered = () => setSel((p) => { const n = new Set(p); filtered.forEach((l) => n.delete(l.id)); return n; });

  const save = async () => {
    if (!title.trim()) { setErr("이벤트 제목을 입력하세요."); return; }
    if (sel.size === 0 && !confirm("선택된 매물이 없습니다. 그래도 저장할까요?")) return;
    setBusy(true); setErr("");
    try {
      let evId = event.id;
      if (isNew) {
        const { data, error } = await sb.from("events").insert({
          title: title.trim(), description: desc.trim() || null,
          created_by: (me && (me.full_name || me.email)) || null,
        }).select().single();
        if (error) throw error;
        evId = data.id;
      } else {
        const { error } = await sb.from("events").update({ title: title.trim(), description: desc.trim() || null }).eq("id", event.id);
        if (error) throw error;
      }
      const prev = new Set(leases.filter((l) => l.event_id === evId).map((l) => l.id));
      const toAdd = [...sel].filter((id) => !prev.has(id));
      const toRemove = [...prev].filter((id) => !sel.has(id));
      if (toAdd.length) { const { error } = await sb.from("leases").update({ event_id: evId }).in("id", toAdd); if (error) throw error; }
      if (toRemove.length) { const { error } = await sb.from("leases").update({ event_id: null }).in("id", toRemove); if (error) throw error; }
      onSaved(); onClose();
    } catch (e2) { setErr("저장 실패: " + e2.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`"${event.title}" 이벤트를 삭제할까요? 매물의 이벤트 태그도 함께 해제됩니다.`)) return;
    setBusy(true);
    const { error } = await sb.from("events").delete().eq("id", event.id);
    setBusy(false);
    if (error) setErr("삭제 실패: " + error.message); else { onSaved(); onClose(); }
  };

  return (
    <Modal title={isNew ? "🎁 새 이벤트 개설" : "이벤트 수정"} onClose={onClose} wide>
      <Field label="이벤트 제목 *"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 7월 중개수수료 지원 이벤트" /></Field>
      <Field label="이벤트 내용"><textarea className={inputCls} rows="3" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="조건, 기간, 혜택 등을 적어주세요" /></Field>
      <div className="border-t pt-3">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-600">대상 매물 선택 <span className="text-rose-600">{sel.size}건</span></p>
          <div className="flex-1" />
          <button className="text-xs text-blue-600 font-semibold" onClick={selectFiltered}>검색결과 전체선택</button>
          <button className="text-xs text-slate-400 font-semibold" onClick={clearFiltered}>선택해제</button>
        </div>
        <input className={inputCls + " mb-2"} placeholder="건물명 · 호수 · 임차인으로 검색해서 추리세요" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="border rounded-xl max-h-64 overflow-y-auto divide-y">
          {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-6">검색 결과가 없습니다.</p>}
          {filtered.map((l) => (
            <label key={l.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" className="w-4 h-4 accent-rose-500 shrink-0" checked={sel.has(l.id)} onChange={() => toggle(l.id)} />
              <span className="text-sm min-w-0 truncate">
                <b className="text-slate-800">{bName(l.building_id)} {l.room_number}</b>
                {l.tenant_name && <span className="text-slate-500 ml-1.5">{l.tenant_name}</span>}
                <span className="text-slate-400 ml-1.5">만기 {fmtDate(l.end_date)}</span>
              </span>
              {l.event_id && l.event_id !== event.id && <span className="ml-auto text-[10px] shrink-0 text-amber-600 font-semibold">다른 이벤트 적용중</span>}
            </label>
          ))}
        </div>
      </div>
      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
      <div className="flex gap-2 pt-3 pb-2">
        <button className={btnPrimary + " flex-1 py-3"} onClick={save} disabled={busy}>{busy ? "저장 중..." : "저장"}</button>
        {!isNew && <button className={btnDanger} onClick={remove} disabled={busy}>삭제</button>}
        <button className={btnGhost} onClick={onClose}>취소</button>
      </div>
    </Modal>
  );
}

/* ---------------- 미납 관리 (채권추심) ----------------
   ⚠️ **단위가 둘이다** — leases 의 월세·관리비는 **만원**, payments.amount 는 **원**
      (은행 거래내역이 원 단위로 오기 때문). 섞으면 미납액이 1만 배 틀린다.
   ⚠️ **과거 입금 기록이 없다.** 그래서 «정산 시작월»(lease_billing.settle_from)부터만
      청구를 센다. 그 이전 미납은 opening_balance 에 사람이 넣는다. 이 장치가 없으면
      기능을 켜자마자 전 세대가 «수년치 미납»으로 떠서 아무 쓸모가 없다.
   · 화면 데이터는 fetchAll(1분 폴링)에 싣지 않고 **이 화면을 열 때만** 받는다.
     payments 는 615세대 × 매달 쌓여 금방 수천 행이 된다(§AE 사진 urls 와 같은 이유). */
const pad2 = (n) => String(n).padStart(2, "0");
const monthBill = (l) => ((Number(l.monthly_rent) || 0) + (Number(l.management_fee) || 0)) * 10000;
const won = (n) => (Number(n) || 0).toLocaleString("ko-KR") + "원";
const manwon = (n) => Math.round((Number(n) || 0) / 10000).toLocaleString("ko-KR") + "만원";

/** 정산 시작월부터 «납부일이 이미 지난» 달 수.
    `until` 이 있으면 그날까지만 센다 — **중도퇴실 세대는 퇴실일 뒤로 청구하면 안 된다.** */
function billedMonths(settleFrom, dueDay, today, until) {
  if (!settleFrom) return 0;
  const s = new Date(settleFrom + "T00:00:00");
  if (isNaN(s.getTime())) return 0;
  let end = today;
  if (until) {
    const u = new Date(until + "T00:00:00");
    if (!isNaN(u.getTime()) && u < end) end = u;
  }
  let y = s.getFullYear(), m = s.getMonth(), n = 0;
  for (let i = 0; i < 600; i++) {
    const last = new Date(y, m + 1, 0).getDate();      // 그 달의 말일 (31일 납부일 보정)
    if (new Date(y, m, Math.min(dueDay || 1, last)) > end) break;
    n++; m++; if (m > 11) { m = 0; y++; }
  }
  return n;
}

function arrearsOf(lease, bill, sum, today) {
  /* 월 청구 = 월세 + 관리비 + **부가 청구**(주차비 등).
     ⛔ 부가 청구를 leases.management_fee 에 합치지 않는 이유: 그 값은 **꿀방 광고로 나가고**
        희망가 치환·건물별 정리에도 쓰여서, 주차비를 얹으면 관리비가 부풀려 광고된다.
        받을 돈(미납 계산)과 내놓는 값(광고)은 다르다. */
  const extra = Number((bill && bill.extra_monthly) || 0);
  const monthly = monthBill(lease) + extra;
  const settle = (bill && bill.settle_from) || null;
  const dueDay = (bill && bill.due_day) || (lease.start_date ? Number(String(lease.start_date).slice(8, 10)) : 1);
  // ⚠️ 중도퇴실(move_out)은 **아직 사는 중**이라 청구 대상이다. 다만 퇴실일 뒤로는 안 센다.
  const months = billedMonths(settle, dueDay, today, lease.move_out ? lease.end_date : null);
  const opening = Number((bill && bill.opening_balance) || 0);
  const due = months * monthly + opening;
  const paid = Number((sum && sum.paid) || 0);
  const owed = due - paid;
  return { monthly, extra, extraLabel: (bill && bill.extra_label) || "",
           dueDay, months, opening, due, paid, owed, started: !!settle,
           exempt: !!(bill && bill.exempt), exemptWhy: (bill && bill.exempt_reason) || "",
           noDun: !!(bill && bill.no_dunning), noDunWhy: (bill && bill.no_dunning_reason) || "",
           checkNote: (bill && bill.check_note) || "",
           lastPaid: (sum && sum.last_paid) || null, leaving: !!lease.move_out,
           owedMonths: monthly > 0 ? Math.floor(owed / monthly) : 0 };
}

/** 은행 거래내역 붙여넣기 → 입금 후보. 형식이 제각각이라 느슨하게 읽고 **사람이 고친다**. */
const BANK_STOP = /^(입금|출금|잔액|이체|은행|계좌|거래|일시|적요|내용|메모|구분|비고|합계|수수료|카드|체크|해외|기업|국민|신한|우리|하나|농협|신협|새마을|토스|카카오|케이|KB|NH|IBK|SC|KEB|ATM|CMS|CD)$/i;
function parseBankText(text, defYear) {
  const out = [];
  (text || "").split(/\r?\n/).forEach((raw) => {
    const t = raw.replace(/\t/g, " ").trim();
    if (!t) return;
    let d = "", m;
    if ((m = t.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/))) d = m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
    else if ((m = t.match(/(?:^|[^\d])(\d{2})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/))) d = "20" + m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
    else if ((m = t.match(/(?:^|[^\d])(\d{1,2})[/.](\d{1,2})(?!\d)/))) d = defYear + "-" + pad2(m[1]) + "-" + pad2(m[2]);
    // 잔액과 계좌번호를 먼저 지운다 — 안 지우면 «잔액»을 입금액으로 읽는다(보통 더 크다)
    const s = t.replace(/잔액[^0-9]{0,6}[0-9,]+/g, " ").replace(/\d{2,6}-\d{2,6}-\d{2,8}/g, " ");
    const nums = [...s.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,})/g)]
      .map((x) => parseInt(x[1].replace(/,/g, ""), 10))
      .filter((n) => n >= 1000 && n <= 100000000);
    if (!nums.length) return;
    /* ★ 입금자 «표기 전체»를 남긴다. 이름만 뽑아 버리면 «502호류지훈»의 호수가 사라지고,
       «204호9월관리비»처럼 **이름이 아예 없는 줄**은 맞출 길이 없어진다.
       날짜·시각·금액·계좌번호만 지우고 나머지를 통째로 들고 간다(3자리 호수는 살린다). */
    const payerRaw = t
      .replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, " ")
      .replace(/(?:^|[^\d])\d{1,2}[/.]\d{1,2}(?!\d)/g, " ")
      .replace(/\d{1,2}:\d{2}(:\d{2})?/g, " ")
      .replace(/\d{1,3}(?:,\d{3})+|\d{4,}/g, " ")
      .replace(/[*]+/g, " ").trim();
    const names = (payerRaw.match(/[가-힣]{2,10}|[A-Za-z]{2,20}/g) || []).filter((w) => !BANK_STOP.test(w));
    out.push({ raw, payer_raw: payerRaw, paid_on: d, amount: Math.max(...nums),
               payer_name: names.length ? names[names.length - 1] : "", lease_id: "" });
  });
  return out;
}

/** 입금 한 줄 → 매물 배정. ⛔ **이름만 보면 안 된다** — 실제 입금자 표기는 제각각이다:
    `502호류지훈`(호수가 앞) · `202김승하`(호 없이) · `월세B103김현우` · `디에이치303유민주`
    · `유민주(7월월세)` · **`204호9월관리비`·`501관리비`(이름이 아예 없다)**
    2026-09-14 디에이치 실측: 이름만 보던 매처는 **매달 꼬박 낸 4세대를 「입금 0건」으로** 만들었다.
    ⚠️ 앱은 **여러 건물이 섞인** 내역을 받으므로 «호수만» 있으면 후보가 여럿이라 확정하지 않는다. */
function matchLease(payerRaw, targets, alias) {
  const t = (payerRaw || "").replace(/\s/g, "");
  if (!t) return "";
  for (const k of Object.keys(alias)) if (k && k.length >= 2 && t.includes(k)) return alias[k];
  const rooms = t.match(/\d{3}/g) || [];
  /** 후보가 여럿이면 **건물명으로 한 번 더 좁힌다** — '디에이치303유민주'처럼 동명이인이
      다른 건물에 있어도 건물명이 적혀 있으면 가를 수 있다. */
  const narrow = (list) => {
    if (list.length <= 1) return list;
    const b = list.filter((x) => x.bldKey && t.includes(x.bldKey));
    return b.length ? b : list;
  };
  const pick = (list) => { const n = narrow(list); return n.length === 1 ? n[0].id : ""; };
  const byBoth = targets.filter((x) => x.name && t.includes(x.name) && rooms.includes(x.roomNum));
  if (byBoth.length) return pick(byBoth);                      // ① 이름+호수
  const byBld = targets.filter((x) => x.bldKey && t.includes(x.bldKey) && rooms.includes(x.roomNum));
  if (byBld.length) return pick(byBld);                        // ② 건물명+호수
  const byName = targets.filter((x) => x.name && t.includes(x.name));
  if (byName.length) return pick(byName);                      // ③ 이름만 (유일할 때)
  return "";                                                   // ④ 호수만 → 건물을 모른다. 사람이 고른다
}

/* 거래내역 붙여넣기 → 매물에 배정 → 저장 */
function PaymentImportModal({ leases, buildings, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [alias, setAlias] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const year = new Date().getFullYear();
  const bName = (id) => (buildings.find((b) => b.id === id) || {}).name || "";
  const targets = useMemo(() => leases
    .filter((l) => !l.vacant)
    .map((l) => ({ id: l.id, label: bName(l.building_id) + " " + l.room_number + (l.tenant_name ? " · " + l.tenant_name : ""),
                   name: (l.tenant_name || "").replace(/\s/g, ""),
                   roomNum: String(l.room_number || "").replace(/\D/g, ""),
                   bldKey: bName(l.building_id).replace(/\s/g, "") }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko")), [leases, buildings]);

  useEffect(() => {
    sb.from("payer_alias").select("*").then(({ data }) => {
      const m = {}; (data || []).forEach((x) => { m[x.payer_name] = x.lease_id; }); setAlias(m);
    });
  }, []);

  const analyze = () => {
    const parsed = parseBankText(text, year);
    // 배정 순서: ①전에 지정해 둔 입금자명 ②세입자 이름 정확히 일치(유일할 때만)
    setRows(parsed.map((r) => ({ ...r, lease_id: matchLease(r.payer_raw || r.payer_name, targets, alias) })));
  };
  const upd = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async () => {
    const ok = (rows || []).filter((r) => r.lease_id && r.paid_on && r.amount > 0);
    if (!ok.length) { setErr("저장할 행이 없습니다. 날짜·금액·매물을 채워주세요."); return; }
    setBusy(true); setErr("");
    const { error } = await sb.from("payments").upsert(
      ok.map((r) => ({ lease_id: r.lease_id, paid_on: r.paid_on, amount: r.amount,
                       payer_name: (r.payer_raw || r.payer_name || null), raw: r.raw, source: "붙여넣기" })),
      { onConflict: "lease_id,paid_on,amount,payer_name", ignoreDuplicates: true });
    if (error) { setBusy(false); setErr(error.message); return; }
    // 이번에 사람이 지정한 입금자명은 기억해 둔다 — 가족 명의 입금도 다음부터 자동 배정된다
    /* 표기 «전체»를 기억한다 — '502호류지훈' 같은 줄이 다음에도 그대로 붙는다.
       ⚠️ 짝(표기↔매물)을 **먼저** 만들고 중복을 없앤다. filter 를 먼저 걸면 뒤따르는 map 의
          인덱스가 «걸러진 배열» 기준이 되어 **엉뚱한 매물에 이름이 기억된다.** */
    const seen = new Set(), al = [];
    ok.forEach((r) => {
      const k = (r.payer_raw || r.payer_name || "").replace(/\s/g, "");
      if (k.length >= 2 && !seen.has(k)) { seen.add(k); al.push({ payer_name: k, lease_id: r.lease_id }); }
    });
    if (al.length) await sb.from("payer_alias").upsert(al, { onConflict: "payer_name" });
    setBusy(false); onSaved(ok.length); onClose();
  };

  const unassigned = (rows || []).filter((r) => !r.lease_id).length;
  return (
    <Modal title="💳 거래내역 넣기" onClose={onClose} wide>
      {!rows ? (
        <>
          <p className="text-sm text-slate-500 mb-2 break-keep">
            은행 앱의 거래내역이나 입금 알림 문자를 <b>그대로 붙여넣으세요.</b> 한 줄에 한 건으로 읽습니다.
            날짜·금액·입금자명을 뽑아내며, <b>저장 전에 직접 고칠 수 있습니다.</b>
          </p>
          <textarea className={inputCls + " min-h-[220px] font-mono text-xs"} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"예)\n09/13 15:32 홍길동 500,000 입금 잔액 1,234,567\n2026-09-11 김철수 450000\n[KB]09/05 이영희 620,000 입금"} />
          <button className={btnPrimary + " w-full mt-3"} disabled={!text.trim()} onClick={analyze}>해석하기</button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-700">{rows.length}건 읽음</span>
            {unassigned > 0 && <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-semibold">매물 미지정 {unassigned}건</span>}
            <div className="flex-1" />
            <button className={btnGhost} onClick={() => setRows(null)}>← 다시 붙여넣기</button>
          </div>
          <p className="text-xs text-slate-400 mb-2 break-keep">매물을 안 고른 행은 저장되지 않습니다. 한 번 고르면 그 입금자명은 다음부터 자동 배정됩니다.</p>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs min-w-[620px]">
              <thead><tr className="text-slate-500 border-b">
                <th className="text-left py-1.5 px-1">날짜</th><th className="text-right px-1">금액</th>
                <th className="text-left px-1">입금자 표기</th><th className="text-left px-1">매물</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={"border-b " + (r.lease_id ? "" : "bg-amber-50")}>
                    <td className="py-1 px-1"><input className="w-24 border rounded px-1 py-0.5" value={r.paid_on} onChange={(e) => upd(i, "paid_on", e.target.value)} placeholder="2026-09-13" /></td>
                    <td className="px-1 text-right"><input className="w-24 border rounded px-1 py-0.5 text-right" value={r.amount} onChange={(e) => upd(i, "amount", Number(e.target.value.replace(/\D/g, "")) || 0)} /></td>
                    <td className="px-1"><input className="w-32 border rounded px-1 py-0.5" title={r.raw}
                      value={r.payer_raw != null ? r.payer_raw : r.payer_name}
                      onChange={(e) => upd(i, "payer_raw", e.target.value)} /></td>
                    <td className="px-1">
                      <select className="w-full border rounded px-1 py-0.5" value={r.lease_id} onChange={(e) => upd(i, "lease_id", e.target.value)}>
                        <option value="">— 고르세요 —</option>
                        {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
          <button className={btnPrimary + " w-full mt-3"} disabled={busy} onClick={save}>
            {busy ? "저장 중…" : `매물이 지정된 ${rows.length - unassigned}건 저장`}
          </button>
        </>
      )}
    </Modal>
  );
}

/* ---------------- 미납 독촉 문자 (본인 휴대폰 발송) ----------------
   업체(알리고 등) 없이 **관리인 본인 폰의 문자 앱**을 열어 보낸다. 비용 0원·준비 0.
   ⚠️ **sms: 문법이 기기마다 다르다** — iOS 는 `sms:번호&body=`, 안드로이드는 `sms:번호?body=`.
      한쪽 문법으로 통일하면 다른 쪽에서 **본문이 통째로 비어서 열린다**(빈 문자를 보내게 된다).
   ⚠️ 문자 앱으로 넘어가면 앱은 **보냈는지 알 수 없다.** 그래서 추측하지 않고
      돌아온 사람에게 «보내셨어요?»를 눌러 달라고 해서 그때만 기록한다. */
const isIOSDevice = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS 13+ 는 Mac 으로 위장한다
function smsHref(phone, body) {
  const p = String(phone || "").replace(/[^0-9]/g, "");
  if (!p) return "";
  if (!body) return "sms:" + p;
  return "sms:" + p + (isIOSDevice() ? "&" : "?") + "body=" + encodeURIComponent(body);
}

const SMS_TOKENS = ["이름", "건물", "호수", "미납액", "개월", "월청구", "계좌", "문의처"];
function fillTemplate(tpl, ctx) {
  return SMS_TOKENS.reduce((s, k) => s.split("{" + k + "}").join(ctx[k] == null ? "" : String(ctx[k])), tpl || "");
}

/* 대상을 한 명씩 넘기며 문자 앱을 연다 — 본인 폰 방식은 «한 번에 한 명»이 한계라
   그 제약을 줄 세워서 흐름으로 만든다. */
function SmsComposeModal({ queue, settings, accounts, me, onClose, onDone }) {
  const [idx, setIdx] = useState(0);
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(0);
  const [tplOpen, setTplOpen] = useState(false);
  const [tpl, setTpl] = useState(settings.sms_template || "");
  const [contact, setContact] = useState(settings.sms_contact || "");
  const [acct, setActt] = useState(settings.sms_account || "");
  const [busy, setBusy] = useState(false);
  const cur = queue[idx];

  const ctxOf = (row) => ({
    이름: row.l.tenant_name || "",
    건물: row.b,
    호수: row.l.room_number,
    미납액: Math.round(row.a.owed).toLocaleString("ko-KR"),
    개월: row.a.owedMonths,
    월청구: Math.round(row.a.monthly).toLocaleString("ko-KR"),
    // 건물별 계좌가 자료실(building_info)에 있으면 그걸, 없으면 기본 계좌를 쓴다
    계좌: accounts[row.b] || acct || "",
    문의처: contact || "",
  });
  useEffect(() => { if (cur) setBody(fillTemplate(tpl, ctxOf(cur))); }, [idx, tpl, contact, acct]);

  const next = () => { if (idx + 1 < queue.length) setIdx(idx + 1); else onDone(sent); };
  const record = async () => {
    setBusy(true);
    await sb.from("collection_log").insert({
      lease_id: cur.l.id, by_name: me.full_name || me.email, action: "문자", result: "발송",
      note: body.slice(0, 300),
    });
    setBusy(false); setSent(sent + 1);
    if (idx + 1 < queue.length) setIdx(idx + 1); else onDone(sent + 1);
  };
  const saveTpl = async () => {
    setBusy(true);
    await sb.from("app_settings").upsert([
      { key: "sms_template", value: tpl, updated_at: new Date().toISOString() },
      { key: "sms_contact", value: contact, updated_at: new Date().toISOString() },
      { key: "sms_account", value: acct, updated_at: new Date().toISOString() },
    ], { onConflict: "key" });
    setBusy(false); setTplOpen(false);
  };

  if (!cur) return null;
  const phone = (cur.l.tenant_phone || "").replace(/[^0-9]/g, "");
  return (
    <Modal title={`💬 독촉 문자 — ${idx + 1} / ${queue.length}`} onClose={onClose}>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3">
        <p className="font-bold text-slate-800">{cur.b} {cur.l.room_number} · {cur.l.tenant_name || "(세입자 미상)"}</p>
        <p className="text-sm text-slate-500">{cur.l.tenant_phone || "연락처 없음"}</p>
        <p className="text-sm mt-1">미납 <b className="text-red-600">{won(cur.a.owed)}</b>
          {cur.a.owedMonths > 0 && <span className="text-red-500"> · {cur.a.owedMonths}개월</span>}</p>
      </div>

      <Field label="보낼 내용 (여기서 고쳐도 됩니다)">
        <textarea className={inputCls + " min-h-[120px]"} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <p className="text-xs text-slate-400 -mt-2 mb-3">{body.length}자 · 한글 45자를 넘으면 장문(LMS)으로 나갑니다.</p>

      {phone ? (
        <a className={btnPrimary + " w-full block text-center mb-2"} href={smsHref(phone, body)}>
          📱 문자 앱에서 열기
        </a>
      ) : (
        <p className="text-sm text-red-600 mb-2">연락처가 없어 보낼 수 없습니다.</p>
      )}
      <p className="text-xs text-slate-400 mb-3 break-keep">
        문자 앱이 열리면 <b>보내기</b>를 누르시고, 돌아와서 아래 버튼을 눌러주세요.
        앱은 실제로 보냈는지 알 수 없어서 <b>눌러주신 것만 기록</b>합니다.
      </p>

      <div className="flex gap-2">
        <button className={btnPrimary + " flex-1"} disabled={busy || !phone} onClick={record}>
          ✅ 보냈어요 {idx + 1 < queue.length ? "· 다음" : "· 완료"}
        </button>
        <button className={btnGhost} onClick={next}>건너뛰기</button>
      </div>

      <button className="text-xs text-slate-400 underline mt-4" onClick={() => setTplOpen(!tplOpen)}>
        {tplOpen ? "문구 설정 닫기" : "⚙️ 문구 설정"}
      </button>
      {tplOpen && (
        <div className="mt-2 border-t pt-3">
          <Field label="문구 템플릿">
            <textarea className={inputCls + " min-h-[90px] text-sm"} value={tpl} onChange={(e) => setTpl(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-400 -mt-2 mb-2 break-keep">
            쓸 수 있는 항목: {SMS_TOKENS.map((t) => "{" + t + "}").join(" · ")}<br />
            <b>{"{계좌}"}</b>는 자료실 건물정보의 계좌를 먼저 쓰고, 없으면 아래 기본 계좌를 씁니다.
          </p>
          <Field label="기본 입금계좌"><input className={inputCls} value={acct} onChange={(e) => setActt(e.target.value)} placeholder="예: 국민 123-45-6789 보담" /></Field>
          <Field label="문의처"><input className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <button className={btnGhost + " w-full"} disabled={busy} onClick={saveTpl}>문구 설정 저장</button>
        </div>
      )}
    </Modal>
  );
}

/* 퇴실 정산서 — 보증금에서 미납·청소비 등을 빼고 얼마를 돌려주는지 남긴다.
   ⚠️ **스냅샷이 핵심**: leases 행은 다음 세입자로 덮어써지므로 세입자·호수를 여기 박아 둔다.
      그래야 «누가 언제 얼마를 왜 뺐는지»가 남아 나중에 분쟁의 근거가 된다.
      (2026-09-14 실측: 보담에 과거 세입자 기록이 아예 없어 퇴실 정산을 확인할 수 없었다.) */
const SETTLE_ITEMS = ["미납 월세·관리비", "청소비", "원상복구비", "중개보수", "장기수선충당금", "기타"];
const todayYmd = () => { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };

function settleText(s) {
  const L = [];
  L.push(`[퇴실 정산서] ${s.building_name || ""} ${s.room_number || ""}`);
  if (s.tenant_name) L.push(`세입자: ${s.tenant_name}`);
  if (s.moved_out_on) L.push(`퇴실일: ${s.moved_out_on}`);
  L.push(`보증금: ${won(s.deposit)}`);
  (s.items || []).filter((x) => Number(x.amount) > 0).forEach((x) =>
    L.push(` − ${x.label}${x.note ? `(${x.note})` : ""}: ${won(x.amount)}`));
  L.push(`────────────────`);
  L.push(`반환액: ${won(s.refund)}`);
  if (s.account) L.push(`입금계좌: ${s.account}`);
  if (s.refunded_on) L.push(`반환일: ${s.refunded_on}`);
  if (s.note) L.push(s.note);
  return L.join("\n");
}

/* 한 매물의 퇴실 정산서 — 작성 + 지난 기록 */
function SettlementSection({ lease, building, arrears, me, onSaved }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(null);

  const load = async () => {
    const { data } = await sb.from("move_out_settlements").select("*")
      .eq("lease_id", lease.id).order("created_at", { ascending: false });
    setList(data || []);
  };
  useEffect(() => { load(); }, [lease.id]);

  const start = () => {
    // 미납액은 미납 관리에서 계산된 값을 그대로 가져온다 — 두 번 계산하지 않는다
    const owed = Math.max(Math.round((arrears && arrears.owed) || 0), 0);
    setF({
      moved_out_on: lease.end_date || todayYmd(),
      deposit: String(Math.round((Number(lease.deposit) || 0) * 10000)),
      items: [{ label: "미납 월세·관리비", amount: String(owed), note: "" }],
      refunded_on: "", account: "", note: "",
    });
    setOpen(true);
  };
  const setItem = (i, k, v) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const addItem = () => setF({ ...f, items: [...f.items, { label: "청소비", amount: "", note: "" }] });
  const delItem = (i) => setF({ ...f, items: f.items.filter((_, j) => j !== i) });

  const deduct = f ? f.items.reduce((s, x) => s + (Number(x.amount) || 0), 0) : 0;
  const refund = f ? (Number(f.deposit) || 0) - deduct : 0;

  const save = async () => {
    if (!f.moved_out_on) { alert("퇴실일을 넣어주세요."); return; }
    if (refund < 0 && !confirm("반환액이 마이너스입니다. 그대로 저장할까요?")) return;
    setBusy(true);
    const { error } = await sb.from("move_out_settlements").insert({
      lease_id: lease.id,
      building_name: (building && building.name) || null, room_number: lease.room_number,
      tenant_name: lease.tenant_name || null, tenant_phone: lease.tenant_phone || null,
      moved_out_on: f.moved_out_on,
      deposit: Number(f.deposit) || 0,
      items: f.items.filter((x) => x.label && Number(x.amount) > 0)
        .map((x) => ({ label: x.label, amount: Number(x.amount), note: x.note || "" })),
      deduct_total: deduct, refund,
      refunded_on: f.refunded_on || null, account: f.account || null, note: f.note || null,
      created_by: me.full_name || me.email,
    });
    setBusy(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    setOpen(false); setF(null); load(); if (onSaved) onSaved();
  };

  const phone = (lease.tenant_phone || "").replace(/[^0-9]/g, "");
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-semibold text-slate-700 text-sm">🧾 퇴실 정산서 {list.length > 0 && `(${list.length})`}</h4>
        <div className="flex-1" />
        {!open && <button className={btnGhost + " text-xs py-1"} onClick={start}>＋ 새로 작성</button>}
      </div>

      {open && f && (
        <div className="bg-slate-50 rounded-xl p-3 mb-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="퇴실일"><input type="date" className={inputCls} value={f.moved_out_on}
              onChange={(e) => setF({ ...f, moved_out_on: e.target.value })} /></Field>
            <Field label="보증금(원)"><input className={inputCls} value={f.deposit}
              onChange={(e) => setF({ ...f, deposit: e.target.value.replace(/[^0-9]/g, "") })} /></Field>
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">뺄 금액</p>
          {f.items.map((x, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <select className={inputCls + " w-32 shrink-0"} value={x.label} onChange={(e) => setItem(i, "label", e.target.value)}>
                {SETTLE_ITEMS.concat(SETTLE_ITEMS.includes(x.label) ? [] : [x.label]).map((n) => <option key={n}>{n}</option>)}
              </select>
              <input className={inputCls + " w-28 shrink-0 text-right"} value={x.amount} placeholder="0"
                onChange={(e) => setItem(i, "amount", e.target.value.replace(/[^0-9]/g, ""))} />
              <input className={inputCls} value={x.note} placeholder="메모(선택)" onChange={(e) => setItem(i, "note", e.target.value)} />
              <button className="text-red-500 text-sm px-1 shrink-0" onClick={() => delItem(i)}>×</button>
            </div>
          ))}
          <button className="text-xs text-blue-600 underline mb-2" onClick={addItem}>＋ 항목 추가</button>

          <div className="bg-white rounded-lg border p-2 mb-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">보증금</span><b>{won(f.deposit)}</b></div>
            <div className="flex justify-between"><span className="text-slate-500">뺄 금액 합계</span><b className="text-red-600">− {won(deduct)}</b></div>
            <div className="flex justify-between border-t mt-1 pt-1">
              <span className="font-semibold">반환액</span>
              <b className={refund < 0 ? "text-red-600 text-lg" : "text-emerald-600 text-lg"}>{won(refund)}</b>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="반환일(선택)"><input type="date" className={inputCls} value={f.refunded_on}
              onChange={(e) => setF({ ...f, refunded_on: e.target.value })} /></Field>
            <Field label="반환 계좌(선택)"><input className={inputCls} value={f.account}
              onChange={(e) => setF({ ...f, account: e.target.value })} placeholder="은행 계좌 예금주" /></Field>
          </div>
          <Field label="메모(선택)"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <div className="flex gap-2">
            <button className={btnPrimary + " flex-1"} disabled={busy} onClick={save}>저장</button>
            <button className={btnGhost} onClick={() => { setOpen(false); setF(null); }}>취소</button>
          </div>
        </div>
      )}

      {list.length === 0 && !open && <p className="text-xs text-slate-400">아직 없습니다. 퇴실이 확정되면 작성해 두세요 — 나중에 분쟁이 나면 이게 근거가 됩니다.</p>}
      {list.map((s) => (
        <div key={s.id} className="border rounded-lg p-2 mb-2 text-sm">
          <div className="flex items-baseline gap-2 flex-wrap">
            <b>{s.moved_out_on} 퇴실</b>
            <span className="text-slate-500">{s.tenant_name}</span>
            <div className="flex-1" />
            <b className={s.refund < 0 ? "text-red-600" : "text-emerald-600"}>반환 {won(s.refund)}</b>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            보증금 {won(s.deposit)} − 공제 {won(s.deduct_total)}
            {(s.items || []).length > 0 && " · " + s.items.map((x) => `${x.label} ${won(x.amount)}`).join(" · ")}
          </p>
          {s.refunded_on && <p className="text-xs text-slate-400">반환일 {s.refunded_on}{s.account ? ` · ${s.account}` : ""}</p>}
          <div className="flex gap-2 mt-1">
            <button className="text-xs text-blue-600 underline"
              onClick={() => { navigator.clipboard && navigator.clipboard.writeText(settleText(s)); alert("정산서를 복사했습니다."); }}>
              📋 내용 복사
            </button>
            {phone && <a className="text-xs text-blue-600 underline" href={smsHref(phone, settleText(s))}>💬 세입자에게 문자</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* 매물 1건 — 정산 설정 · 입금 내역 · 추심 연락 기록 */
function CollectionModal({ lease, building, bill, me, onClose, onSaved }) {
  const [pays, setPays] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settle, setSettle] = useState((bill && bill.settle_from) || "");
  const [opening, setOpening] = useState(String((bill && bill.opening_balance) || 0));
  const [dueDay, setDueDay] = useState(String((bill && bill.due_day) || ""));
  const [act, setAct] = useState({ action: "전화", result: "부재", promise_date: "", note: "" });
  const [exempt, setExempt] = useState(!!(bill && bill.exempt));
  const [exemptWhy, setExemptWhy] = useState((bill && bill.exempt_reason) || "");
  const [noDun, setNoDun] = useState(!!(bill && bill.no_dunning));
  const [noDunWhy, setNoDunWhy] = useState((bill && bill.no_dunning_reason) || "");
  const [extra, setExtra] = useState(String((bill && bill.extra_monthly) || 0));
  const [extraLabel, setExtraLabel] = useState((bill && bill.extra_label) || "");
  const [checkNote, setCheckNote] = useState((bill && bill.check_note) || "");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const [p, c] = await Promise.all([
      sb.from("payments").select("*").eq("lease_id", lease.id).order("paid_on", { ascending: false }),
      sb.from("collection_log").select("*").eq("lease_id", lease.id).order("acted_at", { ascending: false }),
    ]);
    setPays(p.data || []); setLogs(c.data || []);
  };
  useEffect(() => { load(); }, [lease.id]);

  const saveBill = async () => {
    if (!settle) { alert("정산 시작월을 정해주세요."); return; }
    setBusy(true);
    const { error } = await sb.from("lease_billing").upsert({
      lease_id: lease.id, settle_from: settle, opening_balance: Number(opening) || 0,
      due_day: dueDay ? Number(dueDay) : null, exempt, exempt_reason: exemptWhy || null,
      no_dunning: noDun, no_dunning_reason: noDunWhy || null,
      extra_monthly: Number(extra) || 0, extra_label: extraLabel || null,
      check_note: checkNote || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "lease_id" });
    setBusy(false);
    if (error) alert("저장 실패: " + error.message); else onSaved();
  };
  const addLog = async () => {
    setBusy(true);
    const { error } = await sb.from("collection_log").insert({
      lease_id: lease.id, by_name: me.full_name || me.email, action: act.action, result: act.result,
      promise_date: act.promise_date || null, note: act.note || null,
    });
    setBusy(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    setAct({ action: "전화", result: "부재", promise_date: "", note: "" });
    load();
  };
  const delPay = async (id) => {
    if (!confirm("이 입금 기록을 지울까요?")) return;
    await sb.from("payments").delete().eq("id", id); load(); onSaved();
  };

  const a = arrearsOf(lease, { settle_from: settle, opening_balance: Number(opening) || 0, due_day: dueDay ? Number(dueDay) : null }, { paid: pays.reduce((s, p) => s + Number(p.amount), 0) }, new Date());
  const phone = (lease.tenant_phone || "").replace(/[^0-9]/g, "");
  return (
    <Modal title={`💰 ${(building && building.name) || ""} ${lease.room_number} — 미납 관리`} onClose={onClose} wide>
      <div className="rounded-xl border border-slate-200 p-3 mb-3 bg-slate-50">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-slate-800">{lease.tenant_name || "(세입자 미상)"}</span>
          {lease.tenant_phone && <span className="text-sm text-slate-500">{lease.tenant_phone}</span>}
          <div className="flex-1" />
          {phone && <a className={btnGhost} href={"tel:" + phone}>📞 전화</a>}
          {phone && <a className={btnGhost} href={"sms:" + phone}>💬 문자</a>}
        </div>
        <p className="text-sm mt-2">
          월 청구 <b>{won(a.monthly)}</b> (월세 {lease.monthly_rent || 0}만 + 관리비 {lease.management_fee || 0}만
          {a.extra > 0 && <span className="text-violet-600"> + {a.extraLabel || "부가"} {manwon(a.extra)}</span>}) ·
          납부일 매월 <b>{a.dueDay}일</b>
        </p>
        <p className="text-sm mt-1">
          청구 {a.months}개월 {won(a.months * a.monthly)}{a.opening ? " + 기초미납 " + won(a.opening) : ""} − 입금 {won(a.paid)} ={" "}
          <b className={a.owed > 0 ? "text-red-600" : "text-emerald-600"}>{a.owed > 0 ? "미납 " + won(a.owed) : "미납 없음"}</b>
        </p>
      </div>

      <h4 className="font-semibold text-slate-700 text-sm mb-1">정산 설정</h4>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Field label="정산 시작월"><input type="date" className={inputCls} value={settle} onChange={(e) => setSettle(e.target.value)} /></Field>
        <Field label="기초 미납(원)"><input className={inputCls} value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^0-9]/g, ""))} /></Field>
        <Field label="납부일(비우면 입주일)"><input className={inputCls} value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/[^0-9]/g, ""))} placeholder={String(a.dueDay)} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="부가 월 청구(원)"><input className={inputCls} value={extra}
          onChange={(e) => setExtra(e.target.value.replace(/[^0-9]/g, ""))} placeholder="예: 주차비 50000" /></Field>
        <div className="col-span-2"><Field label="부가 청구 내용"><input className={inputCls} value={extraLabel}
          onChange={(e) => setExtraLabel(e.target.value)} placeholder="예: 주차비" /></Field></div>
      </div>
      <p className="text-xs text-slate-400 -mt-2 mb-2 break-keep">
        주차비처럼 <b>계약서 관리비에 없지만 매달 받는 돈</b>을 여기 넣습니다.
        매물의 관리비에 합치면 <b>꿀방 광고에 관리비가 부풀려 나갑니다.</b>
      </p>
      <label className="flex items-start gap-2 mb-2 text-sm">
        <input type="checkbox" className="mt-1" checked={exempt} onChange={(e) => setExempt(e.target.checked)} />
        <span><b>청구 면제</b> — 받을 돈이 없는 세대(예: 전세인데 관리비 면제).
          <span className="text-slate-400"> 「금액없음」(입력 빠짐)과 구분해서 표시합니다.</span></span>
      </label>
      {exempt && <Field label="면제 사유"><input className={inputCls} value={exemptWhy}
        onChange={(e) => setExemptWhy(e.target.value)} placeholder="예: 전세·관리비 면제 (사장님 확인)" /></Field>}
      <label className="flex items-start gap-2 mb-2 text-sm">
        <input type="checkbox" className="mt-1" checked={noDun} onChange={(e) => setNoDun(e.target.checked)} />
        <span><b>독촉 보류</b> — 미납은 그대로 세되 <b>문자 일괄 발송에서만</b> 뺍니다
          <span className="text-slate-400"> (예: 퇴실 정산에서 보증금으로 차감 예정)</span></span>
      </label>
      {noDun && <Field label="보류 사유"><input className={inputCls} value={noDunWhy}
        onChange={(e) => setNoDunWhy(e.target.value)} placeholder="왜 독촉하지 않는지 남겨두세요" /></Field>}
      <Field label="⚠️ 확인 필요 (적어두면 목록에 빨간 배지로 뜹니다)">
        <textarea className={inputCls + " min-h-[54px] text-sm"} value={checkNote}
          onChange={(e) => setCheckNote(e.target.value)}
          placeholder="예: 입금이 끊겼는데 면제인지 미납인지 모름 — 사장님 확인" />
      </Field>
      <button className={btnPrimary + " w-full mb-4"} disabled={busy} onClick={saveBill}>정산 설정 저장</button>

      <h4 className="font-semibold text-slate-700 text-sm mb-1">입금 내역 {pays.length}건</h4>
      <div className="border rounded-lg divide-y mb-4 max-h-44 overflow-y-auto">
        {pays.length === 0 && <p className="text-xs text-slate-400 p-3">아직 없습니다.</p>}
        {pays.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
            <span className="text-slate-500 w-24 shrink-0">{p.paid_on}</span>
            <span className="font-semibold">{won(p.amount)}</span>
            <span className="text-slate-400 text-xs truncate">{p.payer_name || ""}</span>
            <div className="flex-1" />
            <button className="text-xs text-red-500 hover:underline shrink-0" onClick={() => delPay(p.id)}>삭제</button>
          </div>
        ))}
      </div>

      <h4 className="font-semibold text-slate-700 text-sm mb-1">추심 기록</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="방법"><select className={inputCls} value={act.action} onChange={(e) => setAct({ ...act, action: e.target.value })}>
          {["전화", "문자", "카톡", "방문", "내용증명"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="결과"><select className={inputCls} value={act.result} onChange={(e) => setAct({ ...act, result: e.target.value })}>
          {["통화됨", "부재", "지급약속", "거부", "일부입금"].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="약속일"><input type="date" className={inputCls} value={act.promise_date} onChange={(e) => setAct({ ...act, promise_date: e.target.value })} /></Field>
        <Field label="메모"><input className={inputCls} value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value })} /></Field>
      </div>
      <button className={btnGhost + " w-full mb-3"} disabled={busy} onClick={addLog}>＋ 기록 남기기</button>
      <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
        {logs.length === 0 && <p className="text-xs text-slate-400 p-3">아직 없습니다.</p>}
        {logs.map((c) => (
          <div key={c.id} className="px-3 py-1.5 text-sm">
            <span className="text-slate-500 text-xs">{String(c.acted_at).slice(0, 10)}</span>{" "}
            <b>{c.action}</b> · {c.result}
            {c.promise_date && <span className="text-amber-600"> · 약속 {c.promise_date}</span>}
            <span className="text-slate-400 text-xs"> · {c.by_name}</span>
            {c.note && <p className="text-xs text-slate-500 break-keep">{c.note}</p>}
          </div>
        ))}
      </div>

      <SettlementSection lease={lease} building={building} arrears={a} me={me} onSaved={onSaved} />
    </Modal>
  );
}

/* 미납 현황 — 채권추심 작업 화면 */
function ArrearsView({ leases, buildings, me, onBack }) {
  const [bills, setBills] = useState({});
  const [sums, setSums] = useState({});
  const [loading, setLoading] = useState(true);
  const [only, setOnly] = useState("owed");   // owed | all | notset
  const [q, setQ] = useState("");
  const [imp, setImp] = useState(false);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(() => new Set());   // 문자 보낼 대상 (lease id)
  const [settings, setSettings] = useState({});      // 문구 템플릿·기본계좌·문의처
  const [accounts, setAccounts] = useState({});      // 건물명 → 입금계좌 (자료실 건물정보)
  const [smsQ, setSmsQ] = useState(null);            // 문자 보내기 대기열
  const today = new Date();

  const load = async () => {
    setLoading(true);
    const [b, s, st, bi] = await Promise.all([
      fetchTableAll("lease_billing", "*", ["lease_id"]),
      fetchTableAll("payment_summary", "*", ["lease_id"]),
      sb.from("app_settings").select("*"),
      sb.from("building_info").select("name, owner_account"),   // 건물별 입금계좌 (56행)
    ]);
    const bm = {}, sm = {}, cf = {}, ac = {};
    (b.data || []).forEach((x) => { bm[x.lease_id] = x; });
    (s.data || []).forEach((x) => { sm[x.lease_id] = x; });
    (st.data || []).forEach((x) => { cf[x.key] = x.value; });
    (bi.data || []).forEach((x) => { if (x.owner_account) ac[x.name] = x.owner_account; });
    setBills(bm); setSums(sm); setSettings(cf); setAccounts(ac); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const bName = (id) => (buildings.find((x) => x.id === id) || {}).name || "";
  // 청구 대상 = 점유중 + 월 청구액 > 0 (전세라 관리비만 있는 집도 대상)
  /* 대상 = **공실이 아닌** 세대 전부. 중도퇴실은 퇴실 전까지 내야 하므로 포함한다.
     ⛔ 월 청구액이 0원인 세대를 **목록에서 빼지 않는다** — 「정말 안 받는 집」인지
        「금액 입력이 빠진 집」인지 화면만 봐선 구분이 안 되는데, 조용히 빼면
        **받을 돈을 못 받고 있는 걸 아무도 모른다**(중도퇴실 49세대를 뺐던 것과 같은 병). */
  const rows = useMemo(() => leases
    .filter((l) => !l.vacant)
    .map((l) => ({ l, b: bName(l.building_id), a: arrearsOf(l, bills[l.id], sums[l.id], today) }))
    .filter((r) => {
      if (only === "owed" && !(r.a.started && r.a.owed > 0)) return false;
      if (only === "check" && !r.a.checkNote) return false;
      if (only !== "check" && only !== "all" && r.a.checkNote && r.a.monthly <= 0) return false;
      if (only === "exempt" && !r.a.exempt) return false;
      if (only !== "exempt" && only !== "all" && r.a.exempt) return false;
      if (only === "notset" && !(r.a.monthly > 0) ) return false;
      if (only === "notset" && r.a.started) return false;
      if (only === "noamt" && (r.a.monthly > 0 || r.a.exempt)) return false;
      if (only !== "noamt" && only !== "all" && (r.a.monthly <= 0 || r.a.exempt)) return false;
      if (q.trim()) {
        const t = (r.b + " " + r.l.room_number + " " + (r.l.tenant_name || "")).replace(/\s/g, "");
        if (!t.includes(q.replace(/\s/g, ""))) return false;
      }
      return true;
    })
    .sort((x, y) => y.a.owed - x.a.owed), [leases, buildings, bills, sums, only, q]);

  const all = leases.filter((l) => !l.vacant);
  /* 「금액없음」은 **확인이 필요한 것**만 센다. 청구 면제(예: 전세인데 관리비 면제)는
     0원이 맞는 것이라 여기서 뺀다 — 안 그러면 진짜 입력 누락이 면제분에 묻힌다. */
  const billOf = (l) => monthBill(l) + Number((bills[l.id] && bills[l.id].extra_monthly) || 0);
  const noAmt = all.filter((l) => billOf(l) <= 0 && !(bills[l.id] && bills[l.id].exempt));
  const exemptCnt = all.filter((l) => bills[l.id] && bills[l.id].exempt).length;
  const checkCnt = all.filter((l) => bills[l.id] && bills[l.id].check_note).length;
  const notSet = all.filter((l) => !bills[l.id] && monthBill(l) > 0).length;
  const totalOwed = all.filter((l) => billOf(l) > 0 && !(bills[l.id] && bills[l.id].exempt)).reduce((s, l) => { const a = arrearsOf(l, bills[l.id], sums[l.id], today); return s + (a.started && a.owed > 0 ? a.owed : 0); }, 0);
  const owedCnt = all.filter((l) => billOf(l) > 0 && !(bills[l.id] && bills[l.id].exempt)).filter((l) => { const a = arrearsOf(l, bills[l.id], sums[l.id], today); return a.started && a.owed > 0; }).length;

  /** 정산을 아직 안 연 세대를 이번 달 1일부터 일괄 시작 */
  const startAll = async () => {
    const tgt = all.filter((l) => !bills[l.id] && monthBill(l) > 0);
    const from = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-01";
    if (!confirm(`아직 정산을 안 연 ${tgt.length}세대를 ${from}부터 시작할까요?\n\n그 이전 미납은 0원으로 두고, 세대별로 '기초 미납'에 직접 넣으시면 됩니다.`)) return;
    setBusy(true);
    const { error } = await sb.from("lease_billing").upsert(
      tgt.map((l) => ({ lease_id: l.id, settle_from: from, opening_balance: 0 })), { onConflict: "lease_id" });
    setBusy(false);
    if (error) alert("실패: " + error.message); else load();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="font-bold text-xl text-slate-800">💰 미납 관리</h2>
        <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-2 py-0.5 font-semibold">관리인 전용</span>
        <div className="flex-1" />
        <button className={btnGhost} onClick={onBack}>← 관리모드</button>
        <button className={btnGhost} onClick={() => setImp(true)}>💳 거래내역 넣기</button>
        <button className={btnPrimary} disabled={sel.size === 0}
          onClick={() => {
            const q = rows.filter((r) => sel.has(r.l.id));
            const hold = q.filter((r) => r.a.noDun);
            if (hold.length && !confirm(
              `독촉 보류로 표시된 ${hold.length}세대가 들어 있습니다.\n\n` +
              hold.map((r) => `· ${r.b} ${r.l.room_number} — ${r.a.noDunWhy || "사유 없음"}`).join("\n") +
              "\n\n그래도 보낼까요?")) return;
            setSmsQ(q);
          }}>
          💬 독촉 문자{sel.size > 0 ? ` (${sel.size}명)` : ""}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-500">총 미납액</p>
          <p className="text-xl font-extrabold text-red-600">{won(totalOwed)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-400">미납 세대</p>
          <p className="text-xl font-extrabold text-slate-700">{owedCnt}<span className="text-sm font-normal text-slate-400"> / {all.length - noAmt.length}</span></p>
          {noAmt.length > 0 && (
            <button className="text-xs text-amber-600 underline mt-0.5" onClick={() => setOnly("noamt")}>
              ⚠️ 금액 미입력 {noAmt.length}세대는 계산 못 함
            </button>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-400">정산 미개시</p>
          <p className="text-xl font-extrabold text-slate-700">{notSet}세대</p>
          {notSet > 0 && <button className="text-xs text-blue-600 underline mt-0.5" disabled={busy} onClick={startAll}>이번 달부터 일괄 시작</button>}
        </div>
      </div>

      <div className="flex gap-1.5 mb-2 flex-wrap items-center">
        {[["owed", "미납만"], ["all", "전체"], ["notset", "정산 미개시"], ["noamt", `금액없음 ${noAmt.length}`], ["check", `⚠️ 확인필요 ${checkCnt}`], ["exempt", `면제 ${exemptCnt}`]].map(([k, label]) => (
          <button key={k} onClick={() => setOnly(k)}
            className={"text-xs rounded-full px-3 py-1 font-semibold border " + (only === k ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300")}>{label}</button>
        ))}
        <input className={inputCls + " flex-1 min-w-[140px] max-w-xs"} value={q} onChange={(e) => setQ(e.target.value)} placeholder="건물·호수·세입자 검색" />
      </div>

      {loading ? <p className="text-sm text-slate-400 py-8 text-center">불러오는 중…</p> : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-slate-500 border-b">
              <th className="px-2 w-8">
                <input type="checkbox" title="연락처 있는 행 전체 선택"
                  checked={sel.size > 0 && sel.size === rows.filter((r) => r.l.tenant_phone && !r.a.noDun).length}
                  onChange={(e) => setSel(e.target.checked
                    ? new Set(rows.filter((r) => r.l.tenant_phone && !r.a.noDun).map((r) => r.l.id))
                    : new Set())} />
              </th>
              <th className="text-left py-2 px-2">매물</th><th className="text-left px-2">세입자</th>
              <th className="text-right px-2">월 청구</th><th className="text-right px-2">미납액</th>
              <th className="text-right px-2">밀린 달</th><th className="text-left px-2">최근 입금</th><th className="px-2"></th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan="8" className="text-center text-slate-400 py-8">해당하는 매물이 없습니다.</td></tr>}
              {rows.map(({ l, b, a }) => {
                const ph = (l.tenant_phone || "").replace(/[^0-9]/g, "");
                return (
                  <tr key={l.id} className="border-b hover:bg-slate-50">
                    <td className="px-2">
                      <input type="checkbox" disabled={!ph} checked={sel.has(l.id)}
                        onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(l.id) : n.delete(l.id); setSel(n); }} />
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{b} <b>{l.room_number}</b></td>
                    <td className="px-2 whitespace-nowrap">{l.tenant_name || <span className="text-slate-300">·</span>}
                      {a.leaving && <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 font-bold">퇴실예정</span>}
                      {a.noDun && <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 border border-slate-300 rounded-full px-1.5 py-0.5 font-bold" title={a.noDunWhy}>독촉 보류</span>}
                      {a.checkNote && <span className="ml-1 text-[10px] bg-rose-100 text-rose-700 border border-rose-300 rounded-full px-1.5 py-0.5 font-bold" title={a.checkNote}>⚠️ 확인필요</span>}</td>
                    <td className="px-2 text-right text-slate-500">
                      {a.exempt ? <span className="text-slate-400" title={a.exemptWhy}>면제</span>
                        : a.monthly > 0 ? (<span title={a.extra ? `월세·관리비 ${manwon(a.monthly - a.extra)} + 부가 ${manwon(a.extra)} · ${a.extraLabel}` : ""}>
                            {manwon(a.monthly)}{a.extra > 0 && <span className="text-violet-500 text-[10px] ml-0.5">＋</span>}</span>)
                        : <span className="text-amber-600 font-semibold" title="월세·관리비가 둘 다 0원입니다">금액없음</span>}</td>
                    <td className={"px-2 text-right font-bold " + (a.owed > 0 ? "text-red-600" : "text-slate-300")}>
                      {a.exempt ? <span className="text-slate-300 text-xs">청구 없음</span>
                        : a.monthly <= 0 ? <span className="text-amber-600 text-xs">계산 불가</span>
                        : a.started ? won(a.owed) : <span className="text-slate-300">미개시</span>}</td>
                    <td className="px-2 text-right">{a.owed > 0 && a.owedMonths > 0 ? <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-bold">{a.owedMonths}개월</span> : ""}</td>
                    <td className="px-2 text-slate-500 whitespace-nowrap">{a.lastPaid || <span className="text-slate-300">없음</span>}</td>
                    <td className="px-2 whitespace-nowrap text-right">
                      {ph && <a className="text-blue-600 mr-2" href={"tel:" + ph}>📞</a>}
                      {ph && <button className="text-blue-600 mr-2" title="독촉 문자"
                        onClick={() => setSmsQ([{ l, b, a }])}>💬</button>}
                      <button className="text-xs border border-slate-300 rounded px-2 py-0.5 hover:bg-slate-100" onClick={() => setPick(l)}>기록</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {imp && <PaymentImportModal leases={leases} buildings={buildings} onClose={() => setImp(false)}
        onSaved={(n) => { alert(n + "건 저장했습니다."); load(); }} />}
      {pick && <CollectionModal lease={pick} building={buildings.find((x) => x.id === pick.building_id)}
        bill={bills[pick.id]} me={me} onClose={() => setPick(null)} onSaved={load} />}
      {smsQ && smsQ.length > 0 && <SmsComposeModal queue={smsQ} settings={settings} accounts={accounts} me={me}
        onClose={() => setSmsQ(null)}
        onDone={(n) => { setSmsQ(null); setSel(new Set()); if (n > 0) alert(n + "건을 보낸 것으로 기록했습니다."); load(); }} />}
    </div>
  );
}
