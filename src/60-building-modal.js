/* 보담 — 건물 추가/수정 모달
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 건물 추가/수정 모달 ---------------- */
function BuildingModal({ building, onClose, onSaved }) {
  const isNew = !building.id;
  const [name, setName] = useState(building.name || "");
  const [address, setAddress] = useState(building.address || "");
  const [entrance, setEntrance] = useState(building.entrance_code || "");
  const [managerPhone, setManagerPhone] = useState(building.manager_phone || "");
  const [bMemo, setBMemo] = useState(building.memo || "");
  const [options, setOptions] = useState(Array.isArray(building.options) ? building.options : []);
  const [active, setActive] = useState(building.active !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggleOpt = (v) => setOptions((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  const save = async () => {
    if (!name.trim()) { setErr("건물명을 입력하세요."); return; }
    setBusy(true); setErr("");
    const payload = { name: name.trim(), address: address.trim() || null, entrance_code: entrance.trim() || null, manager_phone: managerPhone.trim() || null, memo: bMemo.trim() || null, options, active };
    const q = isNew ? sb.from("buildings").insert(payload) : sb.from("buildings").update(payload).eq("id", building.id);
    const { error } = await q;
    setBusy(false);
    if (error) setErr("저장 실패: " + error.message); else { onSaved(); onClose(); }
  };
  const remove = async () => {
    if (!confirm("건물을 삭제하면 소속된 모든 임대 정보도 함께 삭제됩니다. 계속할까요?")) return;
    setBusy(true);
    const { error } = await sb.from("buildings").delete().eq("id", building.id);
    setBusy(false);
    if (error) setErr("삭제 실패: " + error.message); else { onSaved(); onClose(); }
  };
  return (
    <Modal title={isNew ? "건물 추가" : "건물 수정"} onClose={onClose}>
      <Field label="건물명"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 보담빌딩" /></Field>
      <Field label="주소"><input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="예: 서울 마포구 ..." /></Field>
      <Field label="공동현관 비밀번호"><input className={inputCls} value={entrance} onChange={(e) => setEntrance(e.target.value)} placeholder="예: #1234" /></Field>
      <Field label="관리인 연락처 (건물 담당자 전화번호)"><input className={inputCls} value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} inputMode="tel" placeholder="예: 010-1234-5678" /></Field>
      <Field label="건물 메모 (주차·계약규칙·입금계좌 등)"><textarea className={inputCls + " min-h-[70px]"} value={bMemo} onChange={(e) => setBMemo(e.target.value)} placeholder="예: 주차 1대 가능 · 보증금은 신협 계좌로 입금" /></Field>
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-600 mb-1.5">건물 태그 <span className="text-xs font-normal text-slate-400">(홈에서 이 태그로 필터할 수 있어요 · 직접 추가 가능)</span></p>
        <TagPicker options={BUILDING_OPTS} selected={options} onToggle={toggleOpt} tone="building" allowCustom />
      </div>
      <label className={"flex items-start gap-2.5 border rounded-xl p-3 mb-3 cursor-pointer " + (active ? "bg-white" : "bg-red-50 border-red-300")}>
        <input type="checkbox" className="w-5 h-5 accent-blue-600 mt-0.5 shrink-0" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span className="text-sm">
          <b className={active ? "text-slate-800" : "text-red-700"}>{active ? "관리 중인 건물" : "관리 중단됨"}</b>
          <span className="block text-xs text-slate-500 mt-0.5">체크를 해제하면 관리계약 해지(관리 중단) 상태가 되어, 보담회원·편집자에게는 이 건물과 소속 매물이 보이지 않습니다. 관리인·관리자는 계속 볼 수 있습니다.</span>
        </span>
      </label>
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      <div className="flex gap-2 pb-2">
        <button className={btnPrimary + " flex-1"} onClick={save} disabled={busy}>저장</button>
        {!isNew && <button className={btnDanger} onClick={remove} disabled={busy}>삭제</button>}
        <button className={btnGhost} onClick={onClose}>취소</button>
      </div>
    </Modal>
  );
}
