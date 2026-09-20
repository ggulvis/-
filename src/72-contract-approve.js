/* 보담 — 계약서 승인 (편집자 이상)
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 계약서 승인 (편집자 이상) ---------------- */
function SubmissionReviewModal({ submissions, leases, buildings, me, onClose, onSaved }) {
  const pend = submissions.filter((s) => s.status === "pending");
  const [sel, setSel] = useState(null); // 선택된 submission
  const [imgUrl, setImgUrl] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const bName = (id) => (buildings.find((x) => x.id === id) || {}).name || "";
  const leaseOf = (s) => leases.find((l) => l.id === s.lease_id);

  const open = async (s) => {
    setSel(s); setErr(""); setImgUrl(null);
    const ex = s.extracted || {};
    setF({
      tenant_name: ex.tenant_name || "", tenant_phone: ex.tenant_phone || "",
      start_date: ex.start_date || "", end_date: ex.end_date || "",
      deposit: ex.deposit ?? "", rent: ex.rent ?? "", management_fee: ex.management_fee ?? "",
    });
    const { data } = await sb.storage.from("contracts").createSignedUrl(s.file_path, 3600);
    if (data) setImgUrl(data.signedUrl);
  };
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const approve = async () => {
    const l = leaseOf(sel);
    if (!l) { setErr("연결된 매물을 찾을 수 없습니다."); return; }
    setBusy(true); setErr("");
    try {
      const payload = {};
      if (f.tenant_name.trim()) payload.tenant_name = f.tenant_name.trim();
      if (f.tenant_phone.trim()) payload.tenant_phone = f.tenant_phone.trim();
      if (f.start_date) payload.start_date = f.start_date;
      if (f.end_date) payload.end_date = f.end_date;
      if (f.deposit !== "") payload.deposit = numOrNull(f.deposit);
      if (f.rent !== "") payload.monthly_rent = numOrNull(f.rent);
      if (f.management_fee !== "") payload.management_fee = numOrNull(f.management_fee);
      if (Object.keys(payload).length) {
        const { error } = await sb.from("leases").update(payload).eq("id", l.id);
        if (error) throw error;
      }
      const { error: e2 } = await sb.from("contract_submissions").update({
        status: "approved", reviewed_by: me.full_name || me.email, reviewed_at: new Date().toISOString(),
      }).eq("id", sel.id);
      if (e2) throw e2;
      setSel(null); onSaved();
    } catch (e3) { setErr("승인 실패: " + e3.message); }
    finally { setBusy(false); }
  };
  const reject = async () => {
    if (!confirm("이 계약서 제출을 거절할까요? 매물 정보는 변경되지 않습니다.")) return;
    setBusy(true);
    await sb.from("contract_submissions").update({
      status: "rejected", reviewed_by: me.full_name || me.email, reviewed_at: new Date().toISOString(),
    }).eq("id", sel.id);
    setBusy(false); setSel(null); onSaved();
  };

  return (
    <Modal title="📄 계약서 승인" onClose={onClose} wide>
      {!sel ? (
        <div className="space-y-2 pb-2">
          {pend.length === 0 && <p className="text-sm text-slate-400 text-center py-8">승인 대기 중인 계약서가 없습니다.</p>}
          {pend.map((s) => {
            const l = leaseOf(s);
            return (
              <button key={s.id} onClick={() => open(s)}
                className="w-full text-left border rounded-xl px-3 py-3 bg-white hover:bg-blue-50 flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <b className="text-slate-800">{l ? `${bName(l.building_id)} ${l.room_number}` : "(매물 삭제됨)"}</b>
                  <span className="text-sm text-slate-500 ml-2">{s.submitted_by} 제출</span>
                  {s.note && <span className="block text-xs text-slate-400 truncate">메모: {s.note}</span>}
                </span>
                <span className="text-xs text-slate-400 shrink-0">{String(s.created_at).slice(0, 10)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pb-2">
          <button className="text-sm text-slate-400 mb-2" onClick={() => setSel(null)}>← 목록으로</button>
          <p className="font-bold text-slate-800 mb-2">{(() => { const l = leaseOf(sel); return l ? `${bName(l.building_id)} ${l.room_number}` : ""; })()} <span className="font-medium text-sm text-slate-500">— {sel.submitted_by} 제출</span></p>
          {imgUrl ? <img src={imgUrl} className="w-full rounded-xl border mb-3 max-h-96 object-contain bg-slate-50" /> : <p className="text-sm text-slate-400 mb-3">사진 불러오는 중...</p>}
          <p className="text-xs text-amber-600 font-semibold mb-2">⚠️ 자동 인식 값입니다. 사진과 대조해 수정한 뒤 승인하세요. 빈 칸은 기존 값을 유지합니다.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="임차인명"><input className={inputCls} value={f.tenant_name} onChange={(e) => set("tenant_name", e.target.value)} /></Field>
            <Field label="연락처"><input className={inputCls} value={f.tenant_phone} onChange={(e) => set("tenant_phone", e.target.value)} inputMode="tel" /></Field>
            <Field label="입주날짜"><input type="date" className={inputCls} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
            <Field label="만기일"><input type="date" className={inputCls} value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
            <Field label="보증금 (만원)"><input className={inputCls} value={f.deposit} onChange={(e) => set("deposit", e.target.value)} inputMode="numeric" /></Field>
            <Field label="월세 (만원)"><input className={inputCls} value={f.rent} onChange={(e) => set("rent", e.target.value)} inputMode="numeric" /></Field>
            <Field label="관리비 (만원)"><input className={inputCls} value={f.management_fee} onChange={(e) => set("management_fee", e.target.value)} inputMode="numeric" /></Field>
          </div>
          {sel.note && <p className="text-sm text-slate-500 mb-2">제출자 메모: {sel.note}</p>}
          {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button className={btnPrimary + " flex-1 py-3"} onClick={approve} disabled={busy}>{busy ? "처리 중..." : "✅ 승인 (매물에 반영)"}</button>
            <button className={btnDanger} onClick={reject} disabled={busy}>거절</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
