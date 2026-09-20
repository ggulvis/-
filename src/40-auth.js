/* 보담 — 인증 화면들
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 인증 화면들 ---------------- */
function SetupScreen() {
  return (
    <div className="screen-h flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
        <div className="text-4xl mb-3">⚙️</div>
        <h1 className="text-xl font-bold mb-2">초기 설정이 필요합니다</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          index.html 상단의 <code className="bg-slate-100 px-1 rounded">SUPABASE_URL</code> 과{" "}
          <code className="bg-slate-100 px-1 rounded">SUPABASE_ANON_KEY</code> 를<br />
          본인의 Supabase 프로젝트 값으로 교체한 뒤 다시 배포하세요.
        </p>
      </div>
    </div>
  );
}
function LoginScreen() {
  const login = () => sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { prompt: "select_account" }, // 매번 구글 계정 선택 화면 표시
    },
  });
  return (
    <div className="screen-h flex items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-slate-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-2">🏢</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">보담 임대관리</h1>
        <p className="text-sm text-slate-500 mb-8">건물 임대차 현황 관리 시스템</p>
        <button onClick={login} className="w-full flex items-center justify-center gap-3 border border-slate-300 rounded-xl py-3 font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100">
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  );
}
/* 소속 = 상호명 + 유형(공인중개사사무소/중개법인). 저장은 "상호명 유형" 결합 문자열 하나(affiliation) */
const BIZ_TYPES = ["공인중개사사무소", "중개법인"];
function splitAffiliation(v) {
  const s = (v || "").trim();
  for (const t of BIZ_TYPES) { if (s.endsWith(t)) return { name: s.slice(0, s.length - t.length).trim(), type: t }; }
  return { name: s, type: "" };
}
function joinAffiliation(name, type) {
  const n = (name || "").trim();
  if (!n) return "";
  return type ? (n + " " + type) : n;
}
function AffiliationFields({ name, type, onName, onType }) {
  return (
    <div className="flex gap-2">
      <input className={inputCls + " flex-1 min-w-0"} value={name} onChange={(e) => onName(e.target.value)} placeholder="상호명 (예: 보담)" />
      <select className="border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white shrink-0 w-32" value={type} onChange={(e) => onType(e.target.value)}>
        <option value="">유형 선택</option>
        {BIZ_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}

function RegisterScreen({ session, onDone }) {
  const [affName, setAffName] = useState("");
  const [affType, setAffType] = useState("");
  const [name, setName] = useState(session.user.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!affName.trim() || !name.trim() || !phone.trim()) { setErr("소속·이름·연락처를 모두 입력해주세요."); return; }
    setBusy(true); setErr("");
    const { error } = await sb.from("user_roles").upsert({
      user_id: session.user.id, email: session.user.email, affiliation: joinAffiliation(affName, affType), full_name: name.trim(), phone: phone.trim(), role: "viewer", status: "pending",
    }, { onConflict: "email" });
    setBusy(false);
    if (error) setErr("등록 실패: " + error.message); else onDone();
  };
  return (
    <div className="screen-h flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-1">사용자 등록</h1>
        <p className="text-sm text-slate-500 mb-6">처음 방문하셨네요. 정보를 입력하면 관리자 승인 후 이용할 수 있습니다.</p>
        <Field label="소속 * (상호명 + 유형)"><AffiliationFields name={affName} type={affType} onName={setAffName} onType={setAffType} /></Field>
        <Field label="이름 *"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" /></Field>
        <p className="text-xs text-slate-400 -mt-1 mb-3">본인 이름을 적어주세요. 계약 축하·실적에 이 이름이 표시됩니다.</p>
        <Field label="연락처 *"><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" inputMode="tel" /></Field>
        {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
        <button className={btnPrimary + " w-full py-3"} onClick={submit} disabled={busy}>{busy ? "등록 중..." : "등록 요청"}</button>
        <button className="w-full text-center text-sm text-slate-400 mt-4 hover:text-slate-600" onClick={() => sb.auth.signOut()}>다른 계정으로 로그인</button>
      </div>
    </div>
  );
}
function PendingScreen({ profile, onUpdated }) {
  const initAff = splitAffiliation(profile.affiliation);
  const [affName, setAffName] = useState(initAff.name);
  const [affType, setAffType] = useState(initAff.type);
  const [name, setName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const combinedAff = joinAffiliation(affName, affType);
  const dirty = combinedAff !== (profile.affiliation || "") || name.trim() !== (profile.full_name || "") || phone.trim() !== (profile.phone || "");
  const save = async () => {
    setBusy(true);
    const { error } = await sb.from("user_roles").update({
      affiliation: combinedAff || null, full_name: name.trim() || null, phone: phone.trim() || null,
    }).eq("user_id", profile.user_id);
    setBusy(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    setSaved(true);
    if (onUpdated) onUpdated();
  };
  return (
    <div className="screen-h flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-2">⏳</div>
        <h1 className="text-xl font-bold text-slate-800 mb-1">승인 대기 중</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-4">
          가입 신청이 접수됐어요.<br />관리자가 승인하면 바로 이용할 수 있습니다.
        </p>
        <div className="text-left bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <p className="text-xs text-amber-800 mb-2 break-keep">아래를 채워주시면 <b>관리자가 알아보고 더 빨리 승인</b>해드려요 (선택).</p>
          <Field label="소속 (상호명 + 유형)"><AffiliationFields name={affName} type={affType} onName={(v) => { setAffName(v); setSaved(false); }} onType={(v) => { setAffType(v); setSaved(false); }} /></Field>
          <Field label="이름"><input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="예: 홍길동" /></Field>
          <Field label="연락처"><input className={inputCls} value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} placeholder="010-0000-0000" inputMode="tel" /></Field>
          <button className={btnPrimary + " w-full"} onClick={save} disabled={busy || (!dirty && saved)}>
            {busy ? "저장 중..." : saved && !dirty ? "저장됐어요 ✓" : "정보 저장"}
          </button>
        </div>
        <button className={btnGhost + " w-full"} onClick={() => window.location.reload()}>승인됐는지 새로고침</button>
        <button className="w-full text-center text-sm text-slate-400 mt-3 hover:text-slate-600" onClick={() => sb.auth.signOut()}>로그아웃</button>
      </div>
    </div>
  );
}

/* ---------------- 매물 사진 (꿀방에서 매일 동기화) ----------------
   사진 URL은 lease_images 테이블에 있고, RLS가 "그 매물을 볼 수 있는 사람"에게만 열어준다.
   모달을 열 때 그 매물 것만 불러온다(목록 전체를 미리 받지 않는다). */
function PhotoViewer({ urls, start, onClose }) {
  const [i, setI] = useState(start || 0);
  const go = (d) => setI((v) => (v + d + urls.length) % urls.length);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [urls.length]);
  const touch = useRef(null);
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <span className="text-sm font-medium">{i + 1} / {urls.length}</span>
        <button className="w-9 h-9 rounded-full bg-white/15 text-xl leading-none" onClick={onClose} aria-label="닫기">×</button>
      </div>
      <div className="flex-1 flex items-center justify-center px-2 pb-4 min-h-0"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}>
        {urls.length > 1 && (
          <button className="shrink-0 w-10 h-10 rounded-full bg-white/15 text-white text-xl" onClick={() => go(-1)} aria-label="이전">‹</button>
        )}
        <img src={urls[i]} className="flex-1 min-w-0 max-h-full object-contain select-none" alt={"매물 사진 " + (i + 1)} />
        {urls.length > 1 && (
          <button className="shrink-0 w-10 h-10 rounded-full bg-white/15 text-white text-xl" onClick={() => go(1)} aria-label="다음">›</button>
        )}
      </div>
    </div>
  );
}

function LeasePhotos({ leaseId }) {
  const [urls, setUrls] = useState(null); // null=로딩중, []=사진 없음
  const [view, setView] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!leaseId) { setUrls([]); return; }
    sb.from("lease_images").select("urls").eq("lease_id", leaseId).maybeSingle()
      .then(({ data }) => { if (alive) setUrls((data && data.urls) || []); });
    return () => { alive = false; };
  }, [leaseId]);
  if (!urls || !urls.length) return null; // 사진 없으면 자리도 차지하지 않는다
  return (
    <div className="mb-3">
      <h4 className="text-sm font-bold text-slate-700 mb-1.5">📷 매물 사진 <span className="text-slate-400 font-medium">{urls.length}</span>
        <span className="ml-1 text-[11px] font-medium text-amber-600">꿀방</span></h4>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        {urls.map((u, i) => (
          <button key={u} type="button" onClick={() => setView(i)} className="shrink-0">
            <img src={u} loading="lazy" alt={"매물 사진 " + (i + 1)}
              className="w-28 h-28 object-cover rounded-lg border bg-slate-100" />
          </button>
        ))}
      </div>
      {view !== null && <PhotoViewer urls={urls} start={view} onClose={() => setView(null)} />}
    </div>
  );
}
