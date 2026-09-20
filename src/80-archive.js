/* 보담 — 자료실 (관리인 전용)
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 자료실 (관리인 전용) ---------------- */
const ARCHIVE_SPECS = {
  nt: {
    tableName: "notices", title: "공지",
    fields: [
      { k: "title", label: "제목", req: true, full: true },
      { k: "body", label: "내용", type: "textarea", full: true },
      { k: "phone", label: "연락처" },
      { k: "pinned", label: "맨 위 고정", type: "bool" },
    ],
  },
  bi: {
    tableName: "building_info", title: "건물정보",
    fields: [
      { k: "name", label: "건물명", req: true },
      { k: "address", label: "주소", full: true },
      { k: "owner_name", label: "건물주" },
      { k: "owner_phone", label: "전화" },
      { k: "owner_account", label: "계좌", full: true },
      { k: "telecom", label: "통신사" },
      { k: "telecom_contact", label: "통신담당" },
      { k: "mgmt_fee", label: "관리비" },
      { k: "key_id", label: "KEY" },
      { k: "manager_id", label: "관리자" },
      { k: "email", label: "이메일" },
      { k: "note", label: "기타", type: "textarea", full: true },
      { k: "managed", label: "관리 중인 건물", type: "bool" },
    ],
  },
  ti: {
    tableName: "tenant_inquiries", title: "문의이력",
    fields: [
      { k: "building", label: "건물", req: true },
      { k: "room_number", label: "호수" },
      { k: "tenant_name", label: "세입자" },
      { k: "phone", label: "연락처" },
      { k: "inquiry_type", label: "문의유형" },
      { k: "staff", label: "담당" },
      { k: "inquiry_date", label: "문의일" },
      { k: "handled_date", label: "처리일" },
      { k: "inquiry_detail", label: "문의내용", type: "textarea", full: true },
      { k: "as_detail", label: "AS 내용", full: true },
      { k: "as_cost", label: "단가" },
      { k: "note", label: "비고", full: true },
    ],
  },
  as: {
    tableName: "as_records", title: "AS·도배",
    fields: [
      { k: "building", label: "건물", req: true },
      { k: "room_number", label: "호수" },
      { k: "tenant_name", label: "세입자" },
      { k: "phone", label: "연락처" },
      { k: "received_date", label: "접수일" },
      { k: "handled_date", label: "처리일" },
      { k: "staff", label: "담당" },
      { k: "cost", label: "비용" },
      { k: "paid", label: "수령" },
      { k: "confirm_time", label: "확인시간" },
      { k: "work_detail", label: "작업내용", type: "textarea", full: true },
      { k: "note", label: "비고", full: true },
    ],
  },
};

// AS·도배 완료 판별: 처리일(handled_date)에 실제 날짜/내용이 있으면 완료. '-'·'미정'·'예정' 등은 미완료로 간주.
const AS_DONE = (r) => {
  const h = String(r && r.handled_date != null ? r.handled_date : "").trim();
  return h !== "" && h !== "-" && h !== "미정" && h !== "예정";
};

function ArchiveEditModal({ table, row, maxSeq, onClose, onSaved }) {
  const spec = ARCHIVE_SPECS[table];
  const isNew = !row.id;
  const [f, setF] = useState(() => {
    const o = {};
    spec.fields.forEach((fd) => { o[fd.k] = fd.type === "bool" ? row[fd.k] !== false : (row[fd.k] ?? ""); });
    return o;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => { const v = e.target.type === "checkbox" ? e.target.checked : e.target.value; setF((p) => ({ ...p, [k]: v })); };

  const save = async () => {
    const missing = spec.fields.find((fd) => fd.req && !String(f[fd.k] ?? "").trim());
    if (missing) { setErr(missing.label + " 항목을 입력하세요."); return; }
    setBusy(true); setErr("");
    const payload = {};
    spec.fields.forEach((fd) => {
      if (fd.type === "bool") payload[fd.k] = !!f[fd.k];
      else { const v = String(f[fd.k] ?? "").trim(); payload[fd.k] = v === "" ? null : v; }
    });
    let error;
    if (isNew) { payload.seq = (maxSeq || 0) + 1; ({ error } = await sb.from(spec.tableName).insert(payload)); }
    else ({ error } = await sb.from(spec.tableName).update(payload).eq("id", row.id));
    setBusy(false);
    if (error) { setErr("저장 실패: " + error.message); return; }
    onSaved();
  };

  const remove = async () => {
    if (!confirm("이 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setBusy(true); setErr("");
    const { error } = await sb.from(spec.tableName).delete().eq("id", row.id);
    setBusy(false);
    if (error) { setErr("삭제 실패: " + error.message); return; }
    onSaved();
  };

  return (
    <Modal title={spec.title + (isNew ? " 추가" : " 수정")} onClose={onClose}>
      <div className="grid grid-cols-2 gap-x-3">
        {spec.fields.map((fd) => fd.type === "bool" ? (
          <label key={fd.k} className="flex items-center gap-2 mb-3 col-span-2 text-sm font-medium text-slate-600 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={!!f[fd.k]} onChange={set(fd.k)} /> {fd.label}
          </label>
        ) : (
          <div key={fd.k} className={fd.full ? "col-span-2" : ""}>
            <Field label={fd.label + (fd.req ? " *" : "")}>
              {fd.type === "textarea"
                ? <textarea className={inputCls + " min-h-[90px]"} value={f[fd.k]} onChange={set(fd.k)} />
                : <input className={inputCls} value={f[fd.k]} onChange={set(fd.k)} />}
            </Field>
          </div>
        ))}
      </div>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      <div className="flex gap-2 pt-1 pb-2">
        <button className={btnPrimary + " flex-1 py-3"} onClick={save} disabled={busy}>{busy ? "저장 중..." : "저장"}</button>
        {!isNew && <button className={btnDanger} onClick={remove} disabled={busy}>삭제</button>}
        <button className={btnGhost} onClick={onClose}>취소</button>
      </div>
    </Modal>
  );
}

function ArchiveView({ onBack }) {
  const [tab, setTab] = useState("nt"); // nt=공지 | bi=건물정보 | ti=문의이력 | as=AS도배
  const [nt, setNt] = useState(null);
  const [bi, setBi] = useState(null);
  const [ti, setTi] = useState(null);
  const [asr, setAsr] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null); // { table, row }
  const [asStatus, setAsStatus] = useState("all"); // AS·도배 상태 필터: all | open | done

  const load = async () => {
    const [b, t, a, n] = await Promise.all([
      sb.from("building_info").select("*").order("seq"),
      sb.from("tenant_inquiries").select("*").order("seq", { ascending: false }),
      sb.from("as_records").select("*").order("seq", { ascending: false }),
      // 고정 공지가 먼저, 그다음 최신순
      sb.from("notices").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    const e = b.error || t.error || a.error || n.error;
    setErr(e ? e.message : "");
    setBi(b.data || []); setTi(t.data || []); setAsr(a.data || []); setNt(n.data || []);
  };
  useEffect(() => { load(); }, []);

  const s = q.trim().toLowerCase();
  const hit = (...vals) => !s || vals.some((v) => String(v || "").toLowerCase().includes(s));

  const tabBtn = (id, label, cnt) => (
    <button onClick={() => setTab(id)}
      className={"px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap " + (tab === id ? "bg-blue-600 text-white" : "bg-white border text-slate-600 hover:bg-slate-50")}>
      {label}{cnt !== null && <span className={"ml-1.5 text-xs " + (tab === id ? "text-blue-200" : "text-slate-400")}>{cnt}</span>}
    </button>
  );

  const loading = bi === null || ti === null || asr === null || nt === null;
  const ntF = (nt || []).filter((r) => hit(r.title, r.body, r.phone));
  const biF = (bi || []).filter((r) => hit(r.name, r.address, r.owner_name, r.owner_phone, r.telecom, r.email, r.note));
  const tiF = (ti || []).filter((r) => hit(r.building, r.tenant_name, r.room_number, r.phone, r.inquiry_type, r.inquiry_detail, r.as_detail, r.staff, r.note));
  const asF = (asr || []).filter((r) => hit(r.building, r.tenant_name, r.room_number, r.phone, r.work_detail, r.staff, r.note));
  const asDoneCnt = asF.filter(AS_DONE).length;
  const asOpenCnt = asF.length - asDoneCnt;
  const asFS = asStatus === "done" ? asF.filter(AS_DONE) : asStatus === "open" ? asF.filter((r) => !AS_DONE(r)) : asF;

  const InfoRow = ({ label, value, tel }) => {
    if (!value) return null;
    return (
      <p className="text-sm text-slate-600 break-keep">
        <span className="text-slate-400 mr-1.5">{label}</span>
        {tel ? <a className="text-blue-600 font-medium" href={telHref(value)}>{value}</a> : <span className="font-medium">{value}</span>}
      </p>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button className="text-slate-400 hover:text-slate-700 text-xl px-1" onClick={onBack}>←</button>
        <h2 className="font-bold text-xl text-slate-800">📚 자료실</h2>
        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-semibold">관리인 전용</span>
        <div className="flex-1" />
        <input className={inputCls + " sm:max-w-xs"} placeholder="건물 · 이름 · 내용 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-thin pb-1 items-center">
        {tabBtn("nt", "📢 공지", nt === null ? null : ntF.length)}
        {tabBtn("bi", "🏢 건물정보", bi === null ? null : biF.length)}
        {tabBtn("ti", "💬 문의이력", ti === null ? null : tiF.length)}
        {tabBtn("as", "🔧 AS·도배", asr === null ? null : asF.length)}
        <div className="flex-1" />
        {!loading && (
          <button className={btnPrimary + " whitespace-nowrap shrink-0"} onClick={() => setEdit({ table: tab, row: {} })}>
            ＋ {ARCHIVE_SPECS[tab].title} 추가
          </button>
        )}
      </div>
      {err && <p className="text-sm text-red-600 mb-3">불러오기 실패: {err}</p>}
      {loading && !err && <p className="text-sm text-slate-400 text-center py-10">불러오는 중...</p>}

      {!loading && tab === "nt" && (
        <div className="space-y-3">
          {ntF.length === 0 && <p className="text-sm text-slate-400 text-center py-8">공지가 없습니다.</p>}
          {ntF.map((r) => (
            <div key={r.id} className={"bg-white rounded-2xl border shadow-sm p-4 " + (r.pinned ? "border-amber-300 bg-amber-50/40" : "")}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-bold text-slate-800 break-keep leading-snug">
                  {r.pinned && <span className="text-amber-500 mr-1">📌</span>}{r.title}
                </h3>
                <button className="text-xs font-bold text-blue-600 shrink-0" onClick={() => setEdit({ table: "nt", row: r })}>수정</button>
              </div>
              {r.body && <p className="text-sm text-slate-600 break-keep whitespace-pre-wrap">{r.body}</p>}
              {r.phone && <p className="text-sm mt-1.5"><span className="text-slate-400 mr-1.5">연락처</span>
                <a className="text-blue-600 font-medium" href={telHref(r.phone)}>{r.phone}</a></p>}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "bi" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {biF.length === 0 && <p className="text-sm text-slate-400 col-span-full text-center py-8">결과가 없습니다.</p>}
          {biF.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h3 className="font-bold text-slate-800 break-keep leading-snug">{r.name}</h3>
                <span className="flex items-center gap-1.5 shrink-0">
                  {r.managed === false && <span className="text-[10px] bg-slate-100 text-slate-500 border rounded-full px-2 py-0.5 font-semibold">관리 X</span>}
                  <button className="text-slate-300 hover:text-blue-600 text-sm leading-none" title="수정" onClick={() => setEdit({ table: "bi", row: r })}>✏️</button>
                </span>
              </div>
              {r.address && <p className="text-xs text-slate-400 break-keep mb-2">{r.address}</p>}
              <div className="space-y-1">
                <InfoRow label="건물주" value={r.owner_name} />
                <InfoRow label="전화" value={r.owner_phone} tel />
                <InfoRow label="계좌" value={r.owner_account} />
                <InfoRow label="통신사" value={r.telecom} />
                <InfoRow label="통신담당" value={r.telecom_contact} />
                <InfoRow label="관리비" value={r.mgmt_fee} />
                <InfoRow label="KEY" value={r.key_id} />
                <InfoRow label="관리자" value={r.manager_id} />
                <InfoRow label="이메일" value={r.email} />
                <InfoRow label="기타" value={r.note} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "ti" && (
        <div className="space-y-2">
          {tiF.length === 0 && <p className="text-sm text-slate-400 text-center py-8">결과가 없습니다.</p>}
          {tiF.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border p-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <b className="text-slate-800 break-keep">{r.building} {r.room_number}</b>
                {r.tenant_name && <span className="text-sm text-slate-500">{r.tenant_name}</span>}
                {r.phone && <a className="text-sm text-blue-600 font-medium" href={telHref(r.phone)}>{r.phone}</a>}
                {r.inquiry_type && <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-semibold">{r.inquiry_type}</span>}
                <div className="flex-1" />
                <span className="text-xs text-slate-400 shrink-0">{r.inquiry_date || "-"}{r.handled_date ? " → " + r.handled_date : ""}</span>
                <button className="text-slate-300 hover:text-blue-600 text-sm leading-none shrink-0" title="수정" onClick={() => setEdit({ table: "ti", row: r })}>✏️</button>
              </div>
              {r.inquiry_detail && <p className="text-sm text-slate-700 mt-1.5 whitespace-pre-wrap break-keep">{r.inquiry_detail}</p>}
              {r.as_detail && <p className="text-sm text-slate-600 mt-1 break-keep"><span className="text-slate-400">AS</span> {r.as_detail}</p>}
              {(r.note || r.staff || r.as_cost) && (
                <p className="text-xs text-slate-500 mt-1.5 break-keep">
                  {r.note && <span className="mr-2">↳ {r.note}</span>}
                  {r.staff && <span className="text-slate-400 mr-2">담당 {r.staff}</span>}
                  {r.as_cost && <span className="text-slate-400">단가 {r.as_cost}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "as" && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center flex-wrap mb-1">
            {[["all", "전체", asF.length], ["open", "미완료", asOpenCnt], ["done", "완료", asDoneCnt]].map(([k, lbl, c]) => (
              <button key={k} onClick={() => setAsStatus(k)}
                className={"px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 " +
                  (asStatus === k
                    ? (k === "open" ? "bg-amber-500 text-white border-amber-500" : k === "done" ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-700 text-white border-slate-700")
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")}>
                {lbl}<span className={asStatus === k ? "text-white/70" : "text-slate-400"}>{c}</span>
              </button>
            ))}
          </div>
          {asFS.length === 0 && <p className="text-sm text-slate-400 text-center py-8">결과가 없습니다.</p>}
          {asFS.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border p-3.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={"text-[10px] font-bold rounded-full px-2 py-0.5 border shrink-0 " + (AS_DONE(r) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{AS_DONE(r) ? "완료" : "미완료"}</span>
                <b className="text-slate-800 break-keep">{r.building} {r.room_number}</b>
                {r.tenant_name && <span className="text-sm text-slate-500">{r.tenant_name}</span>}
                {r.phone && (/[0-9]{4}/.test(r.phone)
                  ? <a className="text-sm text-blue-600 font-medium" href={telHref(r.phone)}>{r.phone}</a>
                  : <span className="text-sm text-slate-500">{r.phone}</span>)}
                <div className="flex-1" />
                <span className="text-xs text-slate-400 shrink-0">{r.received_date || "-"}{r.handled_date ? " → " + r.handled_date : ""}</span>
                <button className="text-slate-300 hover:text-blue-600 text-sm leading-none shrink-0" title="수정" onClick={() => setEdit({ table: "as", row: r })}>✏️</button>
              </div>
              {r.work_detail && <p className="text-sm text-slate-700 mt-1.5 whitespace-pre-wrap break-keep">{r.work_detail}</p>}
              {(r.note || r.staff || r.cost || r.paid) && (
                <p className="text-xs text-slate-500 mt-1.5 break-keep">
                  {r.note && <span className="mr-2">↳ {r.note}</span>}
                  {r.staff && <span className="text-slate-400 mr-2">담당 {r.staff}</span>}
                  {r.cost && r.cost !== "-" && <span className="text-slate-400 mr-2">비용 {isNaN(Number(r.cost)) ? r.cost : Number(r.cost).toLocaleString() + "원"}</span>}
                  {r.paid && <span className="text-emerald-600 font-semibold">수령 {r.paid}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {edit && (
        <ArchiveEditModal
          table={edit.table} row={edit.row}
          maxSeq={((edit.table === "bi" ? bi : edit.table === "ti" ? ti : asr) || []).reduce((m, r) => Math.max(m, Number(r.seq) || 0), 0)}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); load(); }} />
      )}
    </div>
  );
}
