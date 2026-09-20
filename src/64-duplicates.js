/* 보담 — 중복 관리
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 중복 관리 ---------------- */
function DupRow({ l, bName, onDelete, busy }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 text-sm">
      <div className="min-w-0">
        <span className="font-semibold text-slate-800">{bName(l.building_id)} {l.room_number}</span>
        {l.tenant_name && <span className="ml-1.5 text-slate-600">{l.tenant_name}</span>}
        <div className="text-xs text-slate-500 flex flex-wrap gap-x-2">
          <span>{fmtDate(l.start_date)} ~ {fmtDate(l.end_date)}</span>
          <span>보증금 {fmtKRW(l.deposit)} · 월세 {fmtKRW(l.monthly_rent)}</span>
          {l.created_at && <span className="text-slate-400">등록 {String(l.created_at).slice(0, 10)}</span>}
        </div>
      </div>
      <button className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0" disabled={busy} onClick={() => onDelete(l)}>삭제</button>
    </div>
  );
}
function DuplicateModal({ leases, buildings, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const bName = (id) => (buildings.find((b) => b.id === id) || {}).name || "-";
  const { exactGroups, suspectGroups } = useMemo(() => findDupGroups(leases), [leases]);

  const del = async (l) => {
    if (!confirm(`${bName(l.building_id)} ${l.room_number} (${l.tenant_name || "임차인 미상"}) 항목을 삭제할까요?`)) return;
    setBusy(true);
    const { error } = await sb.from("leases").delete().eq("id", l.id);
    setBusy(false);
    if (error) setMsg("삭제 실패: " + error.message); else onSaved();
  };
  const autoClean = async () => {
    const extras = exactGroups.flatMap((g) =>
      [...g].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).slice(1)
    );
    if (extras.length === 0) return;
    if (!confirm(`완전 중복 ${extras.length}건을 삭제합니다 (각 그룹에서 가장 먼저 등록된 1건만 유지). 계속할까요?`)) return;
    setBusy(true);
    const { error } = await sb.from("leases").delete().in("id", extras.map((l) => l.id));
    setBusy(false);
    if (error) setMsg("정리 실패: " + error.message);
    else { setMsg(`완전 중복 ${extras.length}건을 정리했습니다.`); onSaved(); }
  };

  return (
    <Modal title="중복 데이터 관리" onClose={onClose} wide>
      <p className="text-sm text-slate-500 mb-4 leading-relaxed break-keep">
        같은 호수라도 보증금·월세 금액이 다르면(전세/월세 병행 등) 중복으로 판단하지 않습니다.
        삭제 전 등록일을 확인하세요 — 보통 가장 먼저 등록된 것이 원본입니다.
      </p>
      {msg && <p className="text-sm mb-3 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">{msg}</p>}

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-slate-800">완전 중복 <span className="text-red-600">{exactGroups.length}그룹</span></h4>
          {exactGroups.length > 0 && <button className={btnDanger + " !py-1.5"} disabled={busy} onClick={autoClean}>자동 정리 (원본만 유지)</button>}
        </div>
        <p className="text-xs text-slate-400 mb-2">건물·호수·임차인·입주일·만기일이 전부 동일 — 엑셀 재업로드 등으로 생긴 사본입니다.</p>
        {exactGroups.length === 0 && <p className="text-sm text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5">완전 중복 없음 ✓</p>}
        {exactGroups.map((g, i) => (
          <div key={i} className="border border-red-200 bg-red-50/40 rounded-xl px-3 py-1.5 mb-2">
            {g.map((l) => <DupRow key={l.id} l={l} bName={bName} onDelete={del} busy={busy} />)}
          </div>
        ))}
      </div>

      <div className="pb-2">
        <h4 className="font-bold text-slate-800 mb-2">중복 의심 <span className="text-amber-600">{suspectGroups.length}그룹</span></h4>
        <p className="text-xs text-slate-400 mb-2">건물·호수·보증금·월세는 같지만 임차인이나 날짜가 다름 — 갱신 계약일 수도 있으니 직접 확인 후 삭제하세요.</p>
        {suspectGroups.length === 0 && <p className="text-sm text-slate-400 bg-slate-50 rounded-lg px-3 py-2.5">의심 항목 없음 ✓</p>}
        {suspectGroups.map((g, i) => (
          <div key={i} className="border border-amber-200 bg-amber-50/40 rounded-xl px-3 py-1.5 mb-2">
            {g.map((l) => <DupRow key={l.id} l={l} bName={bName} onDelete={del} busy={busy} />)}
          </div>
        ))}
      </div>
    </Modal>
  );
}
