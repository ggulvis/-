/* 보담 — 프로필 모달
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 프로필 모달 ---------------- */
function ProfileModal({ profile, leases, buildings, onClose, onSaved, onCancelDone }) {
  const [tab, setTab] = useState("contracts"); // 기본 탭: 내가 한 계약 (profile | contracts)
  const initAff = splitAffiliation(profile.affiliation);
  const [affName, setAffName] = useState(initAff.name);
  const [affType, setAffType] = useState(initAff.type);
  const [name, setName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(null);
  const bName = (id) => (buildings || []).find((b) => b.id === id)?.name || "-";
  const myName = profile.full_name || profile.email;
  const cutoff = Date.now() - 92 * 86400000; // 최근 약 3개월
  const myContracts = (leases || [])
    .filter((l) => l.contract_done && l.contract_done_by === myName && l.contract_done_at && new Date(l.contract_done_at).getTime() >= cutoff)
    .sort((a, b) => String(b.contract_done_at).localeCompare(String(a.contract_done_at)));
  const save = async () => {
    if (!name.trim() || !phone.trim()) { setErr("이름과 연락처를 입력하세요."); return; }
    setBusy(true); setErr("");
    const { error } = await sb.from("user_roles").update({ affiliation: joinAffiliation(affName, affType) || null, full_name: name.trim(), phone: phone.trim() }).eq("id", profile.id);
    setBusy(false);
    if (error) setErr("저장 실패: " + error.message); else { onSaved(); onClose(); }
  };
  const withdraw = async () => {
    if (!confirm("정말 탈퇴하시겠어요?\n\n내 계정 정보와 권한이 삭제되고 로그아웃됩니다.\n다시 이용하려면 재가입 후 관리자 승인이 필요합니다.\n(구글 계정 자체에는 영향이 없습니다.)")) return;
    setBusy(true); setErr("");
    const { error } = await sb.from("user_roles").delete().eq("id", profile.id);
    if (error) { setBusy(false); setErr("탈퇴 실패: " + error.message); return; }
    await sb.auth.signOut();
    window.location.reload();
  };
  const tabBtn = (id, label, badge) => (
    <button onClick={() => setTab(id)}
      className={"px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap " + (tab === id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
      {label}{badge > 0 && <span className={"ml-1.5 text-xs " + (tab === id ? "text-blue-100" : "text-slate-400")}>{badge}</span>}
    </button>
  );
  return (
    <Modal title="내 프로필" onClose={onClose} wide>
      <div className="flex gap-2 mb-4">
        {tabBtn("contracts", "내가 한 계약", myContracts.length)}
        {tabBtn("profile", "프로필")}
      </div>

      {tab === "contracts" && (
        <div className="pb-2">
          <p className="text-xs text-slate-400 mb-2">최근 3개월 이내에 내가 계약완료한 매물입니다. 계약이 파기되면 아래에서 바로 처리할 수 있습니다.</p>
          {myContracts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">최근 3개월 내 계약완료 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {myContracts.map((l) => {
                const b = (buildings || []).find((x) => x.id === l.building_id) || {};
                const open = openId === l.id;
                return (
                  <div key={l.id} className="border rounded-xl bg-white overflow-hidden">
                    <button className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 active:bg-slate-50"
                      onClick={() => setOpenId(open ? null : l.id)}>
                      <span className="min-w-0">
                        <b className="text-slate-800">{bName(l.building_id)} {fmtRoom(l.room_number)}</b>
                        {l.tenant_name && <span className="text-slate-500 text-sm ml-1.5">{l.tenant_name}</span>}
                      </span>
                      <span className="text-xs text-emerald-600 font-semibold shrink-0">🎉 {String(l.contract_done_at).slice(0, 10)}</span>
                    </button>
                    {open && (
                      <div className="px-3.5 pb-3 border-t bg-slate-50/60">
                        <div className="text-sm text-slate-600 space-y-0.5 py-2">
                          {b.address && <p><span className="text-slate-400">주소</span> {b.address}</p>}
                          <p><span className="text-slate-400">입주~만기</span> {fmtDate(l.start_date)} ~ {fmtDate(l.end_date)}</p>
                          {l.deposit != null && <p><span className="text-slate-400">보증금</span> {fmtKRW(l.deposit)} {l.monthly_rent != null && <span className="ml-2"><span className="text-slate-400">월세</span> {fmtKRW(l.monthly_rent)}</span>}</p>}
                          {l.tenant_phone && <p><span className="text-slate-400">연락처</span> <a className="text-blue-600 font-medium" href={telHref(l.tenant_phone)}>📞 세 {l.tenant_phone}</a></p>}
                        </div>
                        <button className="w-full bg-red-50 border border-red-300 text-red-600 font-bold rounded-lg py-2.5 active:bg-red-100"
                          onClick={() => onCancelDone(l)}>계약 파기 (계약완료 취소)</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className={tab === "profile" ? "" : "hidden"}>
      <div className="mb-4 text-sm text-slate-500">
        <p>{profile.email}</p>
        <p className="mt-1">권한: <RoleBadge role={profile.role} /></p>
      </div>
      <Field label="소속 (상호명 + 유형)"><AffiliationFields name={affName} type={affType} onName={setAffName} onType={setAffType} /></Field>
      <Field label={"이름 (예: 홍길동)"}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" /></Field>
      <Field label="연락처"><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      <div className="flex gap-2 pb-2">
        <button className={btnPrimary + " flex-1"} onClick={save} disabled={busy}>저장</button>
        <button className={btnGhost} onClick={onClose}>취소</button>
      </div>
      <div className="mt-6 pt-4 border-t">
        <button className="w-full text-sm text-red-500 hover:text-red-700 font-semibold py-2.5 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50" onClick={withdraw} disabled={busy}>탈퇴 (계정 삭제)</button>
        <p className="text-xs text-slate-400 text-center mt-1.5 break-keep">탈퇴하면 내 계정 정보·권한이 삭제되고 로그아웃됩니다. 다시 이용하려면 재가입 후 관리자 승인이 필요합니다.</p>
      </div>
      </div>
    </Modal>
  );
}
