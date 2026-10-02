/* 보담 — 계약서 사진 업로드 (OCR 자동 추출)
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 계약서 사진 업로드 (OCR 자동 추출) ---------------- */
function ContractUploadModal({ lease, buildings, me, onClose, onSaved }) {
  const b = buildings.find((x) => x.id === lease.building_id) || {};
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [ocrState, setOcrState] = useState("");   // "", "진행중 xx%", "완료", "실패"
  const [extracted, setExtracted] = useState({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const pickRef = useRef(null);   // 앨범 전용 입력 (capture 없음)
  const [pdf, setPdf] = useState(null);        // {doc, count, page, name} — PDF 를 고른 경우

  /** PDF 면 쪽을 골라 이미지로 바꾼 뒤 기존 흐름을 탄다 */
  const handlePick = async (f2) => {
    if (!f2) return;
    if (f2.type === "application/pdf" || /\.pdf$/i.test(f2.name || "")) {
      setOcrState("PDF 여는 중…"); setExtracted({}); setFile(null); setPreview(null);
      try {
        const lib = await loadPdfJs();
        const doc = await lib.getDocument({ data: await f2.arrayBuffer() }).promise;
        setPdf({ doc, count: doc.numPages, page: 1, name: f2.name || "계약서.pdf" });
        await handleFile(await pdfPageToFile(doc, 1, f2.name || "계약서.pdf"));
      } catch (e) { setOcrState("PDF 를 열지 못했습니다: " + e.message); }
      return;
    }
    setPdf(null);
    await handleFile(f2);
  };
  /** PDF 쪽 이동 — 그 쪽으로 다시 스캔한다 */
  const gotoPdfPage = async (n) => {
    if (!pdf || n < 1 || n > pdf.count) return;
    setPdf({ ...pdf, page: n });
    await handleFile(await pdfPageToFile(pdf.doc, n, pdf.name));
  };

  const handleFile = async (f2) => {
    if (!f2) return;
    const small = await downscaleImage(f2, 1600);
    setFile(small);
    setPreview(URL.createObjectURL(small));
    setExtracted({});
    setOcrState("🤖 AI 스캔 중... (Claude)");
    try {
      const b64 = await fileToB64(small);
      const { data, error } = await sb.functions.invoke("parse-contract", { body: { image: b64, mime: "image/jpeg" } });
      if (error) throw new Error(error.message || "함수 호출 실패");
      if (data && data.error) throw new Error(data.error);
      const ex = (data && data.extracted) || {};
      const parsed = {};
      ["tenant_name", "tenant_phone", "start_date", "end_date"].forEach((k) => { if (ex[k]) parsed[k] = String(ex[k]); });
      ["deposit", "rent", "management_fee"].forEach((k) => { const n = Number(ex[k]); if (ex[k] != null && !isNaN(n)) parsed[k] = n; });
      setExtracted(parsed);
      setOcrState(Object.keys(parsed).length ? "🤖 AI 스캔 완료 — 추출 결과는 승인 시 수정 가능합니다" : "AI 스캔 완료 — 인식된 항목이 없습니다 (승인자가 직접 입력)");
    } catch (e2) {
      setOcrState("AI 스캔 실패(" + e2.message + ") — 예비 스캔 시도 중...");
      try {
        const result = await Tesseract.recognize(small, "kor+eng", {
          logger: (m) => { if (m.status === "recognizing text") setOcrState(`예비 스캔 중... ${Math.round(m.progress * 100)}%`); },
        });
        const parsed = parseContractText(result.data.text || "");
        setExtracted(parsed);
        setOcrState("예비 스캔 완료 (정확도 낮음) — 승인 시 반드시 확인하세요");
      } catch (e3) {
        setOcrState("자동 스캔 실패 — 사진만 제출됩니다 (승인자가 직접 입력)");
      }
    }
  };

  const submit = async () => {
    if (!file) { setErr("계약서 사진을 선택해주세요."); return; }
    setBusy(true); setErr("");
    try {
      const path = `${lease.id}/${Date.now()}.jpg`;
      const { error: upErr } = await sb.storage.from("contracts").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await sb.from("contract_submissions").insert({
        lease_id: lease.id, file_path: path, extracted, note: note.trim() || null,
        submitted_by: (me && (me.full_name || me.email)) || null, submitted_user: me.user_id,
      });
      if (error) throw error;
      alert("제출 완료! 편집자가 승인하면 매물 정보에 반영됩니다.");
      onSaved(); onClose();
    } catch (e2) { setErr("제출 실패: " + e2.message); }
    finally { setBusy(false); }
  };

  const exRow = (k, label, isMoney) => extracted[k] == null ? null : (
    <div key={k} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-800">{isMoney ? fmtKRW(extracted[k]) : extracted[k]}</span>
    </div>
  );

  return (
    <Modal title={`📄 계약서 업로드 — ${b.name || ""} ${lease.room_number || ""}`} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-3 break-keep">계약서를 사진으로 찍어 올리면 날짜·금액을 자동 인식합니다. <b>편집자가 승인해야</b> 매물 정보에 반영됩니다.</p>
      {/* ⛔ 입력을 **둘로 나눈다.** `capture="environment"` 가 붙은 입력 하나만 두면
             모바일에서 **카메라가 바로 열려 앨범에 미리 찍어 둔 사진을 고를 수 없다**
             (버튼 글씨는 "촬영 / 선택"이었지만 실제로는 촬영만 됐다).
             계약서를 미리 다 찍어 두고 나중에 올리는 방식이 실제 업무에 더 맞다. */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePick(e.target.files[0])} />
      <input ref={pickRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => handlePick(e.target.files[0])} />
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button className={btnGhost + " py-3"} onClick={() => fileRef.current.click()}>📷 지금 촬영</button>
        <button className={btnGhost + " py-3"} onClick={() => pickRef.current.click()}>🖼️ 사진·PDF 고르기</button>
      </div>
      {pdf && pdf.count > 1 && (
        <div className="flex items-center justify-center gap-2 mb-3 bg-amber-50 border border-amber-200 rounded-xl py-2">
          <button className={btnGhost + " px-3 py-1"} disabled={pdf.page <= 1} onClick={() => gotoPdfPage(pdf.page - 1)}>◀</button>
          <span className="text-sm font-semibold text-amber-800">{pdf.count}쪽 중 <b>{pdf.page}쪽</b></span>
          <button className={btnGhost + " px-3 py-1"} disabled={pdf.page >= pdf.count} onClick={() => gotoPdfPage(pdf.page + 1)}>▶</button>
        </div>
      )}
      {pdf && pdf.count > 1 && <p className="text-xs text-slate-400 -mt-2 mb-2 break-keep">이 PDF에 계약서가 여러 건 들어 있습니다. <b>이 방의 계약서 쪽</b>을 찾아서 올려주세요.</p>}
      {file && !pdf && <p className="text-xs text-slate-400 -mt-2 mb-2">다시 고르려면 위 버튼을 누르세요.</p>}
      {preview && <img src={preview} className="w-full rounded-xl border mb-2 max-h-72 object-contain bg-slate-50" />}
      {ocrState && <p className="text-xs text-blue-600 font-medium mb-2">{ocrState}</p>}
      {Object.keys(extracted).length > 0 && (
        <div className="bg-slate-50 rounded-xl px-3 py-2 mb-3">
          {exRow("tenant_name", "임차인(추정)")}
          {exRow("start_date", "입주날짜(추정)")}
          {exRow("end_date", "만기일(추정)")}
          {exRow("deposit", "보증금(추정)", true)}
          {exRow("rent", "월세(추정)", true)}
          {exRow("management_fee", "관리비(추정)", true)}
          {exRow("tenant_phone", "연락처(추정)")}
        </div>
      )}
      <Field label="메모 (선택)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="승인자에게 전달할 내용" /></Field>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      <div className="flex gap-2 pb-2">
        <button className={btnPrimary + " flex-1 py-3"} onClick={submit} disabled={busy || !file}>{busy ? "제출 중..." : "제출 (승인 요청)"}</button>
        <button className={btnGhost} onClick={onClose}>취소</button>
      </div>
    </Modal>
  );
}
