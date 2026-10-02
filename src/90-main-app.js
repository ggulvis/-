/* 보담 — 메인 앱
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 메인 앱 ---------------- */
function OrganizeView({ buildings, leases, onBack, onSaved }) {
  const [isPC, setIsPC] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 900 : true));
  useEffect(() => {
    const h = () => setIsPC(window.innerWidth >= 900);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const [region, setRegion] = useState("all");
  const [sub, setSub] = useState("전체");
  const [bid, setBid] = useState(null);

  if (!isPC) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700 text-sm mb-8">← 뒤로</button>
        <div className="text-center text-slate-500 mt-12">
          <div className="text-5xl mb-4">🖥️</div>
          <p className="font-bold text-slate-700 text-lg mb-2">건물별 정리는 PC에서 사용하세요</p>
          <p className="text-sm leading-relaxed">건물별 데이터를 표로 펼쳐 직접 입력·수정하는 기능이라 넓은 화면에 최적화돼 있어요.<br />모바일에서는 매물을 눌러 개별 수정해 주세요.</p>
        </div>
      </div>
    );
  }

  const subs = REGION_SUBS[region] || [];
  const list = buildings.filter((b) => {
    if (region !== "all" && regionOf(b) !== region) return false;
    if (region !== "all" && sub !== "전체" && subAreaOf(b) !== sub) return false;
    return true;
  }).sort((x, y) => ((x.active === false) !== (y.active === false)) ? (x.active === false ? 1 : -1) : x.name.localeCompare(y.name, "ko"));
  const building = buildings.find((b) => b.id === bid) || null;
  const bLeases = building ? leases.filter((l) => l.building_id === building.id) : [];

  return (
    <div className="px-1 sm:px-2 py-3">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700 text-xl px-1">←</button>
        <h2 className="text-lg font-bold text-slate-800">건물별 정리</h2>
        <span className="text-xs text-slate-400 hidden md:inline">건물을 골라 표에서 바로 입력·수정하세요. 모든 변경은 이력에 기록됩니다.</span>
      </div>
      <div className="flex gap-1.5 mb-2 flex-wrap">
        {REGION_TABS.map(([key, label]) => (
          <button key={key} onClick={() => { setRegion(key); setSub("전체"); setBid(null); }}
            className={"px-3 py-1.5 rounded-lg text-sm font-semibold " + (region === key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{label}</button>
        ))}
      </div>
      {subs.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {subs.map((s) => (
            <button key={s} onClick={() => { setSub(s); setBid(null); }}
              className={"px-2.5 py-1 rounded-full text-xs font-semibold border " + (sub === s ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-500 border-slate-300 hover:bg-slate-50")}>{s}</button>
          ))}
        </div>
      )}
      <div className="flex gap-4">
        <div className="w-52 shrink-0 border-r pr-3 overflow-y-auto" style={{ maxHeight: "72vh" }}>
          {list.length === 0 && <p className="text-sm text-slate-400 py-4">건물이 없습니다.</p>}
          {list.map((b) => {
            const cnt = leases.filter((l) => l.building_id === b.id).length;
            return (
              <button key={b.id} onClick={() => setBid(b.id)}
                className={"w-full text-left px-3 py-2 rounded-lg mb-1 " + (bid === b.id ? "bg-blue-50 text-blue-700 font-bold" : "hover:bg-slate-50 text-slate-700")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm break-keep">{b.name}{b.active === false && <span className="ml-1 text-[10px] text-red-500 font-semibold">중단</span>}</span>
                  <span className="text-xs text-slate-400 shrink-0">{cnt}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-0">
          {!building ? (
            <div className="text-slate-400 py-20 text-center">← 왼쪽에서 건물을 선택하면 표가 열립니다.</div>
          ) : (
            <BuildingEditTable key={building.id} building={building} rows={bLeases} onSaved={onSaved} />
          )}
        </div>
      </div>
    </div>
  );
}

function BuildingEditTable({ building, rows, onSaved }) {
  const COLS = [["room_number", "호수", "text"], ["tenant_name", "세입자", "text"], ["tenant_phone", "연락처", "text"], ["start_date", "입주", "date"], ["end_date", "만기", "date"], ["deposit", "보증금", "num"], ["monthly_rent", "월세", "num"], ["management_fee", "관리비", "num"], ["hope_deposit", "희망보증", "num"], ["hope_rent", "희망월세", "num"], ["hope_fee", "희망관리", "num"], ["bonus_landlord", "임대인보너스", "num"], ["bonus_tenant", "임차인보너스", "num"], ["bonus_other", "기타보너스", "text"], ["vacant", "공실", "bool"], ["insurance", "보증보험", "ins"], ["memo", "메모", "text"]];
  const colW = { room_number: "80px", tenant_name: "100px", tenant_phone: "130px", start_date: "140px", end_date: "140px", deposit: "80px", monthly_rent: "70px", management_fee: "70px", hope_deposit: "70px", hope_rent: "70px", hope_fee: "70px", bonus_landlord: "82px", bonus_tenant: "82px", bonus_other: "150px", vacant: "44px", insurance: "84px", memo: "180px" };
  const sorted = [...rows].sort(leaseSort);
  const [edits, setEdits] = useState({});
  const [news, setNews] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const tmp = useRef(0);
  // 건물 상세설명(메모) 인라인 편집 — manager+ (buildings b_mod RLS)
  const [memoEdit, setMemoEdit] = useState(null); // null=보기, 문자열=편집중
  const [memoBusy, setMemoBusy] = useState(false);
  const saveMemo = async () => {
    setMemoBusy(true); setMsg("");
    const { error } = await sb.from("buildings").update({ memo: (memoEdit || "").trim() || null }).eq("id", building.id);
    setMemoBusy(false);
    if (error) { setMsg("건물 메모 저장 실패: " + error.message); return; }
    setMemoEdit(null); onSaved();
  };

  const insOf = (l) => l.insurance ? "done" : l.insurance_pending ? "progress" : "";
  const curVal = (l, f) => {
    const e = edits[l.id];
    if (e && f in e) return e[f];
    if (f === "insurance") return insOf(l);
    if (f === "vacant") return !!l.vacant;
    return l[f] == null ? "" : l[f];
  };
  const setVal = (id, f, v) => setEdits((p) => ({ ...p, [id]: { ...(p[id] || {}), [f]: v } }));
  const dirty = (id) => edits[id] && Object.keys(edits[id]).length > 0;

  const mkPayload = (get) => {
    const p = {};
    for (const col of COLS) {
      const f = col[0], type = col[2];
      if (f === "insurance") { const v = get("insurance"); p.insurance = v === "done"; p.insurance_pending = v === "progress"; }
      else if (f === "vacant") { p.vacant = !!get("vacant"); }
      else if (type === "num") { p[f] = numOrNull(get(f)); }
      else { const v = String(get(f) == null ? "" : get(f)).trim(); p[f] = v || null; }
    }
    return p;
  };

  // 보너스 3열 처리: 법정 상한 초과 검증(임대인·임차인) + side별 태그 동기화. 에러문구 반환(없으면 null)
  const applyBonus = (p, existingTags) => {
    const legal = legalMaxFee(p.hope_deposit != null ? p.hope_deposit : p.deposit,
                              p.hope_rent != null ? p.hope_rent : p.monthly_rent);
    for (const [f, who] of [["bonus_landlord", "임대인"], ["bonus_tenant", "임차인"]]) {
      const v = p[f];
      if (v != null && v > 0 && legal != null && v <= legal)
        return `${who} 보너스는 법정 상한 ${+legal.toFixed(1)}만원을 초과해야 보너스로 인정됩니다 (입력 ${v}만원).`;
    }
    const tags = (Array.isArray(existingTags) ? existingTags : []).filter((t) => !BONUS_TAGS.includes(t));
    if (p.bonus_landlord != null && p.bonus_landlord > 0) tags.push("임대인 복비보너스");
    if (p.bonus_tenant != null && p.bonus_tenant > 0) tags.push("임차인 복비보너스");
    if (p.bonus_other && String(p.bonus_other).trim()) tags.push("복비보너스");
    p.tags = tags;
    return null;
  };

  const saveRow = async (l) => {
    setMsg(""); setBusy(l.id);
    const p = mkPayload((f) => curVal(l, f));
    if (!p.room_number) { setMsg("호수는 필수입니다."); setBusy(null); return; }
    const be = applyBonus(p, l.tags);
    if (be) { setMsg(be); setBusy(null); return; }
    const { error } = await sb.from("leases").update(p).eq("id", l.id);
    setBusy(null);
    if (error) setMsg("저장 실패: " + error.message);
    else { setEdits((s) => { const n = { ...s }; delete n[l.id]; return n; }); onSaved(); }
  };
  const saveNew = async (nr) => {
    setMsg(""); setBusy(nr.k);
    const p = mkPayload((f) => nr.f[f]);
    p.building_id = building.id;
    if (!p.room_number) { setMsg("호수는 필수입니다."); setBusy(null); return; }
    const be = applyBonus(p, []);
    if (be) { setMsg(be); setBusy(null); return; }
    const { error } = await sb.from("leases").insert(p);
    setBusy(null);
    if (error) setMsg("추가 실패: " + error.message);
    else { setNews((s) => s.filter((x) => x.k !== nr.k)); onSaved(); }
  };
  const addRow = () => { tmp.current += 1; setNews((s) => [...s, { k: "n" + tmp.current, f: {} }]); };
  const setNewVal = (k, f, v) => setNews((s) => s.map((x) => x.k === k ? { ...x, f: { ...x.f, [f]: v } } : x));

  const cell = (type, value, onChange, disabled) => {
    if (type === "bool") return <input type="checkbox" className="w-4 h-4 accent-sky-600" checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />;
    if (type === "ins") return (
      <select className="border border-slate-200 rounded px-1 py-1 text-xs w-full bg-white" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">미지정</option>
        <option value="progress">가입중</option>
        <option value="done">가입</option>
      </select>
    );
    return <input type={type === "date" ? "date" : "text"} inputMode={type === "num" ? "numeric" : undefined}
      className="border border-slate-200 rounded px-1.5 py-1 text-xs w-full focus:ring-1 focus:ring-blue-400 focus:outline-none"
      value={value == null ? "" : value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-slate-800">{building.name} <span className="text-sm text-slate-400 font-normal">{sorted.length}호실</span>{building.active === false && <span className="ml-1.5 text-[10px] bg-red-100 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-semibold align-middle">관리중단</span>}</h3>
          {building.address && <p className="text-xs text-slate-400">{building.address}</p>}
          {memoEdit === null ? (
            <div className="flex items-start gap-1.5 mt-0.5">
              {building.memo
                ? <p className="text-xs text-amber-700 break-keep">📌 {building.memo}</p>
                : <p className="text-xs text-slate-300">📌 건물 상세설명 없음</p>}
              <button type="button" className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold shrink-0 whitespace-nowrap" onClick={() => setMemoEdit(building.memo || "")}>✏️ 수정</button>
            </div>
          ) : (
            <div className="mt-1 mb-1" style={{ maxWidth: "560px" }}>
              <textarea autoFocus rows={2}
                className="w-full border border-amber-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
                placeholder="예: 주차 불가 · 가격협의 가능 · 입금은 신협 계좌로"
                value={memoEdit} onChange={(e) => setMemoEdit(e.target.value)} />
              <div className="flex gap-1.5 mt-1">
                <button type="button" className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-3 py-1 disabled:opacity-50" disabled={memoBusy} onClick={saveMemo}>{memoBusy ? "저장 중..." : "저장"}</button>
                <button type="button" className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded px-3 py-1" onClick={() => setMemoEdit(null)}>취소</button>
              </div>
            </div>
          )}
        </div>
        <button className={btnPrimary} onClick={addRow}>+ 새 호실 추가</button>
      </div>
      {msg && <p className="text-sm text-red-600 mb-2 font-medium">{msg}</p>}
      <div className="overflow-auto border rounded-lg" style={{ maxHeight: "62vh" }}>
        <table className="text-xs" style={{ minWidth: "100%" }}>
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              {COLS.map((col) => <th key={col[0]} className="px-2 py-2 font-semibold text-slate-500 text-left whitespace-nowrap border-b" style={{ minWidth: colW[col[0]] }}>{col[1]}</th>)}
              <th className="px-2 py-2 border-b whitespace-nowrap" style={{ minWidth: "78px" }}></th>
            </tr>
          </thead>
          <tbody>
            {news.map((nr) => (
              <tr key={nr.k} className="bg-amber-50 border-b">
                {COLS.map((col) => <td key={col[0]} className="px-1.5 py-1 align-top">{cell(col[2], nr.f[col[0]] == null ? (col[2] === "bool" ? false : "") : nr.f[col[0]], (v) => setNewVal(nr.k, col[0], v), busy === nr.k)}</td>)}
                <td className="px-1.5 py-1 whitespace-nowrap align-top">
                  <button className="text-emerald-600 font-bold text-xs mr-2 disabled:opacity-40" onClick={() => saveNew(nr)} disabled={busy === nr.k}>저장</button>
                  <button className="text-slate-400 hover:text-slate-600 text-xs" onClick={() => setNews((s) => s.filter((x) => x.k !== nr.k))} disabled={busy === nr.k}>취소</button>
                </td>
              </tr>
            ))}
            {sorted.map((l) => (
              <tr key={l.id} className={"border-b " + (dirty(l.id) ? "bg-blue-50" : "hover:bg-slate-50")}>
                {COLS.map((col) => <td key={col[0]} className="px-1.5 py-1 align-top">{cell(col[2], curVal(l, col[0]), (v) => setVal(l.id, col[0], v), busy === l.id)}</td>)}
                <td className="px-1.5 py-1 whitespace-nowrap align-top">
                  {dirty(l.id) && <button className="text-blue-600 font-bold text-xs disabled:opacity-40" onClick={() => saveRow(l)} disabled={busy === l.id}>저장</button>}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && news.length === 0 && <tr><td colSpan={COLS.length + 1} className="text-center text-slate-400 py-8">호실이 없습니다. 오른쪽 위 "+ 새 호실 추가"로 시작하세요.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2">칸을 고치면 파란색으로 바뀌고 오른쪽 끝에 "저장"이 나타납니다. 보증금·월세·관리비는 만원 단위예요.</p>
    </div>
  );
}

/* 축하 코너 개별 카드: 이모지 반응 + 펼침형 댓글 */
function CelebrationItem({ lease, building, profile, reactions, comments, onToggleReaction, onAddComment, onDeleteComment }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const rlist = reactions.filter((r) => r.lease_id === lease.id);
  const reactedNames = [...new Set(rlist.map((r) => r.by_name).filter(Boolean))];
  const clist = comments.filter((c) => c.lease_id === lease.id);
  const isAdmin = profile.role === "admin";

  const send = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const res = await onAddComment(lease, draft);
    setBusy(false);
    if (res && res.ok) setDraft("");
  };

  return (
    <div className="pb-2 border-b border-amber-100 last:border-0 last:pb-0">
      <p className="text-sm text-slate-700 break-keep">
        <b>{lease.contract_done_by || "동료"}</b>님이 {(building && building.name) || ""} {lease.room_number} 계약을 완료했습니다!
        <span className="text-slate-400 ml-1">({String(lease.contract_done_at).slice(0, 10)})</span>
      </p>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {["👍", "❤️", "👏"].map((em) => {
          const rs = rlist.filter((r) => r.emoji === em);
          const mine = rs.some((r) => r.by_user === profile.user_id);
          return (
            <button key={em} onClick={() => onToggleReaction(lease, em)}
              title={rs.map((r) => r.by_name).join(", ")}
              className={"text-sm rounded-full border px-2.5 py-0.5 transition " +
                (mine ? "bg-amber-200/70 border-amber-400" : "bg-white/70 border-slate-200 hover:bg-white")}>
              {em}{rs.length > 0 && <b className="ml-1 text-xs text-slate-600">{rs.length}</b>}
            </button>
          );
        })}
        <button onClick={() => setOpen((v) => !v)}
          className={"text-sm rounded-full border px-2.5 py-0.5 transition inline-flex items-center gap-1 " +
            (open ? "bg-amber-200/70 border-amber-400" : "bg-white/70 border-slate-200 hover:bg-white")}>
          💬 댓글{clist.length > 0 && <b className="text-xs text-slate-600">{clist.length}</b>}
        </button>
        {reactedNames.length > 0 && (
          <span className="text-xs text-slate-400 break-keep">{reactedNames.join(" · ")}님이 축하했어요</span>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-1.5">
          {clist.map((c) => (
            <div key={c.id} className="flex items-start gap-1.5 bg-white/70 border border-amber-100 rounded-lg px-2.5 py-1.5">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-600 mr-1.5">{c.by_name || "동료"}</span>
                <span className="text-sm text-slate-700 break-keep whitespace-pre-wrap">{c.body}</span>
              </div>
              {(c.by_user === profile.user_id || isAdmin) && (
                <button onClick={() => onDeleteComment(c)} title="삭제"
                  className="text-slate-300 hover:text-red-500 text-xs leading-none shrink-0 mt-0.5">✕</button>
              )}
            </div>
          ))}
          {clist.length === 0 && <p className="text-xs text-slate-400 px-1">첫 축하 댓글을 남겨보세요 🎊</p>}
          <div className="flex items-center gap-1.5 pt-0.5">
            <input className={inputCls + " !py-1.5 text-sm"} value={draft} maxLength={500}
              placeholder="축하 댓글 남기기..." onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }} />
            <button onClick={send} disabled={busy || !draft.trim()}
              className={btnPrimary + " !py-1.5 shrink-0"}>{busy ? "..." : "등록"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MainApp({ session, profile, onProfileChanged }) {
  const [buildings, setBuildings] = useState([]);
  const [leases, setLeases] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [events, setEvents] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [comments, setComments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [roulette, setRoulette] = useState([]); // 꽝 없는 룰렛 이벤트 슬롯
  const [asRecords, setAsRecords] = useState([]); // AS·도배 이력 (관리인+; RLS로 그 외엔 빈 배열) — 매물 상세 표시용
  const [adminStaff, setAdminStaff] = useState({}); // lease_id → 담당실장 (관리자 전용)
  const [photoCounts, setPhotoCounts] = useState({}); // lease_id → 꿀방 사진 장수 (목록 배지용)
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState({ name: "home" }); // home | building | all | events | archive | organize | manage | arrears | ledger
  const [mgrMode, setMgrMode] = useState(null); // 관리인+ 로그인 직후 모드 선택: null=미선택(선택화면) | "normal" | "manage"
  const [region, setRegion] = useState("all");   // 지역 탭
  const [subArea, setSubArea] = useState("전체"); // 세부 동 탭
  const [insFilter, setInsFilter] = useState(false); // 보증보험 필터 (가입완료+가입중 매물 있는 건물만)
  const [bonusFilter, setBonusFilter] = useState(false); // 복비 보너스 필터 (보너스 태그 매물만)
  const [eventFilter, setEventFilter] = useState(false); // 이벤트 매물 필터 (event_id 연결 매물만)
  const [buildingTag, setBuildingTag] = useState(null); // 건물 태그 필터 (선택된 태그 1개)
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // {type:'lease'|'building'|'admin'|'profile', ...}
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [updateReady, setUpdateReady] = useState(false); // 새 버전 배포 감지
  const [notifToasts, setNotifToasts] = useState([]); // 인앱 축하 알림 토스트
  const notifBaseline = useRef(null); // 이 시각 이후의 축하만 알림 (localStorage 영속)
  const [pushOn, setPushOn] = useState(false); // 푸시 알림 구독 여부
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPrompt, setPushPrompt] = useState(false); // 로그인 후 알림 권유 배너 (회원당 1회)
  const [promoIOS, setPromoIOS] = useState(false);
  // 삼성 인터넷 안내 배너 — 한 번 닫으면 다시 띄우지 않는다
  const [hideSamsung, setHideSamsung] = useState(() => {
    try { return localStorage.getItem("bodam_hide_samsung") === "1"; } catch (e) { return false; }
  });
  const dismissSamsung = () => {
    setHideSamsung(true);
    try { localStorage.setItem("bodam_hide_samsung", "1"); } catch (e) {}
  };     // 아이폰·아이패드 사파리 탭: 켜기 버튼 대신 홈 화면 추가 안내

  const canEdit = ["manager", "admin"].includes(profile.role);          // 매물 편집: 관리인 이상
  const canManage = ["manager", "admin"].includes(profile.role);        // 계약서 승인: 관리인 이상
  const canApprove = ["editor", "manager", "admin"].includes(profile.role); // 가입 승인: 편집자 이상
  const isAdmin = profile.role === "admin";

  // leases는 1천건 초과 → PostgREST 기본 상한(1000행)에 걸려 잘림. fetchTableAll로 전량 조회.
  const fetchLeasesAll = () => fetchTableAll("leases", "*", ["id"]);

  const fetchAll = async () => {
    try { await sb.rpc("cleanup_contract_flags"); } catch (e) { /* 60일 지난 완료표시 정리 (실패해도 무시) */ }
    const [b, l, f, e, r, cs, cc, rs, ar, pi] = await Promise.all([
      sb.from("buildings").select("*"),
      fetchLeasesAll(),
      sb.from("custom_fields").select("*").order("sort_order"),
      sb.from("events").select("*").order("created_at", { ascending: false }),
      sb.from("celebration_reactions").select("*"),
      sb.from("contract_submissions").select("*").order("created_at", { ascending: false }),
      sb.from("celebration_comments").select("*").order("created_at"),
      sb.from("roulette_slots").select("*").order("idx"), // 테이블 미생성이면 error → 빈 배열
      sb.from("as_records").select("*").order("seq", { ascending: false }), // 관리인+ RLS; 그 외 빈 배열
      // 목록 배지용 사진 장수만. urls까지 받으면 1분 폴링마다 수십 KB가 오간다(사진은 모달에서 따로 조회).
      // 사진 있는 매물은 leases 수만큼 늘 수 있으므로 1000행 상한 대비.
      fetchTableAll("lease_images", "lease_id,n", ["lease_id"]),
    ]);
    inactiveBuildingIds = new Set((b.data || []).filter((x) => x.active === false).map((x) => x.id));
    setBuildings((b.data || []).sort((x, y) => x.name.localeCompare(y.name, "ko")));
    // 희망가(hope_*)가 있는 매물: 관리인 미만 등급에게는 실제 계약금액 대신 희망가로 표시
    const shaped = (l.data || []).map((x) => {
      if (canManage) return x;
      if (x.hope_deposit == null && x.hope_rent == null && x.hope_fee == null) return x;
      return { ...x, deposit: x.hope_deposit, monthly_rent: x.hope_rent, management_fee: x.hope_fee, hope_deposit: null, hope_rent: null, hope_fee: null, _hope: true };
    });
    setLeases(shaped.sort(leaseSort));
    setCustomFields(f.data || []);
    setEvents(e.data || []);
    setReactions(r.data || []);
    setComments(cc.data || []);
    setSubmissions(cs.data || []);
    setRoulette(rs.data || []);
    setAsRecords(ar.data || []);
    const pc = {};
    (pi.data || []).forEach((x) => { if (x.n > 0) pc[x.lease_id] = x.n; });
    setPhotoCounts(pc);
    if (profile.role === "admin") {
      const { data: la } = await fetchTableAll("lease_admin", "lease_id, staff", ["lease_id"]); // 765행·leases 따라 증가 → 1000행 상한 대비
      const m = {};
      (la || []).forEach((x) => { m[x.lease_id] = x.staff; });
      setAdminStaff(m);
    }
    setLastSync(Date.now());
    setLoading(false);
  };

  const manualRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await fetchAll(); } finally { setRefreshing(false); }
  };

  const toggleReaction = async (l, emoji) => {
    const mine = reactions.find((r) => r.lease_id === l.id && r.emoji === emoji && r.by_user === profile.user_id);
    if (mine) await sb.from("celebration_reactions").delete().eq("id", mine.id);
    else {
      await sb.from("celebration_reactions").insert({
        lease_id: l.id, emoji, by_user: profile.user_id, by_name: profile.full_name || profile.email,
      });
      // 계약자에게 푸시 (본인 계약이면 함수가 걸러냄)
      firePush(l.id, (profile.full_name || "동료") + "님이 계약을 축하했어요 " + emoji);
    }
    const { data } = await sb.from("celebration_reactions").select("*");
    setReactions(data || []);
  };

  const reloadComments = async () => {
    const { data } = await sb.from("celebration_comments").select("*").order("created_at");
    setComments(data || []);
  };
  const reloadAS = async () => {
    const { data } = await sb.from("as_records").select("*").order("seq", { ascending: false });
    setAsRecords(data || []);
  };
  const addComment = async (l, body) => {
    const text = (body || "").trim();
    if (!text) return { ok: false };
    const { error } = await sb.from("celebration_comments").insert({
      lease_id: l.id, body: text.slice(0, 500), by_user: profile.user_id, by_name: profile.full_name || profile.email,
    });
    if (error) { alert("댓글 등록 실패: " + error.message); return { ok: false }; }
    firePush(l.id, (profile.full_name || "동료") + "님의 축하 댓글: " + text.slice(0, 30));
    await reloadComments();
    return { ok: true };
  };
  const deleteComment = async (c) => {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    const { error } = await sb.from("celebration_comments").delete().eq("id", c.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    await reloadComments();
  };

  const markDone = async (l) => {
    const bld = buildings.find((x) => x.id === l.building_id);
    if (!confirm(`${(bld && bld.name) || ""} ${l.room_number}을(를) 계약완료로 표시할까요?\n축하 코너에 ${profile.full_name || ""}님 이름으로 게시됩니다.`)) return;
    const { error } = await sb.rpc("set_contract_done", { p_lease: l.id, p_done: true });
    if (error) alert("처리 실패: " + error.message);
    else fetchAll();
  };
  const cancelDone = async (l) => {
    const bld = buildings.find((x) => x.id === l.building_id);
    if (!confirm(`${(bld && bld.name) || ""} ${l.room_number}의 계약완료를 취소할까요?\n축하 코너와 실적 기록에서도 제거됩니다.`)) return;
    const { error } = await sb.rpc("set_contract_done", { p_lease: l.id, p_done: false });
    if (error) alert("처리 실패: " + error.message);
    else fetchAll();
  };
  useEffect(() => { fetchAll(); }, []);

  // 자동 새로고침: 화면 전환 시, 앱으로 돌아올 때, 1분마다
  useEffect(() => {
    if (!loading) fetchAll();
  }, [view.name, view.buildingId]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") fetchAll(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, []);

  // 이용 기록: 앱을 열 때/돌아올 때 하루 1행 upsert (30분 스로틀, 실패는 무시 — 테이블 미생성 시에도 무해)
  const lastVisitPing = useRef(0);
  useEffect(() => {
    const ping = () => {
      const now = Date.now();
      if (now - lastVisitPing.current < 30 * 60 * 1000) return;
      lastVisitPing.current = now;
      try {
        sb.from("app_visits")
          .upsert({ user_id: profile.user_id, visited_on: rouletteToday(), last_seen: new Date().toISOString() }, { onConflict: "user_id,visited_on" })
          .then(() => {}, () => {});
      } catch (e) { /* 무시 */ }
    };
    ping();
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  // 새 버전(코드) 배포 감지: 배포된 index.html의 APP_VERSION과 현재 실행 중 버전을 비교
  useEffect(() => {
    let stop = false;
    const checkVersion = async () => {
      try {
        const html = await fetch("/index.html?_=" + Date.now(), { cache: "no-store" }).then((r) => r.text());
        const m = html.match(/APP_VERSION\s*=\s*"([^"]+)"/);
        if (!stop && m && m[1] && m[1] !== APP_VERSION) setUpdateReady(true);
      } catch (e) { /* 오프라인 등은 무시 */ }
    };
    checkVersion();
    const onVis = () => { if (document.visibilityState === "visible") checkVersion(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    const t = setInterval(checkVersion, 180000); // 3분마다
    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      clearInterval(t);
    };
  }, []);
  // 업데이트 적용: PWA(아이패드 홈 화면 앱)에서 단순 리로드가 캐시/전파 지연으로 옛 버전을 다시 받는 문제 대응
  // ① 새 버전 HTML이 실제로 받아질 때까지 확인(최대 ~12초) ② HTTP 캐시 강제 갱신 ③ 캐시 우회 주소로 교체 이동
  const [updating, setUpdating] = useState(false);
  const applyUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      for (let i = 0; i < 8; i++) {
        const html = await fetch("/index.html?_=" + Date.now(), { cache: "no-store" }).then((r) => r.text());
        const m = html.match(/APP_VERSION\s*=\s*"([^"]+)"/);
        if (m && m[1] !== APP_VERSION) break; // 새 버전 확인됨
        if (i === 7) { setUpdating(false); setUpdateReady(false); return; } // 아직 같은 버전만 옴 → 배너 접고 다음 감지 때 재시도
        await new Promise((r) => setTimeout(r, 1500));
      }
      try { await fetch(location.pathname, { cache: "reload" }); } catch (e) {}
      try { await fetch("/index.html", { cache: "reload" }); } catch (e) {}
    } catch (e) { /* 네트워크 오류여도 아래에서 리로드 시도 */ }
    window.location.replace(location.pathname + "?v=" + Date.now());
  };

  const leasesByBuilding = useMemo(() => {
    const m = {};
    // 보증보험/보너스 필터가 켜지면 해당 호실만 목록·카드·건물상세에 노출 (동시 적용 가능)
    let src = leases;
    if (insFilter) src = src.filter(isInsured);
    if (bonusFilter) src = src.filter(hasBonus);
    if (eventFilter) src = src.filter(hasEvent);
    src.forEach((l) => { (m[l.building_id] = m[l.building_id] || []).push(l); });
    return m;
  }, [leases, insFilter, bonusFilter, eventFilter]);

  const q = search.trim().toLowerCase();
  // 건물별 가장 급한 만기일 (계약완료 제외)
  const buildingUrgency = useMemo(() => {
    const m = {};
    leases.forEach((l) => {
      if (l.contract_done || !l.end_date) return;
      if (!m[l.building_id] || l.end_date < m[l.building_id]) m[l.building_id] = l.end_date;
    });
    return m;
  }, [leases]);
  const buildingVacant = useMemo(() => {
    const s = {};
    leases.forEach((l) => { if (l.vacant && !l.contract_done) s[l.building_id] = true; });
    return s;
  }, [leases]);
  const buildingInsured = useMemo(() => {
    const s = {};
    leases.forEach((l) => { if (isInsured(l)) s[l.building_id] = true; });
    return s;
  }, [leases]);
  const buildingBonus = useMemo(() => {
    const s = {};
    leases.forEach((l) => { if (hasBonus(l)) s[l.building_id] = true; });
    return s;
  }, [leases]);
  const buildingEvent = useMemo(() => {
    const s = {};
    leases.forEach((l) => { if (hasEvent(l)) s[l.building_id] = true; });
    return s;
  }, [leases]);
  // 룰렛 매물에 연결된 events 행 — 이벤트 탭에서 일반 카드로 중복 노출되지 않게 분리 (룰렛 전용 카드가 대표)
  const rouletteEventIds = useMemo(() => {
    const s = new Set();
    roulette.forEach((r) => {
      if (!r.lease_id) return;
      const l = leases.find((x) => x.id === r.lease_id);
      if (l && l.event_id) s.add(l.event_id);
    });
    return s;
  }, [roulette, leases]);
  const otherEvents = useMemo(() => events.filter((e) => !rouletteEventIds.has(e.id)), [events, rouletteEventIds]);
  // 건물에 실제 달린 태그 목록 (태그별 건물 수) — 홈 필터 칩 생성용
  const buildingTagCounts = useMemo(() => {
    const m = {};
    buildings.forEach((b) => (Array.isArray(b.options) ? b.options : []).forEach((t) => { const k = String(t).trim(); if (k) m[k] = (m[k] || 0) + 1; }));
    return m;
  }, [buildings]);
  const buildingTagList = useMemo(() => Object.keys(buildingTagCounts).sort((a, b) => a.localeCompare(b, "ko")), [buildingTagCounts]);
  // 선택된 건물태그가 더 이상 존재하지 않으면(태그 삭제·데이터 변경) 필터 자동 해제 — 칩 없이 "결과 없음"에 갇히는 것 방지
  useEffect(() => {
    if (buildingTag && !buildingTagList.includes(buildingTag)) setBuildingTag(null);
  }, [buildingTag, buildingTagList]);
  const filteredBuildings = useMemo(() => {
    let list = buildings;
    if (region !== "all") {
      list = list.filter((b) => regionOf(b) === region);
      if (subArea !== "전체" && (REGION_SUBS[region] || []).includes(subArea)) {
        list = list.filter((b) => subAreaOf(b) === subArea);
      }
    }
    if (insFilter) list = list.filter((b) => buildingInsured[b.id]);
    if (bonusFilter) list = list.filter((b) => buildingBonus[b.id]);
    if (eventFilter) list = list.filter((b) => buildingEvent[b.id]);
    if (buildingTag && buildingTagList.includes(buildingTag)) list = list.filter((b) => Array.isArray(b.options) && b.options.includes(buildingTag));
    if (q) {
      list = list.filter((b) => {
        if (b.name.toLowerCase().includes(q)) return true;
        return (leasesByBuilding[b.id] || []).some((l) =>
          (l.room_number || "").toLowerCase().includes(q) ||
          (canEdit && (l.tenant_name || "").toLowerCase().includes(q))
        );
      });
    }
    // 정렬: 관리중단 맨 뒤 → 공실 있는 건물 최상단 → 만기 임박순 → 이름순
    return [...list].sort((a, b) => {
      const ia = a.active === false, ib = b.active === false;
      if (ia !== ib) return ia ? 1 : -1;
      const va = !!buildingVacant[a.id], vb = !!buildingVacant[b.id];
      if (va !== vb) return va ? -1 : 1;
      const ua = buildingUrgency[a.id], ub = buildingUrgency[b.id];
      if (ua && ub && ua !== ub) return ua < ub ? -1 : 1;
      if (!!ua !== !!ub) return ua ? -1 : 1;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [q, region, subArea, insFilter, bonusFilter, eventFilter, buildingTag, buildingTagList, buildings, leasesByBuilding, canEdit, buildingUrgency, buildingVacant, buildingInsured, buildingBonus, buildingEvent]);

  const urgentCount = useMemo(() => leases.filter((l) => { const d = dday(l.end_date); return d !== null && d <= 30; }).length, [leases]);
  const dupCount = useMemo(() => {
    const { exactGroups, suspectGroups } = findDupGroups(leases);
    return exactGroups.length + suspectGroups.length;
  }, [leases]);
  const celebrations = useMemo(() => {
    const cutoff = Date.now() - 60 * 86400000; // 60일 지난 축하는 자동 내림
    return leases
      .filter((l) => l.contract_done && l.contract_done_at && new Date(l.contract_done_at).getTime() >= cutoff)
      .sort((a, b) => String(b.contract_done_at).localeCompare(String(a.contract_done_at)))
      .slice(0, 3); // 최근 3건만 게시
  }, [leases]);

  // 인앱 축하 알림: 내 계약(contract_done_by=내 이름)에 달린 남의 반응/댓글 중 새 것을 토스트로 표시
  useEffect(() => {
    const key = "bodam_notif_since_" + profile.user_id;
    if (notifBaseline.current === null) {
      let stored = null;
      try { stored = localStorage.getItem(key); } catch (e) {}
      notifBaseline.current = stored || new Date().toISOString();
      if (!stored) { try { localStorage.setItem(key, notifBaseline.current); } catch (e) {} return; } // 첫 방문은 과거분 미표시
    }
    const myName = profile.full_name || profile.email;
    const myLeaseIds = new Set(leases.filter((l) => l.contract_done && l.contract_done_by === myName).map((l) => l.id));
    if (myLeaseIds.size === 0) return;
    const roomOf = (lid) => {
      const l = leases.find((x) => x.id === lid); if (!l) return "";
      const b = buildings.find((x) => x.id === l.building_id);
      return ((b && b.name) || "") + " " + (l.room_number || "");
    };
    const base = notifBaseline.current;
    const items = [];
    reactions.forEach((r) => {
      if (myLeaseIds.has(r.lease_id) && r.by_user !== profile.user_id && r.created_at && String(r.created_at) > base)
        items.push({ at: String(r.created_at), text: (r.by_name || "동료") + "님이 " + roomOf(r.lease_id) + " 계약을 축하했어요 " + (r.emoji || "🎉") });
    });
    comments.forEach((c) => {
      if (myLeaseIds.has(c.lease_id) && c.by_user !== profile.user_id && c.created_at && String(c.created_at) > base)
        items.push({ at: String(c.created_at), text: (c.by_name || "동료") + '님의 축하 댓글: "' + String(c.body).slice(0, 30) + '"' });
    });
    if (items.length === 0) return;
    items.sort((a, b) => a.at.localeCompare(b.at));
    const latest = items[items.length - 1].at;
    notifBaseline.current = latest;
    try { localStorage.setItem(key, latest); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([80, 40, 80]); } catch (e) {}
    const shown = items.length <= 3 ? items : [...items.slice(0, 2), { at: latest, text: "그 외 " + (items.length - 2) + "명이 더 축하했어요 🎊" }];
    const baseId = Date.now();
    shown.forEach((it, i) => {
      const id = baseId + i;
      setNotifToasts((t) => [...t, { id, text: it.text }]);
      setTimeout(() => setNotifToasts((t) => t.filter((x) => x.id !== id)), 8000);
    });
  }, [reactions, comments, leases, buildings]);

  /* 알림 권유 배너는 회원당 딱 1번만.
     본 시점을 user_roles.push_promo_at에 기록해 두 번 다시 안 뜨게 한다(기기를 바꿔도 동일).
     "나중에"를 눌렀든 그냥 무시했든 상관없이, 화면에 띄우는 순간 기록한다. */
  const markPushPromoSeen = async () => {
    try { await sb.from("user_roles").update({ push_promo_at: new Date().toISOString() }).eq("user_id", profile.user_id); } catch (e) {}
  };

  // 푸시 알림: SW 등록 + 구독 상태 확인. 이미 허용됐으면 조용히 재구독, 안 켠 회원에겐 권유 배너 1회
  useEffect(() => {
    const promoSeen = !!profile.push_promo_at; // 배너만 1회 제한. 구독 확인·자가복구는 매번 그대로 돈다
    if (!pushSupported()) {
      // 아이폰·아이패드를 사파리 "탭"으로 쓰는 회원은 푸시 API 자체가 없다(홈 화면에 추가해야 생김).
      // 그냥 넘기면 이 회원들은 알림 기능이 있는지도 모르므로, 홈 화면 추가 안내를 1번 띄운다.
      if (!promoSeen && isIOS() && !isStandalone()) { setPromoIOS(true); setPushPrompt(true); markPushPromoSeen(); }
      return;
    }
    getSWRegistration();
    (async () => {
      const subbed = await isPushSubscribed();
      setPushOn(subbed);
      if (subbed) { await ensurePushRow(profile); return; } // 계정 전환 기기 자가복구 (배너와 무관하게 항상)
      if (Notification.permission === "granted") {
        try { await subscribePush(profile); setPushOn(true); return; } catch (e) {}
      }
      if (promoSeen) return;
      if (Notification.permission === "denied") return; // 브라우저에서 차단해 둔 사람에겐 권유해도 소용없음
      if (isIOS() && !isStandalone()) setPromoIOS(true);  // standalone이 아니면 켜기 버튼 대신 안내 문구로
      setPushPrompt(true);
      markPushPromoSeen();
    })();
  }, []);
  const togglePush = async () => {
    if (pushBusy) return;
    if (!pushSupported()) { alert("이 브라우저는 알림을 지원하지 않아요."); return; }
    if (isIOS() && !isStandalone()) {
      alert("아이폰·아이패드에서는 먼저 이 앱을 홈 화면에 추가해야 알림을 받을 수 있어요.\n\n공유 버튼(￢) → '홈 화면에 추가' → 홈 화면의 보담 아이콘으로 열어서 다시 켜주세요.");
      return;
    }
    setPushBusy(true);
    try {
      if (pushOn) { await unsubscribePush(profile); setPushOn(false); }
      else { await subscribePush(profile); setPushOn(true); alert("알림을 켰어요! 누가 내 계약을 축하하면 잠금화면으로 알려드릴게요 🎉"); }
    } catch (e) { alert("알림 설정 실패: " + (e.message || e)); }
    finally { setPushBusy(false); }
  };

  const openLease = (l) => setModal(canEdit ? { type: "lease", lease: l } : { type: "detail", lease: l });

  const exportExcel = () => {
    const rows = leases.map((l) => {
      const b = buildings.find((x) => x.id === l.building_id) || {};
      return {
        "ID(수정금지)": l.id,
        "건물명(주소)": b.name || "",
        "호수": l.room_number || "",
        "임차인명": l.tenant_name || "",
        "연락처": l.tenant_phone || "",
        "입주날짜": l.start_date || "",
        "만기일": l.end_date || "",
        "보증금(만원)": l.deposit ?? "",
        "월세(만원)": l.monthly_rent ?? "",
        "관리비(만원)": l.management_fee ?? "",
        "보증보험": l.insurance === true ? "가입" : l.insurance_pending === true ? "가입중" : "",
        "메모": l.memo || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "임대현황");
    const d = new Date(), pad = (n) => String(n).padStart(2, "0");
    XLSX.writeFile(wb, `보담임대현황_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.xlsx`);
  };

  if (loading) return <div className="screen-h flex items-center justify-center text-slate-400">불러오는 중...</div>;

  // 관리인+ 로그인 직후 모드 선택 화면 (임대 홈 / 관리모드)
  if (canManage && mgrMode === null) {
    const pendCnt = submissions.filter((s) => s.status === "pending").length;
    return (
      <div className="screen-h flex items-center justify-center px-4 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <img src="/icon-192.png" alt="보담" className="w-14 h-14 rounded-2xl mx-auto mb-3 shadow" />
            <h2 className="text-xl font-bold text-slate-800">어떤 모드로 시작할까요?</h2>
            <p className="text-sm text-slate-400 mt-1 break-keep">{profile.full_name || profile.email}님 · 상단 메뉴에서 언제든 전환할 수 있어요</p>
          </div>
          <button onClick={() => { setMgrMode("normal"); setView({ name: "home" }); }}
            className="w-full bg-white border-2 border-slate-200 hover:border-blue-400 active:bg-blue-50 rounded-2xl p-5 mb-3 text-left flex items-center gap-4 shadow-sm">
            <span className="text-4xl shrink-0">🏠</span>
            <span className="min-w-0">
              <span className="block font-bold text-slate-800 text-lg">임대 홈</span>
              <span className="block text-sm text-slate-500 break-keep">모든 회원과 동일한 매물 화면으로 시작</span>
            </span>
          </button>
          <button onClick={() => { setMgrMode("manage"); setView({ name: "manage" }); }}
            className="w-full bg-white border-2 border-emerald-300 hover:border-emerald-500 active:bg-emerald-50 rounded-2xl p-5 text-left flex items-center gap-4 shadow-sm">
            <span className="text-4xl shrink-0">🛠️</span>
            <span className="min-w-0">
              <span className="block font-bold text-slate-800 text-lg">관리모드
                <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-2 py-0.5 align-middle font-semibold">관리인 전용</span>
                {pendCnt > 0 && <span className="ml-1.5 text-[10px] bg-red-500 text-white rounded-full px-2 py-0.5 align-middle font-bold">계약승인 대기 {pendCnt}</span>}
              </span>
              <span className="block text-sm text-slate-500 break-keep">계약관리 · 임대매물 정보 수정 바로가기</span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  const currentBuilding = view.name === "building" ? buildings.find((b) => b.id === view.buildingId) : null;

  return (
    <div className="min-h-screen pb-10">
      {/* 인앱 축하 알림 토스트 */}
      {notifToasts.length > 0 && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-sm space-y-2 pointer-events-none">
          {notifToasts.map((t) => (
            <div key={t.id} onClick={() => { setView({ name: "home" }); setSearch(""); setNotifToasts((x) => x.filter((y) => y.id !== t.id)); }}
              className="pointer-events-auto cursor-pointer bg-white border-2 border-amber-300 shadow-xl rounded-2xl px-4 py-3 flex items-start gap-2 animate-pulse-once">
              <span className="text-xl shrink-0">🎉</span>
              <span className="text-sm font-medium text-slate-700 break-keep flex-1">{t.text}</span>
              <button onClick={(e) => { e.stopPropagation(); setNotifToasts((x) => x.filter((y) => y.id !== t.id)); }}
                className="text-slate-300 hover:text-slate-500 text-lg leading-none shrink-0">×</button>
            </div>
          ))}
        </div>
      )}
      {/* 새 버전 업데이트 배너 */}
      {updateReady && (
        <div className="bg-blue-600 text-white text-sm px-4 py-2.5 flex items-center justify-center gap-3 flex-wrap">
          <span className="font-medium">{updating ? "⏳ 새 버전을 받아 적용하는 중이에요..." : "✨ 새 버전이 나왔어요. 업데이트하면 최신 기능이 적용됩니다."}</span>
          <button className="bg-white text-blue-700 font-bold rounded-lg px-3 py-1 active:bg-blue-50 disabled:opacity-60" onClick={applyUpdate} disabled={updating}>{updating ? "적용 중..." : "지금 업데이트"}</button>
        </div>
      )}
      {/* 축하 알림 권유 배너 (앱 꺼져 있어도 잠금화면 알림) — 회원당 딱 1번만 노출 */}
      {/* 삼성 인터넷 + 기기가 다크모드일 때만. 낮에 라이트로 잘 쓰는 사람은 볼 일이 없다 */}
      {isSamsungBrowser() && prefersDark() && !hideSamsung && (
        <div className="bg-slate-700 text-white text-xs px-4 py-2 flex items-center justify-center gap-2 flex-wrap">
          <span className="break-keep">화면이 어둡게 보이나요?</span>
          <a href={chromeIntentUrl()} className="bg-white text-slate-800 font-bold rounded px-2 py-0.5">크롬으로 열기</a>
          <button className="text-white/70 underline" onClick={dismissSamsung}>다시 안 보기</button>
        </div>
      )}
      {pushPrompt && !pushOn && (
        <div className="bg-amber-500 text-white text-sm px-4 py-2.5 flex items-center justify-center gap-3 flex-wrap">
          {promoIOS ? (
            <>
              <span className="font-medium break-keep">🔔 내 계약을 축하받으면 알림으로 알려드려요 — 아이폰·아이패드는 공유 버튼 → '홈 화면에 추가' 후 그 아이콘으로 열면 켤 수 있어요</span>
              <button className="bg-white text-amber-700 font-bold rounded-lg px-3 py-1 active:bg-amber-50" onClick={() => setPushPrompt(false)}>알겠어요</button>
            </>
          ) : (
            <>
              <span className="font-medium break-keep">🔔 내 계약을 축하받으면 알림으로 알려드릴까요?</span>
              <button className="bg-white text-amber-700 font-bold rounded-lg px-3 py-1 active:bg-amber-50 disabled:opacity-60" disabled={pushBusy}
                onClick={async () => { setPushPrompt(false); await togglePush(); }}>{pushBusy ? "설정 중..." : "네, 받을게요"}</button>
              <button className="text-white/90 underline text-xs" onClick={() => setPushPrompt(false)}>나중에</button>
            </>
          )}
        </div>
      )}
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2">
          <button className="flex items-center gap-2 font-bold text-slate-800 text-lg shrink-0" onClick={() => { setView({ name: "home" }); setSearch(""); }} title="홈으로">
            <img src="/icon-192.png" alt="보담 홈" className="w-8 h-8 rounded-lg shrink-0" />
            <span className="hidden xs:inline sm:inline">보담 임대관리</span>
          </button>
          <div className="flex-1" />
          {/* 좁은 화면에서 버튼이 눌려 글자가 세로로 쪼개지던 문제 → 줄바꿈 금지 + 넘치면 가로 스크롤 */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin min-w-0">
          <a href="https://www.ggulbang.com" target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold px-3 py-1.5 rounded-lg text-amber-700 hover:bg-amber-50 inline-flex items-center gap-1 shrink-0" title="꿀방 홈으로 이동">
            🍯 <span className="hidden xs:inline sm:inline">꿀방</span> <span className="text-[10px] text-amber-400">↗</span>
          </a>
          {canManage && (
            <button className={"text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0 whitespace-nowrap " + (view.name === "manage" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50")}
              onClick={() => setView({ name: "manage" })}>🛠️ <span className="hidden sm:inline">관리모드</span></button>
          )}
          {canEdit && (
            <button className={"text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0 whitespace-nowrap " + (view.name === "all" ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50")}
              onClick={() => setView({ name: "all" })}>전체보기</button>
          )}
          {/* 건물별 정리는 900px 미만에서 "PC에서 사용하세요" 안내만 뜨는 화면이라
              폰에서는 버튼을 숨긴다(자리를 차지해 자료실이 화면 밖으로 밀려났었다) */}
          {canManage && (
            <button className={"text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0 whitespace-nowrap hidden min-[900px]:inline-block " + (view.name === "organize" ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50")}
              onClick={() => setView({ name: "organize" })}>건물별 정리</button>
          )}
          {canManage && (
            <button className={"text-sm font-semibold px-3 py-1.5 rounded-lg shrink-0 whitespace-nowrap " + (view.name === "archive" ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50")}
              onClick={() => setView({ name: "archive" })}>자료실</button>
          )}
          </div>
          {/* 새로고침 */}
          <button onClick={manualRefresh} title="새로고침" aria-label="새로고침"
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className={"w-5 h-5 " + (refreshing ? "animate-spin" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {/* 메뉴 */}
          <div className="relative">
            <button className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 shrink-0" onClick={() => setMenuOpen((v) => !v)} aria-label="메뉴">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* 바깥 아무 곳이나 누르면 닫히도록 투명 백드롭 (터치 기기에선 onMouseLeave가 안 걸린다) */}
            {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
            {menuOpen && (
              <div className="absolute right-0 top-11 bg-white border rounded-xl shadow-lg w-56 py-1 z-50" onMouseLeave={() => setMenuOpen(false)}>
                <div className="px-4 py-2 border-b">
                  <p className="font-semibold text-slate-800 text-sm truncate">{profile.full_name}</p>
                  <RoleBadge role={profile.role} />
                  {lastSync && <p className="text-[11px] text-slate-400 mt-1">마지막 업데이트 {new Date(lastSync).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>}
                  {/* 버전 표시 — "새 버전이 실제로 적용됐는지" 눈으로 확인할 수단이 없어 추가 */}
                  <p className="text-[11px] text-slate-300 mt-0.5">버전 {APP_VERSION}</p>
                </div>
                <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); manualRefresh(); }}>🔄 새로고침</button>
                {isSamsungBrowser() && (
                  <a href={chromeIntentUrl()} className="block px-4 py-2.5 text-sm hover:bg-slate-50" onClick={() => setMenuOpen(false)}>🌐 크롬으로 열기</a>
                )}
                {pushSupported() && (
                  <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between" onClick={togglePush} disabled={pushBusy}>
                    <span>{pushOn ? "🔔 축하 알림 켜짐" : "🔕 축하 알림 켜기"}</span>
                    <span className={"text-[11px] font-bold rounded-full px-2 py-0.5 " + (pushOn ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{pushBusy ? "..." : pushOn ? "ON" : "OFF"}</span>
                  </button>
                )}
                {(isAdmin || canApprove) && (
                  <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); setModal({ type: "admin" }); }}>{isAdmin ? "관리자 패널" : "가입 승인"}</button>
                )}
                <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50" onClick={() => { setMenuOpen(false); setModal({ type: "profile" }); }}>내 프로필 · 내가 한 계약</button>
                <button className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50" onClick={() => sb.auth.signOut()}>로그아웃</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-4">
        {/* 관리모드 대시보드 (관리인+) */}
        {view.name === "manage" && canManage && (() => {
          const pendCnt = submissions.filter((s) => s.status === "pending").length;
          const Card = ({ emoji, title, desc, badge, onClick, tone }) => (
            <button onClick={onClick}
              className={"bg-white border-2 rounded-2xl p-5 text-left flex items-center gap-4 shadow-sm active:scale-[0.99] " +
                (tone === "green" ? "border-emerald-200 hover:border-emerald-500" : "border-slate-200 hover:border-blue-400")}>
              <span className="text-4xl shrink-0">{emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-800 text-lg break-keep">{title}
                  {badge > 0 && <span className="ml-1.5 text-[10px] bg-red-500 text-white rounded-full px-2 py-0.5 align-middle font-bold">{badge}</span>}
                </span>
                <span className="block text-sm text-slate-500 break-keep">{desc}</span>
              </span>
              <span className="text-slate-300 text-xl shrink-0">›</span>
            </button>
          );
          return (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <h2 className="font-bold text-xl text-slate-800">🛠️ 관리모드</h2>
                <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-2 py-0.5 font-semibold">관리인 전용</span>
                <div className="flex-1" />
                <button className={btnGhost} onClick={() => setView({ name: "home" })}>🏠 임대 홈으로</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card emoji="📋" title="계약관리" tone="green" badge={pendCnt}
                  desc="계약서 확인·승인 처리" onClick={() => setModal({ type: "subs" })} />
                <Card emoji="✏️" title="임대매물 정보 수정" tone="green"
                  desc="건물별 정리 표에서 바로 입력·수정 (PC)" onClick={() => setView({ name: "organize" })} />
                <Card emoji="💰" title="미납 관리" tone="green"
                  desc="월세·관리비 미납 확인 · 연락 · 추심 기록" onClick={() => setView({ name: "arrears" })} />
                {isAdmin && <Card emoji="📒" title="장부 · 세무"
                  desc="통장·카드 내역 → 자동 분류 → 종합소득세 자료" onClick={() => setView({ name: "ledger" })} />}
                <Card emoji="📚" title="자료실"
                  desc="건물정보 · 문의이력 · AS·도배" onClick={() => setView({ name: "archive" })} />
                <Card emoji="👥" title={isAdmin ? "관리자 패널" : "가입 승인"}
                  desc={isAdmin ? "회원 관리 · 이용현황 · 매물 조회수" : "가입 대기 회원 승인"} onClick={() => setModal({ type: "admin" })} />
              </div>
            </div>
          );
        })()}
        {/* 홈 */}
        {view.name === "home" && (
          <div>
            {celebrations.length > 0 && (
              <div className="mb-3 bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 rounded-2xl p-4">
                <h3 className="font-bold text-amber-800 mb-1.5">🎉 축하합니다!</h3>
                <div className="space-y-1">
                  {celebrations.map((l) => (
                    <CelebrationItem key={l.id} lease={l} building={buildings.find((x) => x.id === l.building_id)}
                      profile={profile} reactions={reactions} comments={comments}
                      onToggleReaction={toggleReaction} onAddComment={addComment} onDeleteComment={deleteComment} />
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setView({ name: "events" })}
              className="w-full mb-4 bg-white border rounded-2xl px-4 py-3 flex items-center justify-between hover:shadow-md active:bg-slate-50 transition">
              <span className="font-bold text-slate-700">🎁 이벤트</span>
              <span className="text-sm text-slate-400">보러가기 →</span>
            </button>
            {/* 지역 탭 */}
            <div className="mb-3">
              <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
                {REGION_TABS.map(([id, label]) => (
                  <button key={id} onClick={() => { setRegion(id); setSubArea("전체"); }}
                    className={"px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap " + (region === id ? "bg-blue-600 text-white" : "bg-white border text-slate-600 hover:bg-slate-50")}>
                    {label}
                  </button>
                ))}
              </div>
              {(REGION_SUBS[region] || []).length > 0 && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-thin pb-1">
                  {REGION_SUBS[region].map((s) => (
                    <button key={s} onClick={() => setSubArea(s)}
                      className={"px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border " + (subArea === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 hover:bg-slate-50")}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2 flex-wrap">
                <button onClick={() => setInsFilter((v) => !v)}
                  className={"px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border inline-flex items-center gap-1 " + (insFilter ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50")}>
                  ✓ 보증보험만{insFilter && <span className="text-[10px] bg-white/25 rounded px-1">ON</span>}
                </button>
                <button onClick={() => setBonusFilter((v) => !v)}
                  className={"px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border inline-flex items-center gap-1 " + (bonusFilter ? "bg-amber-500 text-white border-amber-500" : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50")}>
                  💰 보너스만{bonusFilter && <span className="text-[10px] bg-white/25 rounded px-1">ON</span>}
                </button>
                <button onClick={() => setEventFilter((v) => !v)}
                  className={"px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border inline-flex items-center gap-1 " + (eventFilter ? "bg-rose-500 text-white border-rose-500" : "bg-white text-rose-600 border-rose-300 hover:bg-rose-50")}>
                  🎡 이벤트만{eventFilter && <span className="text-[10px] bg-white/25 rounded px-1">ON</span>}
                </button>
              </div>
              {buildingTagList.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap items-center">
                  <span className="text-[11px] font-bold text-slate-400">🏢 건물태그</span>
                  {buildingTagList.map((t) => (
                    <button key={t} onClick={() => setBuildingTag((v) => v === t ? null : t)}
                      className={"px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border inline-flex items-center gap-1 " + (buildingTag === t ? "bg-teal-600 text-white border-teal-600" : "bg-white text-teal-700 border-teal-300 hover:bg-teal-50")}>
                      {t}<span className={buildingTag === t ? "text-teal-200" : "text-slate-400"}>{buildingTagCounts[t]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
              <input className={inputCls + " sm:max-w-xs"} placeholder={canEdit ? "건물명 · 호수 · 임차인 검색" : "건물명 · 호수 검색"}
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex items-center gap-2 text-sm text-slate-500 flex-wrap">
                <span>건물 {buildings.length}개 · 임대 {leases.length}건</span>
                {!canEdit && <span className="text-xs text-slate-400">(만기 3개월 이내 매물만 표시)</span>}
                {urgentCount > 0 && <span className="bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full text-xs">30일 내 만기 {urgentCount}건</span>}
              </div>
              <div className="flex-1" />
              {canEdit && (
                <div className="flex gap-2 flex-wrap">
                  {canManage && (
                    <button className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-lg px-4 py-2 text-sm" onClick={() => setModal({ type: "subs" })}>
                      계약승인{submissions.filter((s) => s.status === "pending").length > 0 && <span className="ml-1.5 bg-white/25 text-white text-xs rounded-full px-1.5 py-0.5">{submissions.filter((s) => s.status === "pending").length}</span>}
                    </button>
                  )}
                  <button className={btnGhost + (dupCount > 0 ? " !border-amber-400 !text-amber-700" : "")} onClick={() => setModal({ type: "dups" })}>
                    중복 검사{dupCount > 0 && <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{dupCount}</span>}
                  </button>
                  <button className={btnGhost} onClick={exportExcel} disabled={leases.length === 0}>엑셀 다운로드</button>
                  <button className={btnGhost} onClick={() => setModal({ type: "building", building: {} })}>+ 건물</button>
                  <button className={btnGhost + " disabled:opacity-50"} onClick={() => setModal({ type: "lease", lease: {} })} disabled={buildings.length === 0}>+ 임대정보 등록</button>
                </div>
              )}
            </div>

            {filteredBuildings.length === 0 && (
              <p className="text-center text-slate-400 py-16">{buildings.length === 0 ? "등록된 건물이 없습니다. 엑셀 업로드 또는 + 건물 버튼으로 시작하세요." : "검색 결과가 없습니다."}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredBuildings.map((b) => {
                const bl = (leasesByBuilding[b.id] || []);
                const top3 = bl.slice(0, 2);
                return (
                  <div key={b.id} className={"rounded-2xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition " + (b.active === false ? "bg-slate-50 opacity-70" : "bg-white active:bg-slate-50")}
                       onClick={() => setView({ name: "building", buildingId: b.id })}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-slate-800 break-keep leading-snug">
                          {b.name}
                          {b.active === false && <span className="ml-1.5 align-middle text-[10px] bg-red-100 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-semibold">관리중단</span>}
                        </h3>
                        {b.address && <p className="text-xs text-slate-400 break-keep">{b.address}</p>}
                        {b.options && b.options.length > 0 && <div className="mt-1"><TagChips items={b.options} tone="building" /></div>}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0 ml-2 mt-0.5">{bl.length}건</span>
                    </div>
                    {top3.length === 0 && <p className="text-sm text-slate-400">임대 정보 없음</p>}
                    <div className="space-y-1.5">
                      {top3.map((l) => {
                        const d = ddayInfo(l.end_date);
                        return (
                          <div key={l.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 truncate">
                              {l.move_out && <MoveOutTag />}
                              {l.vacant && <VacantTag />}
                              {l.event_id && <EventTag />}
                              <b className="text-slate-800">{l.room_number}</b>
                              {(photoCounts[l.id] || 0) > 0 && <PhotoMark n={photoCounts[l.id]} />}
                              {l.contract_done && <span className="ml-1">🎉</span>}
                              {canEdit && l.tenant_name && <span className="ml-1.5">{l.tenant_name}</span>}
                              <span className="ml-1.5 text-slate-400">{fmtDate(l.end_date)}</span>
                            </span>
                            <span className={"text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 " + d.cls}>{d.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 이벤트 */}
        {view.name === "events" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <button className="text-slate-400 hover:text-slate-700 text-xl px-1" onClick={() => setView({ name: "home" })}>←</button>
              <h2 className="font-bold text-xl text-slate-800">🎁 이벤트</h2>
              <span className="text-sm text-slate-400">{otherEvents.length + (roulette.length > 0 ? 1 : 0)}개</span>
              <div className="flex-1" />
              {canEdit && <button className={btnPrimary} onClick={() => setModal({ type: "event", event: {} })}>+ 새 이벤트</button>}
            </div>
            <div className="mb-3">
              <RouletteEventCard slots={roulette} leases={leases} me={profile} onChanged={fetchAll} onOpenLease={(l) => setModal({ type: "detail", lease: l })}
                eventId={rouletteEventIds.size > 0 ? [...rouletteEventIds][0] : null} />
            </div>
            {otherEvents.length === 0 && roulette.length === 0 ? (
              <div className="bg-white rounded-2xl border p-10 text-center">
                <div className="text-4xl mb-3">🎈</div>
                <p className="text-slate-500 font-medium">진행 중인 이벤트가 없습니다.</p>
                <p className="text-sm text-slate-400 mt-1">{canEdit ? "+ 새 이벤트 버튼으로 이벤트를 개설해보세요." : "새 이벤트가 열리면 이곳에 게시됩니다."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {otherEvents.map((ev) => {
                  const evLeases = leases.filter((l) => l.event_id === ev.id);
                  return (
                    <div key={ev.id} className="bg-white rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-800 break-keep">🎁 {ev.title}</h3>
                          {ev.description && <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap break-keep">{ev.description}</p>}
                        </div>
                        {canEdit && <button className={btnGhost + " !py-1.5 shrink-0"} onClick={() => setModal({ type: "event", event: ev })}>수정</button>}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        대상 매물 {evLeases.length}건 · {String(ev.created_at).slice(0, 10)}{ev.created_by ? " · " + ev.created_by : ""}
                      </p>
                      {evLeases.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {evLeases.map((l) => {
                            const b = buildings.find((x) => x.id === l.building_id);
                            return l.contract_done ? (
                              <button key={l.id} onClick={() => setModal({ type: "detail", lease: l })}
                                className="text-xs bg-slate-50 border border-emerald-200 text-slate-400 rounded-full px-2.5 py-1 font-medium">
                                <span className="line-through">{(b && b.name) || ""} {l.room_number}</span>
                                <span className="ml-1 text-emerald-600 font-bold no-underline">🎉 성공</span>
                              </button>
                            ) : (
                              <button key={l.id} onClick={() => setModal({ type: "detail", lease: l })}
                                className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-full px-2.5 py-1 font-medium hover:bg-rose-100 active:bg-rose-100">
                                {(b && b.name) || ""} {l.room_number} ›
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 건물 상세 */}
        {view.name === "building" && currentBuilding && (
          <div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button className="text-slate-400 hover:text-slate-700 text-xl px-1" onClick={() => setView({ name: "home" })}>←</button>
              <h2 className="font-bold text-xl text-slate-800 break-keep">{currentBuilding.name}</h2>
              {currentBuilding.active === false && <span className="text-xs bg-red-100 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-semibold">관리중단</span>}
              {currentBuilding.address && <span className="text-sm text-slate-400 break-keep">{currentBuilding.address}</span>}
              {currentBuilding.entrance_code && <span className="text-sm font-semibold text-slate-600 bg-slate-100 border rounded-lg px-2 py-0.5">🔑 공동현관 {currentBuilding.entrance_code}</span>}
              {currentBuilding.manager_phone && (
                <a href={telHref(currentBuilding.manager_phone)} className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5 active:bg-blue-100">
                  📞 <span className="text-[10px] bg-white/70 border border-blue-200 rounded px-1">관</span> {currentBuilding.manager_phone}
                </a>
              )}
              {currentBuilding.options && currentBuilding.options.length > 0 && <TagChips items={currentBuilding.options} tone="building" />}
              <span className="text-sm text-slate-400">{(leasesByBuilding[currentBuilding.id] || []).length}건</span>
              <div className="flex-1" />
              {canEdit && (
                <div className="flex gap-2">
                  {isAdmin && <button className={btnGhost} onClick={() => setModal({ type: "building", building: currentBuilding })}>건물 수정</button>}
                  <button className={btnGhost} onClick={() => setModal({ type: "lease", lease: { building_id: currentBuilding.id } })}>+ 임대정보 등록</button>
                </div>
              )}
            </div>
            {currentBuilding.memo && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 break-keep">📌 {currentBuilding.memo}</p>
            )}
            <LeaseList leases={leasesByBuilding[currentBuilding.id] || []} buildings={buildings} canEdit={canEdit} me={profile} showBuilding={false} photos={photoCounts} onRowClick={openLease} onMarkDone={markDone} onCancelDone={cancelDone} />
          </div>
        )}

        {/* 전체보기 */}
        {view.name === "all" && canEdit && (
          <div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button className="text-slate-400 hover:text-slate-700 text-xl px-1" onClick={() => setView({ name: "home" })}>←</button>
              <h2 className="font-bold text-xl text-slate-800">전체 임대 목록</h2>
              <span className="text-sm text-slate-400">만기일 순 · {leases.length}건</span>
              <div className="flex-1" />
              <input className={inputCls + " sm:max-w-xs"} placeholder="검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <LeaseList
              leases={leases.filter((l) => {
                if (!q) return true;
                const b = buildings.find((x) => x.id === l.building_id);
                return (b && b.name.toLowerCase().includes(q)) ||
                  (l.room_number || "").toLowerCase().includes(q) ||
                  (l.tenant_name || "").toLowerCase().includes(q);
              })}
              buildings={buildings} canEdit={canEdit} me={profile} showBuilding={true} photos={photoCounts} onRowClick={openLease} onMarkDone={markDone} onCancelDone={cancelDone} />
          </div>
        )}

        {/* 자료실 (관리인 전용) */}
        {view.name === "arrears" && canManage && (
          <ArrearsView leases={leases} buildings={buildings} me={profile} onBack={() => setView({ name: "manage" })} />
        )}
        {/* 장부 · 세무 (관리자 전용 — 사업자 본인의 돈 흐름) */}
        {view.name === "ledger" && isAdmin && (
          <LedgerView leases={leases} buildings={buildings} onBack={() => setView({ name: "manage" })} />
        )}
        {view.name === "archive" && canManage && (
          <ArchiveView onBack={() => setView({ name: "home" })} />
        )}

        {/* 건물별 정리 (PC 편집, 관리·매니저) */}
        {view.name === "organize" && canManage && (
          <OrganizeView buildings={buildings} leases={leases} onBack={() => setView({ name: "home" })} onSaved={fetchAll} />
        )}
      </main>

      {/* 모달들 */}
      {modal && modal.type === "lease" && (
        <LeaseModal lease={modal.lease} buildings={buildings} customFields={customFields} me={profile} asRecords={asRecords} onReloadAS={reloadAS} onClose={() => setModal(null)} onSaved={fetchAll}
          onUpload={(l) => setModal({ type: "upload", lease: l })} />
      )}
      {modal && modal.type === "building" && (
        <BuildingModal building={modal.building} onClose={() => { setModal(null); if (modal.building.id) setView({ name: "home" }); }} onSaved={fetchAll} />
      )}
      {modal && modal.type === "detail" && (
        <LeaseDetailModal lease={modal.lease} buildings={buildings} events={events} customFields={customFields} canEdit={canEdit} me={profile} staff={adminStaff[modal.lease.id]}
          asRecords={asRecords} onReloadAS={reloadAS}
          onClose={() => setModal(null)} onMarkDone={markDone} onCancelDone={cancelDone}
          onEdit={(l) => setModal({ type: "lease", lease: l })}
          onUpload={(l) => setModal({ type: "upload", lease: l })} />
      )}
      {modal && modal.type === "upload" && (
        <ContractUploadModal lease={modal.lease} buildings={buildings} me={profile} onClose={() => setModal(null)} onSaved={fetchAll} />
      )}
      {modal && modal.type === "subs" && canManage && (
        <SubmissionReviewModal submissions={submissions} leases={leases} buildings={buildings} me={profile} onClose={() => setModal(null)} onSaved={fetchAll} />
      )}
      {modal && modal.type === "event" && canEdit && (
        <EventModal event={modal.event} leases={leases} buildings={buildings} me={profile} onClose={() => setModal(null)} onSaved={fetchAll} />
      )}
      {modal && modal.type === "dups" && canEdit && (
        <DuplicateModal leases={leases} buildings={buildings} onClose={() => setModal(null)} onSaved={fetchAll} />
      )}
      {modal && modal.type === "admin" && canApprove && (
        <AdminPanel profile={profile} buildings={buildings} customFields={customFields} onClose={() => setModal(null)} onDataChanged={fetchAll} />
      )}
      {modal && modal.type === "profile" && (
        <ProfileModal profile={profile} leases={leases} buildings={buildings} onClose={() => setModal(null)} onSaved={onProfileChanged} onCancelDone={cancelDone} />
      )}
    </div>
  );
}
