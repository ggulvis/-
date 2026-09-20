/* 보담 — 매물 상세 팝업 (열람용)
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 매물 상세 팝업 (열람용) ---------------- */
function LeaseDetailModal({ lease, buildings, events, customFields, canEdit, me, staff, asRecords, onReloadAS, onClose, onEdit, onMarkDone, onCancelDone, onUpload }) {
  // 조회수 기록 (매물 상세를 열 때 1회). 실패해도 무시 — 테이블/함수 미생성 시에도 무해
  useEffect(() => { try { sb.rpc("log_lease_view", { p_lease: lease.id }).then(() => {}, () => {}); } catch (e) {} }, [lease.id]);
  const mayCancel = lease.contract_done && (canEdit || (me && lease.contract_done_by === (me.full_name || me.email)));
  const b = buildings.find((x) => x.id === lease.building_id) || {};
  const ev = events.find((e) => e.id === lease.event_id);
  const d = ddayInfo(lease.end_date);
  // AS·도배 이력 (관리인+): 이 매물에 연결된 as_records + 접수 폼
  const myAS = (asRecords || []).filter((r) => r.lease_id === lease.id);
  const asMaxSeq = (asRecords || []).reduce((m, r) => Math.max(m, Number(r.seq) || 0), 0);
  const [asOpen, setAsOpen] = useState(false);
  const [asForm, setAsForm] = useState({ work_detail: "", received_date: "", staff: "" });
  const [asBusy, setAsBusy] = useState(false);
  const submitAS = async () => {
    if (!asForm.work_detail.trim() || asBusy) return;
    setAsBusy(true);
    const { error } = await sb.from("as_records").insert({
      seq: asMaxSeq + 1, building: b.name || null, room_number: lease.room_number || null,
      tenant_name: lease.tenant_name || null, phone: lease.tenant_phone || null, lease_id: lease.id,
      received_date: asForm.received_date || null, work_detail: asForm.work_detail.trim(), staff: asForm.staff.trim() || null,
    });
    setAsBusy(false);
    if (error) { alert("AS 접수 실패: " + error.message); return; }
    setAsForm({ work_detail: "", received_date: "", staff: "" }); setAsOpen(false);
    if (onReloadAS) onReloadAS();
  };
  const Row = ({ k, v }) => (v === null || v === undefined || v === "") ? null : (
    <div className="flex justify-between gap-3 py-2 border-b border-slate-200/70 last:border-0 text-sm">
      <span className="text-slate-400 shrink-0">{k}</span>
      <span className="text-slate-800 font-medium text-right break-keep whitespace-pre-wrap">{v}</span>
    </div>
  );
  return (
    <Modal title={`${b.name || ""} ${fmtRoom(lease.room_number)}`} onClose={onClose}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + d.cls}>{d.label}</span>
        {lease.move_out && <span className="text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-300 rounded-full px-2 py-0.5">중도퇴실</span>}
        {ev && <span className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-full px-2 py-0.5 font-semibold">🎁 {ev.title}</span>}
        {lease.contract_done && <span className="text-xs text-emerald-700 font-semibold">🎉 {lease.contract_done_by} 계약완료</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[11px] text-amber-700 font-semibold mb-0.5">🔑 공동현관</p>
          <p className="font-bold text-slate-800 text-lg leading-tight">{b.entrance_code || <span className="text-slate-300 text-sm font-medium">미입력</span>}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[11px] text-amber-700 font-semibold mb-0.5">🚪 호실 비밀번호</p>
          <p className="font-bold text-slate-800 text-lg leading-tight">{lease.door_code || <span className="text-slate-300 text-sm font-medium">미입력</span>}</p>
        </div>
      </div>
      {lease.tenant_phone && (
        <a href={telHref(lease.tenant_phone)}
           className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white font-bold rounded-xl py-3 mb-2 active:bg-blue-700">
          📞 세입자에게 전화 <span className="opacity-70">·</span> {lease.tenant_phone}
        </a>
      )}
      {b.manager_phone && (
        <a href={telHref(b.manager_phone)}
           className="flex items-center justify-center gap-2 w-full bg-white border border-slate-300 text-slate-700 font-bold rounded-xl py-2.5 mb-3 active:bg-slate-50">
          📞 건물 관리인에게 전화 <span className="text-slate-400">·</span> {b.manager_phone}
        </a>
      )}
      {(((lease.tags && lease.tags.length) || (b.options && b.options.length)) > 0) && (
        <div className="flex flex-wrap gap-1 mb-3">
          <TagChips items={lease.tags} tone="lease" />
          <TagChips items={b.options} tone="building" />
        </div>
      )}
      <LeasePhotos leaseId={lease.id} />
      <div className="bg-slate-50 rounded-xl px-3 mb-3">
        {b.address && <Row k="주소" v={b.address} />}
        {b.memo && <Row k="건물 메모" v={"📌 " + b.memo} />}
        {canEdit && <Row k="임차인" v={lease.tenant_name} />}
        <Row k="입주날짜" v={lease.start_date} />
        <Row k="만기일" v={lease.end_date} />
        <Row k={((lease.vacant || lease._hope) ? "희망 " : "") + "보증금"} v={lease.deposit != null ? fmtKRW(lease.deposit) : null} />
        <Row k={((lease.vacant || lease._hope) ? "희망 " : "") + "월세"} v={lease.monthly_rent != null ? fmtKRW(lease.monthly_rent) : null} />
        <Row k={((lease.vacant || lease._hope) ? "희망 " : "") + "관리비"} v={lease.management_fee != null ? fmtKRW(lease.management_fee) : null} />
        {(lease.hope_deposit != null || lease.hope_rent != null || lease.hope_fee != null) && (
          <Row k="희망가 (보담회원 공개)" v={[lease.hope_deposit != null ? "보증금 " + fmtKRW(lease.hope_deposit) : null, lease.hope_rent != null && lease.hope_rent !== 0 ? "월세 " + fmtKRW(lease.hope_rent) : null, lease.hope_fee != null ? "관리비 " + fmtKRW(lease.hope_fee) : null].filter(Boolean).join(" · ")} />
        )}
        <Row k="보증보험" v={isInsured(lease) ? "가입" : null} />
        {customFields.map((cf) => <Row key={cf.id} k={cf.field_label} v={(lease.custom_data || {})[cf.field_key]} />)}
        {me && me.role === "admin" && staff && <Row k="담당실장 🔒" v={staff} />}
        <Row k="메모" v={lease.memo} />
      </div>
      {canEdit && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-sm font-bold text-slate-700">🔧 AS·도배 이력 <span className="text-slate-400 font-medium">{myAS.length}</span></h4>
            <button className="text-xs font-bold text-blue-600" onClick={() => setAsOpen((v) => !v)}>{asOpen ? "취소" : "＋ AS 접수"}</button>
          </div>
          {asOpen && (
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-2.5 mb-2 space-y-2">
              <textarea className={inputCls} rows={2} placeholder="작업내용 (예: 화장실 문손잡이 교체)" value={asForm.work_detail} onChange={(e) => setAsForm((s) => ({ ...s, work_detail: e.target.value }))} />
              <div className="flex gap-2">
                <input type="date" className={inputCls} value={asForm.received_date} onChange={(e) => setAsForm((s) => ({ ...s, received_date: e.target.value }))} />
                <input className={inputCls} placeholder="담당 (선택)" value={asForm.staff} onChange={(e) => setAsForm((s) => ({ ...s, staff: e.target.value }))} />
              </div>
              <button className={btnPrimary + " w-full"} disabled={asBusy || !asForm.work_detail.trim()} onClick={submitAS}>{asBusy ? "저장 중..." : "접수 등록"}</button>
            </div>
          )}
          {myAS.length === 0 && !asOpen && <p className="text-xs text-slate-400">등록된 AS·도배 이력이 없습니다.</p>}
          <div className="space-y-1.5">
            {myAS.map((r) => (
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
      <button className="w-full mb-2 bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg py-2.5"
        onClick={() => onUpload(lease)}>📄 계약서 사진 업로드 (자동 인식)</button>
      <div className="flex gap-2 pb-2">
        {!lease.contract_done && (
          <button className="flex-1 bg-emerald-50 border border-emerald-300 text-emerald-700 font-bold rounded-lg py-2.5"
            onClick={() => { onClose(); onMarkDone(lease); }}>🎉 계약완료</button>
        )}
        {mayCancel && (
          <button className="flex-1 bg-slate-50 border border-slate-300 text-slate-500 font-bold rounded-lg py-2.5"
            onClick={() => { onClose(); onCancelDone(lease); }}>계약취소</button>
        )}
        {canEdit && <button className={btnPrimary + " flex-1"} onClick={() => onEdit(lease)}>수정</button>}
        <button className={btnGhost} onClick={onClose}>닫기</button>
      </div>
    </Modal>
  );
}

/* PDF 계약서 지원 — 사장님들이 계약서를 PDF 스캔본으로 받는 일이 많다.
   ⚠️ **한 PDF에 여러 계약서가 들어 있는 경우가 흔하다**(실제로 받은 파일은 5·13·11쪽이
      각각 다른 호실이었다). 그래서 1쪽을 무조건 쓰지 않고 **쪽을 고르게** 한다.
   pdf.js 는 1MB 가 넘어 **쓸 때만 내려받는다**(평소 로딩을 무겁게 하지 않는다). */
const PDFJS_VER = "3.11.174";   // UMD 빌드(window.pdfjsLib) — 4.x 는 ESM 이라 이 방식으로 못 쓴다
let _pdfjsPromise = null;
function loadPdfJs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((res, rej) => {
    if (window.pdfjsLib) return res(window.pdfjsLib);
    const sc = document.createElement("script");
    sc.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.min.js`;
    sc.onload = () => res(window.pdfjsLib);
    sc.onerror = () => { _pdfjsPromise = null; rej(new Error("PDF 라이브러리를 못 불러왔습니다")); };
    document.head.appendChild(sc);
  }).then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js`;
    return lib;
  });
  return _pdfjsPromise;
}
/** PDF 의 한 쪽을 JPEG File 로 만든다 (OCR·업로드는 이미지로만 한다) */
async function pdfPageToFile(doc, pageNo, name) {
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale: 2 });          // 계약서 글씨를 읽으려면 2배는 필요하다
  const cv = document.createElement("canvas");
  cv.width = vp.width; cv.height = vp.height;
  await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
  const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
  return new File([blob], name.replace(/\.pdf$/i, "") + `_${pageNo}쪽.jpg`, { type: "image/jpeg" });
}
