/* 보담 — 임대 모달 (편집자/관리자)
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 임대 모달 (편집자/관리자) ---------------- */
function LeaseModal({ lease, buildings, customFields, me, asRecords, onReloadAS, onClose, onSaved, onUpload }) {
  const isNew = !lease.id;
  const [f, setF] = useState({
    building_id: lease.building_id || (buildings[0] && buildings[0].id) || "",
    room_number: lease.room_number || "",
    tenant_name: lease.tenant_name || "",
    phone: lease.tenant_phone || "",
    start_date: lease.start_date || "",
    end_date: lease.end_date || "",
    deposit: lease.deposit ?? "",
    rent: lease.monthly_rent ?? "",
    maintenance_fee: lease.management_fee ?? "",
    hope_deposit: lease.hope_deposit ?? "",
    hope_rent: lease.hope_rent ?? "",
    hope_fee: lease.hope_fee ?? "",
    insurance: lease.insurance === true ? "done" : lease.insurance_pending === true ? "progress" : "",
    door_code: lease.door_code || "",
    memo: lease.memo || "",
    extra: lease.custom_data || {},
    contract_done: !!lease.contract_done,
    contract_by: lease.contract_done_by || "",
    move_out: !!lease.move_out,
    vacant: !!lease.vacant,
    tags: Array.isArray(lease.tags) ? lease.tags : [],
    term_months: lease.term_months ?? null, // 원래 계약기간(개월) — 묵시적갱신이 이 값만큼 연장
  });
  const isAdminUser = me && me.role === "admin";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setExtra = (k, v) => setF((p) => ({ ...p, extra: { ...p.extra, [k]: v } }));
  // AS·도배 이력 (이 매물에 연결된 as_records) + 접수 폼
  const asRec = (asRecords || []).filter((r) => r.lease_id === lease.id);
  const asMaxSeq = (asRecords || []).reduce((m, r) => Math.max(m, Number(r.seq) || 0), 0);
  const [asOpen, setAsOpen] = useState(false);
  const [asF, setAsF] = useState({ work_detail: "", received_date: "", staff: "" });
  const [asBusy, setAsBusy] = useState(false);
  const submitAS = async () => {
    if (!asF.work_detail.trim() || asBusy) return;
    setAsBusy(true);
    const bname = (buildings.find((x) => x.id === f.building_id) || {}).name || null;
    const { error } = await sb.from("as_records").insert({
      seq: asMaxSeq + 1, building: bname, room_number: f.room_number.trim() || null,
      tenant_name: f.tenant_name.trim() || null, phone: f.phone.trim() || null, lease_id: lease.id,
      received_date: asF.received_date || null, work_detail: asF.work_detail.trim(), staff: asF.staff.trim() || null,
    });
    setAsBusy(false);
    if (error) { alert("AS 접수 실패: " + error.message); return; }
    setAsF({ work_detail: "", received_date: "", staff: "" }); setAsOpen(false);
    if (onReloadAS) onReloadAS();
  };

  const save = async () => {
    if (!f.building_id || !f.room_number.trim()) { setErr("건물과 호수는 필수입니다."); return; }
    setBusy(true); setErr("");
    const payload = {
      building_id: f.building_id,
      room_number: f.room_number.trim(),
      tenant_name: f.tenant_name.trim() || null,
      tenant_phone: f.phone.trim() || null,
      start_date: f.start_date || null,
      end_date: f.end_date || null,
      deposit: numOrNull(f.deposit),
      monthly_rent: numOrNull(f.rent),
      management_fee: numOrNull(f.maintenance_fee),
      hope_deposit: numOrNull(f.hope_deposit),
      hope_rent: numOrNull(f.hope_rent),
      hope_fee: numOrNull(f.hope_fee),
      insurance: f.insurance === "done",
      insurance_pending: f.insurance === "progress",
      door_code: f.door_code.trim() || null,
      memo: f.memo.trim() || null,
      custom_data: f.extra,
      move_out: f.move_out,
      vacant: f.vacant,
      tags: f.tags || [],
    };
    // 원래 계약기간(개월): 아직 묵시적갱신 안 된 계약이면 입주~만기로 자동 산정, 갱신된 계약이면 저장값 유지
    {
      const renewed = (f.tags || []).includes("묵시적갱신");
      payload.term_months = renewed ? (f.term_months ?? null) : (monthsBetween(f.start_date, f.end_date) || (f.term_months ?? null));
    }
    // 계약완료 처리: 새로 체크하면 완료자·일시 기록, 해제하면 초기화
    // 관리자는 완료자 이름을 직접 지정/수정 가능
    if (f.contract_done) {
      payload.contract_done = true;
      if (!lease.contract_done) {
        payload.contract_done_by = (isAdminUser && f.contract_by.trim())
          ? f.contract_by.trim()
          : ((me && (me.full_name || me.email)) || null);
        payload.contract_done_at = new Date().toISOString();
      } else if (isAdminUser && f.contract_by.trim() && f.contract_by.trim() !== (lease.contract_done_by || "")) {
        payload.contract_done_by = f.contract_by.trim();
      }
    } else if (lease.contract_done) {
      payload.contract_done = false;
      payload.contract_done_by = null;
      payload.contract_done_at = null;
    }
    const q = isNew ? sb.from("leases").insert(payload) : sb.from("leases").update(payload).eq("id", lease.id);
    const { error } = await q;
    setBusy(false);
    if (error) setErr("저장 실패: " + error.message); else { onSaved(); onClose(); }
  };
  const remove = async () => {
    if (!confirm("이 임대 정보를 삭제할까요?")) return;
    setBusy(true);
    const { error } = await sb.from("leases").delete().eq("id", lease.id);
    setBusy(false);
    if (error) setErr("삭제 실패: " + error.message); else { onSaved(); onClose(); }
  };

  return (
    <Modal title={isNew ? "임대 정보 추가" : "임대 정보 수정"} onClose={onClose} wide>
      <LeasePhotos leaseId={lease.id} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="건물 *">
          <select className={inputCls} value={f.building_id} onChange={(e) => set("building_id", e.target.value)}>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="호수 *"><input className={inputCls} value={f.room_number} onChange={(e) => set("room_number", e.target.value)} placeholder="101호" /></Field>
        <Field label="임차인명"><input className={inputCls} value={f.tenant_name} onChange={(e) => set("tenant_name", e.target.value)} /></Field>
        <Field label="연락처">
          <div className="flex gap-2">
            <input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
            {f.phone.trim() && <a href={telHref(f.phone)} className="shrink-0 flex items-center justify-center w-10 rounded-lg bg-blue-50 border border-blue-200 text-lg" title="전화 걸기">📞</a>}
          </div>
        </Field>
        <Field label="입주날짜"><input type="date" className={inputCls} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="만기일 (연장 시 아래 버튼)">
          <input type="date" className={inputCls} value={f.end_date} onChange={(e) => set("end_date", e.target.value)} />
          <div className="flex gap-1.5 mt-1.5">
            <button type="button" className="flex-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md py-1.5" onClick={() => set("end_date", addYears(f.end_date, 1))}>+1년</button>
            <button type="button" className="flex-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md py-1.5" onClick={() => set("end_date", addYears(f.end_date, 2))}>+2년</button>
          </div>
          {(() => {
            // 연장 기간(개월): 저장된 원래 계약기간 우선, 없으면 입주~만기로 산정
            const term = (f.term_months && f.term_months > 0) ? f.term_months : monthsBetween(f.start_date, f.end_date);
            const ne = (term > 0 && f.end_date) ? addMonths(f.end_date, term) : null;
            return (
              <React.Fragment>
                <button type="button" className="w-full mt-1.5 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md py-2"
                  onClick={() => {
                    const tm = (f.term_months && f.term_months > 0) ? f.term_months : monthsBetween(f.start_date, f.end_date);
                    if (!tm || tm <= 0 || !f.end_date) { alert("입주날짜와 만기일이 있어야 원래 계약기간만큼 연장할 수 있어요."); return; }
                    const oldEnd = f.end_date, newEnd = addMonths(oldEnd, tm);
                    set("end_date", newEnd);            // 입주일은 그대로, 만기만 원래 기간만큼 연장
                    set("term_months", tm);             // 원래 계약기간 고정 (다음 갱신도 이 값만큼)
                    set("tags", (f.tags || []).includes("묵시적갱신") ? f.tags : [...(f.tags || []), "묵시적갱신"]);
                    const note = "🔁 묵시적갱신(" + tm + "개월): 만기 " + oldEnd + " → " + newEnd;
                    set("memo", (f.memo ? f.memo + "\n" : "") + note);
                  }}>
                  🔁 묵시적갱신 — 원래 계약기간만큼 연장
                </button>
                {ne && (
                  <p className="text-[11px] text-amber-600 mt-1 break-keep">
                    입주일은 그대로 두고 만기만 <b>{f.end_date} → {ne}</b>로 <b>{term}개월</b> 연장됩니다. '묵시적갱신' 태그·이력 메모 추가. (저장해야 확정)
                  </p>
                )}
              </React.Fragment>
            );
          })()}
        </Field>
        <Field label={(f.vacant ? "희망 " : "") + "보증금 (만원)"}><input className={inputCls} value={f.deposit} onChange={(e) => set("deposit", e.target.value)} inputMode="numeric" /></Field>
        <Field label={(f.vacant ? "희망 " : "") + "월세 (만원)"}><input className={inputCls} value={f.rent} onChange={(e) => set("rent", e.target.value)} inputMode="numeric" /></Field>
        <Field label={(f.vacant ? "희망 " : "") + "관리비 (만원)"}><input className={inputCls} value={f.maintenance_fee} onChange={(e) => set("maintenance_fee", e.target.value)} inputMode="numeric" /></Field>
        <Field label="희망 보증금 (만원)"><input className={inputCls} value={f.hope_deposit} onChange={(e) => set("hope_deposit", e.target.value)} inputMode="numeric" placeholder="보담회원에게 공개될 매물가" /></Field>
        <Field label="희망 월세 (만원)"><input className={inputCls} value={f.hope_rent} onChange={(e) => set("hope_rent", e.target.value)} inputMode="numeric" /></Field>
        <Field label="희망 관리비 (만원)"><input className={inputCls} value={f.hope_fee} onChange={(e) => set("hope_fee", e.target.value)} inputMode="numeric" /></Field>
        <Field label="보증보험">
          <select className={inputCls} value={f.insurance} onChange={(e) => set("insurance", e.target.value)}>
            <option value="">- 미지정 -</option>
            <option value="progress">가입중</option>
            <option value="done">가입완료</option>
          </select>
        </Field>
        <Field label="호실 비밀번호"><input className={inputCls} value={f.door_code} onChange={(e) => set("door_code", e.target.value)} placeholder="예: 1234*" /></Field>
      </div>
      <label className="flex items-center gap-2.5 mb-3 bg-sky-50 border border-sky-200 rounded-xl px-3 py-3 cursor-pointer">
        <input type="checkbox" className="w-5 h-5 accent-sky-600" checked={f.vacant} onChange={(e) => set("vacant", e.target.checked)} />
        <span className="text-sm font-bold text-sky-700">🏠 공실</span>
        <span className="text-xs text-sky-500 ml-auto break-keep">{f.vacant ? "보증금·월세 = 희망 임대가로 입력" : "만기 무관, 모든 등급에게 표시"}</span>
      </label>
      <label className="flex items-center gap-2.5 mb-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 cursor-pointer">
        <input type="checkbox" className="w-5 h-5 accent-slate-600" checked={f.move_out} onChange={(e) => set("move_out", e.target.checked)} />
        <span className="text-sm font-bold text-slate-700">중도퇴실</span>
        <span className="text-xs text-slate-400 ml-auto break-keep">보담회원에게도 표시</span>
      </label>
      <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={f.contract_done} onChange={(e) => set("contract_done", e.target.checked)} />
          <span className="text-sm font-bold text-emerald-800">🎉 계약완료</span>
          {lease.contract_done && lease.contract_done_by && !isAdminUser && (
            <span className="text-xs text-emerald-600 ml-auto">{lease.contract_done_by} · {String(lease.contract_done_at || "").slice(0, 10)}</span>
          )}
          {!lease.contract_done && f.contract_done && !isAdminUser && (
            <span className="text-xs text-emerald-600 ml-auto">저장하면 축하 코너에 게시됩니다</span>
          )}
        </label>
        {f.contract_done && isAdminUser && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-xs font-medium text-emerald-700 shrink-0">완료자</span>
            <input className={inputCls + " !py-1.5 text-sm"} value={f.contract_by}
              onChange={(e) => set("contract_by", e.target.value)}
              placeholder={(me && (me.full_name || me.email)) || ""} />
            {lease.contract_done_at && <span className="text-xs text-emerald-600 shrink-0">{String(lease.contract_done_at).slice(0, 10)}</span>}
          </div>
        )}
      </div>
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-600 mb-1.5">매물 세부 옵션</p>
        <TagPicker options={LEASE_TAGS} selected={f.tags} tone="lease" allowCustom
          onToggle={(v) => set("tags", (f.tags || []).includes(v) ? f.tags.filter((x) => x !== v) : [...(f.tags || []), v])} />
      </div>
      <Field label="메모"><textarea className={inputCls} rows="3" value={f.memo} onChange={(e) => set("memo", e.target.value)} /></Field>
      {customFields.length > 0 && (
        <div className="border-t pt-3 mt-1">
          <p className="text-sm font-semibold text-slate-500 mb-2">추가 정보</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            {customFields.map((cf) => (
              <Field key={cf.id} label={cf.field_label}>
                <input className={inputCls} value={f.extra[cf.field_key] || ""} onChange={(e) => setExtra(cf.field_key, e.target.value)} />
              </Field>
            ))}
          </div>
        </div>
      )}
      {!isNew && onUpload && (
        <button className="w-full mb-3 bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg py-2.5"
          onClick={() => onUpload(lease)}>📄 계약서 사진 업로드 (자동 인식)</button>
      )}
      {!isNew && (
        <div className="mb-3 border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-sm font-bold text-slate-700">🔧 AS·도배 이력 <span className="text-slate-400 font-medium">{asRec.length}</span></h4>
            <button type="button" className="text-xs font-bold text-blue-600" onClick={() => setAsOpen((v) => !v)}>{asOpen ? "취소" : "＋ AS 접수"}</button>
          </div>
          {asOpen && (
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-2.5 mb-2 space-y-2">
              <textarea className={inputCls} rows={2} placeholder="작업내용 (예: 화장실 문손잡이 교체)" value={asF.work_detail} onChange={(e) => setAsF((s) => ({ ...s, work_detail: e.target.value }))} />
              <div className="flex gap-2">
                <input type="date" className={inputCls} value={asF.received_date} onChange={(e) => setAsF((s) => ({ ...s, received_date: e.target.value }))} />
                <input className={inputCls} placeholder="담당 (선택)" value={asF.staff} onChange={(e) => setAsF((s) => ({ ...s, staff: e.target.value }))} />
              </div>
              <button type="button" className={btnPrimary + " w-full"} disabled={asBusy || !asF.work_detail.trim()} onClick={submitAS}>{asBusy ? "저장 중..." : "접수 등록"}</button>
            </div>
          )}
          {asRec.length === 0 && !asOpen && <p className="text-xs text-slate-400">등록된 AS·도배 이력이 없습니다.</p>}
          <div className="space-y-1.5">
            {asRec.map((r) => (
              <div key={r.id} className="bg-white border rounded-lg p-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={"text-[10px] font-bold rounded-full px-2 py-0.5 border shrink-0 " + (AS_DONE(r) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{AS_DONE(r) ? "완료" : "미완료"}</span>
                  <span className="text-sm text-slate-700 font-medium break-keep flex-1">{r.work_detail || "-"}</span>
                  <span className="text-xs text-slate-400 shrink-0">{r.received_date || "-"}{r.handled_date ? " → " + r.handled_date : ""}</span>
                </div>
                {(r.staff || (r.cost && r.cost !== "-")) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {r.staff && <span className="mr-2">담당 {r.staff}</span>}
                    {r.cost && r.cost !== "-" && <span>비용 {isNaN(Number(r.cost)) ? r.cost : Number(r.cost).toLocaleString() + "원"}</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      <div className="flex gap-2 pt-2 pb-2">
        <button className={btnPrimary + " flex-1 py-3"} onClick={save} disabled={busy}>{busy ? "저장 중..." : "저장"}</button>
        {!isNew && <button className={btnDanger} onClick={remove} disabled={busy}>삭제</button>}
        <button className={btnGhost} onClick={onClose}>취소</button>
      </div>
    </Modal>
  );
}
