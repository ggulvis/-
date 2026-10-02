/* 보담 — 관리자 패널
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 관리자 패널 ---------------- */
function AdminPanel({ profile, buildings, customFields, onClose, onDataChanged }) {
  const isAdminU = profile.role === "admin";
  const isManagerU = profile.role === "manager";
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState(null);
  useEffect(() => {
    if (tab === "records" && records === null) {
      sb.from("contract_records").select("*").order("done_at", { ascending: false }).limit(300)
        .then(({ data }) => setRecords(data || []));
    }
  }, [tab]);
  const [visits, setVisits] = useState(null); // 이용 현황 (admin 전용)
  const [visitsErr, setVisitsErr] = useState("");
  useEffect(() => {
    if (tab === "usage" && visits === null) {
      fetchTableAll("app_visits", "*", ["user_id", "visited_on"]) // 매일 누적 → 1000행 상한 대비
        .then(({ data, error }) => {
          if (error) setVisitsErr(error.message);
          setVisits(data || []);
        });
    }
  }, [tab]);
  const [views, setViews] = useState(null); // 매물 조회수 (admin 전용)
  const [viewsErr, setViewsErr] = useState("");
  useEffect(() => {
    if (tab === "views" && views === null) {
      sb.rpc("lease_view_ranking")
        .then(({ data, error }) => {
          if (error) setViewsErr(error.message);
          setViews(data || []);
        });
    }
  }, [tab]);
  const [openView, setOpenView] = useState(null); // 펼친 매물 lease_id
  const [viewerMap, setViewerMap] = useState({}); // lease_id → 조회자 목록
  const toggleViewers = async (leaseId) => {
    if (openView === leaseId) { setOpenView(null); return; }
    setOpenView(leaseId);
    if (!viewerMap[leaseId]) {
      const { data } = await sb.rpc("lease_view_viewers", { p_lease: leaseId });
      setViewerMap((m) => ({ ...m, [leaseId]: data || [] }));
    }
  };
  const [newField, setNewField] = useState("");
  const [msg, setMsg] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [uRole, setURole] = useState("all"); // 사용자 관리: 등급 필터
  const [uAff, setUAff] = useState("all");   // 사용자 관리: 소속 필터
  const fileRef = useRef(null);
  const affOf = (u) => (u.affiliation || "").trim() || "(소속 없음)";
  const ROLE_RANK = { admin: 0, manager: 1, editor: 2, viewer: 3 };

  const loadUsers = async () => {
    const { data } = await sb.from("user_roles").select("*").order("created_at");
    setUsers(data || []);
  };
  useEffect(() => { loadUsers(); }, []);

  const setRole = async (u, role) => {
    if (u.id === profile.id && role !== "admin" && !confirm("본인의 관리자 권한을 해제하면 이 패널에 접근할 수 없습니다. 계속할까요?")) return;
    const { error } = await sb.from("user_roles").update({ role }).eq("id", u.id);
    if (error) { alert("등급 변경 실패: " + error.message); return; }
    loadUsers();
  };
  const approve = async (u, role) => {
    const { error } = await sb.from("user_roles").update({ status: "active", role }).eq("id", u.id);
    if (error) { alert("승인 실패: " + error.message); return; }
    loadUsers();
  };
  const removeUser = async (u) => {
    if (!confirm(`${u.full_name || u.email} 사용자를 삭제할까요?`)) return;
    await sb.from("user_roles").delete().eq("id", u.id);
    loadUsers();
  };
  const renameUser = async (u) => {
    const nn = prompt(`${u.full_name || u.email}의 새 이름 (예: 보담 홍길동)`, u.full_name || "");
    if (nn === null) return;
    if (!nn.trim()) { alert("이름을 입력하세요."); return; }
    const { error } = await sb.from("user_roles").update({ full_name: nn.trim() }).eq("id", u.id);
    if (error) alert("변경 실패: " + error.message); else loadUsers();
  };
  const addField = async () => {
    if (!newField.trim()) return;
    const { error } = await sb.from("custom_fields").insert({
      field_key: "cf_" + Date.now().toString(36),
      field_label: newField.trim(),
      field_type: "text",
      sort_order: customFields.length,
    });
    if (error) setMsg("추가 실패: " + error.message);
    else { setNewField(""); setMsg(""); onDataChanged(); }
  };
  const removeField = async (cf) => {
    if (!confirm(`"${cf.field_label}" 필드를 삭제할까요? (기존 입력값은 데이터에 남지만 화면에 표시되지 않습니다)`)) return;
    await sb.from("custom_fields").delete().eq("id", cf.id);
    onDataChanged();
  };

  /* 엑셀 업로드 */
  const handleFile = async (file) => {
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (rows.length === 0) throw new Error("데이터 행이 없습니다.");
      const keyOf = (row, kw) => Object.keys(row).find((k) => k.replace(/\s/g, "").includes(kw));
      const k = {
        id: keyOf(rows[0], "ID"),
        building: keyOf(rows[0], "건물명"), room: keyOf(rows[0], "호수"),
        tenant: keyOf(rows[0], "임차인"), phone: keyOf(rows[0], "연락처"),
        start: keyOf(rows[0], "입주"), end: keyOf(rows[0], "만기"),
        deposit: keyOf(rows[0], "보증금"), rent: keyOf(rows[0], "월세"),
        fee: keyOf(rows[0], "관리비"), insurance: keyOf(rows[0], "보증보험"),
        memo: keyOf(rows[0], "메모"),
      };
      if (!k.building || !k.room) throw new Error("필수 열(건물명, 호수)을 찾을 수 없습니다. 열 제목을 확인하세요.");

      // 1) 건물 확보 (기존 조회 + 없는 것 생성)
      const { data: existingB } = await sb.from("buildings").select("id,name");
      const bMap = {}; (existingB || []).forEach((b) => (bMap[b.name] = b.id));
      const newNames = [...new Set(rows.map((r) => String(r[k.building]).trim()).filter((n) => n && !bMap[n]))];
      if (newNames.length > 0) {
        const { data: inserted, error } = await sb.from("buildings").insert(newNames.map((name) => ({ name }))).select();
        if (error) throw error;
        (inserted || []).forEach((b) => (bMap[b.name] = b.id));
      }

      // 2) 기존 임대 조회: ID 매칭(수정용) + 중복 방지 키
      const { data: existingL } = await sb.from("leases").select("id,building_id,room_number,tenant_name,start_date,end_date");
      const existingIds = new Set((existingL || []).map((l) => l.id));
      const dupKey = (l) => [l.building_id, l.room_number, l.tenant_name || "", l.start_date || "", l.end_date || ""].join("|");
      const seen = new Set((existingL || []).map(dupKey));

      // 3) 행 변환: ID가 있으면 기존 데이터 수정, 없으면 신규 등록
      let skipped = 0, invalid = 0, updated = 0;
      const inserts = [], updates = [];
      for (const r of rows) {
        const bname = String(r[k.building]).trim();
        const room = String(r[k.room]).trim();
        if (!bname || !room) { invalid++; continue; }
        const insCell = k.insurance ? String(r[k.insurance] ?? "").trim() : "";
        const insPending = /가입중|진행/.test(insCell);
        const p = {
          building_id: bMap[bname],
          room_number: room,
          tenant_name: k.tenant ? String(r[k.tenant]).trim() || null : null,
          tenant_phone: k.phone ? String(r[k.phone]).trim() || null : null,
          start_date: k.start ? normDate(r[k.start]) : null,
          end_date: k.end ? normDate(r[k.end]) : null,
          deposit: k.deposit ? numOrNull(r[k.deposit]) : null,
          monthly_rent: k.rent ? numOrNull(r[k.rent]) : null,
          management_fee: k.fee ? numOrNull(r[k.fee]) : null,
          insurance: k.insurance ? (insPending ? false : parseIns(insCell)) : null,
          insurance_pending: k.insurance ? insPending : null,
          memo: k.memo ? String(r[k.memo]).trim() || null : null,
        };
        const rowId = k.id ? String(r[k.id]).trim() : "";
        if (rowId && existingIds.has(rowId)) {
          updates.push({ id: rowId, payload: p });
          continue;
        }
        p.custom_data = {};
        const key = dupKey(p);
        if (seen.has(key)) { skipped++; continue; }
        seen.add(key);
        inserts.push(p);
      }

      // 4) 수정 반영 (ID 매칭 행)
      for (const u of updates) {
        const { error } = await sb.from("leases").update(u.payload).eq("id", u.id);
        if (error) throw error;
        updated++;
      }
      // 5) 신규 100건씩 삽입
      for (let i = 0; i < inserts.length; i += 100) {
        const { error } = await sb.from("leases").insert(inserts.slice(i, i + 100));
        if (error) throw error;
      }
      setImportResult({ ok: true, added: inserts.length, updated, skipped, invalid, total: rows.length });
      onDataChanged();
    } catch (e) {
      setImportResult({ ok: false, message: e.message });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const pendingUsers = users.filter((u) => u.status === "pending");
  const tabBtn = (id, label, badge) => (
    <button onClick={() => setTab(id)}
      className={"px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap " + (tab === id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
      {label}{badge > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5">{badge}</span>}
    </button>
  );

  return (
    <Modal title={isAdminU ? "관리자 패널" : "가입 승인"} onClose={onClose} wide>
      {isAdminU && (
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-thin pb-1">
          {tabBtn("users", "사용자 관리", pendingUsers.length)}
          {tabBtn("usage", "이용 현황")}
          {tabBtn("views", "매물 조회수")}
          {tabBtn("records", "계약 실적")}
          {tabBtn("fields", "커스텀 필드")}
          {tabBtn("excel", "엑셀 업로드")}
        </div>
      )}
      {!isAdminU && (
        <p className="text-sm text-slate-500 mb-3">
          {isManagerU ? "가입 신청자를 보담회원 또는 편집자로 승인할 수 있습니다." : "가입 신청자를 보담회원으로 승인할 수 있습니다. 등급 변경은 관리인/관리자에게 요청하세요."}
        </p>
      )}

      {tab === "usage" && isAdminU && (() => {
        const dayMs = 24 * 60 * 60 * 1000;
        const today = rouletteToday();
        const d7 = new Date(Date.now() - 6 * dayMs);
        const d7s = d7.getFullYear() + "-" + String(d7.getMonth() + 1).padStart(2, "0") + "-" + String(d7.getDate()).padStart(2, "0");
        const agg = {};
        (visits || []).forEach((v) => {
          const a = agg[v.user_id] = agg[v.user_id] || { days: 0, last7: 0, last: null };
          a.days++;
          if (String(v.visited_on) >= d7s) a.last7++;
          if (!a.last || String(v.last_seen) > String(a.last)) a.last = v.last_seen;
        });
        const fmtLast = (iso) => {
          const d = new Date(iso), t = new Date();
          const days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / dayMs);
          const hm = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
          return days <= 0 ? "오늘 " + hm : days === 1 ? "어제 " + hm : days + "일 전";
        };
        const rows = users.filter((u) => u.status !== "pending")
          .map((u) => ({ u, a: agg[u.user_id] || null }))
          .sort((x, y) => String((y.a && y.a.last) || "").localeCompare(String((x.a && x.a.last) || "")));
        const todayCnt = new Set((visits || []).filter((v) => String(v.visited_on) === today).map((v) => v.user_id)).size;
        return (
          <div className="pb-2">
            {visits === null ? (
              <p className="text-sm text-slate-400 text-center py-6">불러오는 중...</p>
            ) : visitsErr ? (
              <p className="text-sm text-amber-600 text-center py-6 break-keep">이용 기록 테이블(app_visits)이 아직 없습니다.<br />관리용 SQL을 실행하면 이때부터 기록이 쌓입니다.</p>
            ) : (
              <React.Fragment>
                <div className="flex flex-wrap gap-2 mb-3 text-sm">
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full px-3 py-1 font-semibold">오늘 접속 <b>{todayCnt}</b>명</span>
                  <span className="bg-slate-50 border border-slate-200 text-slate-600 rounded-full px-3 py-1">전체 {rows.length}명 · 하루 1회 기준(접속일수)</span>
                </div>
                {(visits || []).length === 0 && (
                  <p className="text-xs text-slate-400 mb-2 break-keep">아직 기록이 없습니다. 이번 버전(v{APP_VERSION}) 배포 후 각자 앱을 열 때부터 쌓입니다.</p>
                )}
                <div className="space-y-1.5">
                  {rows.map(({ u, a }) => (
                    <div key={u.id} className="flex items-center justify-between border rounded-xl px-3 py-2 bg-white gap-2">
                      <span className="min-w-0 truncate text-sm">
                        <b className="text-slate-800">{u.full_name || u.email}</b>
                        <span className="ml-1.5 align-middle"><RoleBadge role={u.role} /></span>
                        {u.affiliation && <span className="text-slate-400 ml-1">{u.affiliation}</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        {a ? (
                          <React.Fragment>
                            <span className={"text-sm font-semibold " + (fmtLast(a.last).startsWith("오늘") ? "text-emerald-600" : a.last7 > 0 ? "text-slate-600" : "text-amber-600")}>{fmtLast(a.last)}</span>
                            <span className="block text-[11px] text-slate-400">최근7일 {a.last7}일 · 누적 {a.days}일</span>
                          </React.Fragment>
                        ) : (
                          <span className="text-sm text-slate-300">기록 없음</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </React.Fragment>
            )}
          </div>
        );
      })()}

      {tab === "views" && isAdminU && (() => {
        const rows = (views || []);
        const totalViews = rows.reduce((s, r) => s + Number(r.total_views || 0), 0);
        const fmtWhen = (iso) => {
          if (!iso) return "";
          const d = new Date(iso), t = new Date(), dayMs = 86400000;
          const days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / dayMs);
          return days <= 0 ? "오늘" : days === 1 ? "어제" : days + "일 전";
        };
        return (
          <div className="pb-2">
            {views === null ? (
              <p className="text-sm text-slate-400 text-center py-6">불러오는 중...</p>
            ) : viewsErr ? (
              <p className="text-sm text-amber-600 text-center py-6 break-keep">조회수 기록이 아직 준비되지 않았습니다.<br />관리용 SQL을 실행하면 이때부터 매물 조회가 집계됩니다.</p>
            ) : (
              <React.Fragment>
                <div className="flex flex-wrap gap-2 mb-3 text-sm">
                  <span className="bg-sky-50 border border-sky-200 text-sky-800 rounded-full px-3 py-1 font-semibold">누적 조회 <b>{totalViews.toLocaleString()}</b></span>
                  <span className="bg-slate-50 border border-slate-200 text-slate-600 rounded-full px-3 py-1">매물 상세를 연 횟수 기준 · 조회 많은 순</span>
                </div>
                {rows.length === 0 ? (
                  <p className="text-xs text-slate-400 mb-2 break-keep">아직 조회 기록이 없습니다. 이번 버전 배포 후 누군가 매물 상세를 열면 쌓입니다.</p>
                ) : (
                  <div className="space-y-1.5">
                    {rows.map((r, i) => {
                      const isOpen = openView === r.lease_id;
                      const vl = viewerMap[r.lease_id];
                      return (
                      <div key={r.lease_id} className="border rounded-xl bg-white">
                        <button onClick={() => toggleViewers(r.lease_id)} className="w-full flex items-center justify-between px-3 py-2 gap-2 text-left active:bg-slate-50">
                          <span className="min-w-0 truncate text-sm">
                            <span className="text-slate-400 mr-1.5 tabular-nums">{i + 1}</span>
                            <b className="text-slate-800">{r.building_name || "-"} {fmtRoom(r.room_number)}</b>
                            <span className="text-slate-300 ml-1.5 text-xs">{isOpen ? "▲" : "▾"}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="text-sm font-bold text-sky-600">{Number(r.total_views).toLocaleString()}회</span>
                            <span className="block text-[11px] text-slate-400">{r.viewers}명 · {fmtWhen(r.last_at)}</span>
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-2.5 pt-0.5 border-t border-slate-100">
                            {vl === undefined ? (
                              <p className="text-xs text-slate-400 py-1.5">불러오는 중...</p>
                            ) : vl.length === 0 ? (
                              <p className="text-xs text-slate-400 py-1.5">조회자 정보가 없습니다.</p>
                            ) : (
                              <div className="space-y-1 pt-1.5">
                                {vl.map((v, j) => (
                                  <div key={j} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600 truncate">{v.viewer}</span>
                                    <span className="shrink-0 text-slate-400 ml-2">{Number(v.views).toLocaleString()}회 · {fmtWhen(v.last_at)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );})}
                  </div>
                )}
              </React.Fragment>
            )}
          </div>
        );
      })()}

      {tab === "records" && (
        <div className="pb-2">
          {records === null ? (
            <p className="text-sm text-slate-400 text-center py-6">불러오는 중...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">아직 계약 실적이 없습니다.</p>
          ) : (
            <React.Fragment>
              <p className="text-sm font-semibold text-slate-600 mb-2">사람별 누적 실적</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(records.reduce((m, r) => { const k = r.done_by || "(미상)"; m[k] = (m[k] || 0) + 1; return m; }, {}))
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, cnt]) => (
                    <span key={name} className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full px-3 py-1 text-sm font-semibold">
                      {name} <b>{cnt}건</b>
                    </span>
                  ))}
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-2">최근 기록</p>
              <div className="space-y-1.5">
                {records.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm border rounded-xl px-3 py-2 bg-white">
                    <span className="min-w-0 truncate"><b className="text-slate-800">{r.done_by || "(미상)"}</b><span className="text-slate-500 ml-1.5">{r.building_name} {r.room_number}</span></span>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{String(r.done_at).slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </React.Fragment>
          )}
        </div>
      )}

      {tab === "users" && (() => {
        const base = isAdminU ? users : pendingUsers;
        const pendCnt = users.filter((u) => u.status === "pending").length;
        const roleCnt = (r) => users.filter((u) => u.status !== "pending" && u.role === r).length;
        const affList = [...new Set(users.map(affOf))].sort((a, b) => a.localeCompare(b, "ko"));
        const affCnt = (a) => users.filter((u) => affOf(u) === a).length;
        const shown = base
          .filter((u) => uRole === "all" ? true : uRole === "pending" ? u.status === "pending" : u.status !== "pending" && u.role === uRole)
          .filter((u) => uAff === "all" || affOf(u) === uAff)
          .sort((a, b) =>
            (a.status === "pending" ? -1 : ROLE_RANK[a.role] ?? 9) - (b.status === "pending" ? -1 : ROLE_RANK[b.role] ?? 9) ||
            String(a.full_name || a.email || "").localeCompare(String(b.full_name || b.email || ""), "ko"));
        const groups = [];
        shown.forEach((u) => {
          const k = affOf(u);
          const g = groups.find((x) => x.aff === k);
          if (g) g.list.push(u); else groups.push({ aff: k, list: [u] });
        });
        const chip = (active, label, cnt, onClick) => (
          <button key={label} onClick={onClick}
            className={"rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap " +
              (active ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50")}>
            {label}{cnt != null && <span className={active ? " text-blue-200" : " text-slate-400"}> {cnt}</span>}
          </button>
        );
        return (
        <div className="space-y-2 pb-2">
          {isAdminU && users.length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-bold text-slate-400 w-7 shrink-0">등급</span>
                {chip(uRole === "all", "전체", users.length, () => setURole("all"))}
                {pendCnt > 0 && chip(uRole === "pending", "대기", pendCnt, () => setURole("pending"))}
                {chip(uRole === "admin", "관리자", roleCnt("admin"), () => setURole("admin"))}
                {chip(uRole === "manager", "관리인", roleCnt("manager"), () => setURole("manager"))}
                {chip(uRole === "editor", "편집자", roleCnt("editor"), () => setURole("editor"))}
                {chip(uRole === "viewer", "보담회원", roleCnt("viewer"), () => setURole("viewer"))}
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-bold text-slate-400 w-7 shrink-0">소속</span>
                {chip(uAff === "all", "전체", null, () => setUAff("all"))}
                {affList.map((a) => chip(uAff === a, a, affCnt(a), () => setUAff(a)))}
              </div>
            </div>
          )}
          {base.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">{isAdminU ? "사용자가 없습니다." : "승인 대기 중인 가입 신청이 없습니다."}</p>
          )}
          {base.length > 0 && shown.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">조건에 맞는 사용자가 없습니다.</p>
          )}
          {groups.map((g) => (
          <div key={g.aff}>
          {isAdminU && (
            <p className="text-xs font-bold text-slate-500 mt-3 mb-1.5 flex items-center gap-1.5">
              <span className="bg-slate-100 rounded px-1.5 py-0.5">🏢 {g.aff}</span>
              <span className="text-slate-400 font-medium">{g.list.length}명</span>
            </p>
          )}
          <div className="space-y-2">
          {g.list.map((u) => (
            <div key={u.id} className={"border rounded-xl p-3 " + (u.status === "pending" ? "border-amber-300 bg-amber-50" : "bg-white")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-slate-800">{u.full_name || "(이름 없음)"}</span>
                <RoleBadge role={u.status === "pending" ? "pending" : u.role} />
                {u.id === profile.id && <span className="text-xs text-slate-400">(나)</span>}
              </div>
              {u.affiliation && <p className="text-sm text-slate-700 mt-0.5"><span className="text-[11px] font-bold bg-slate-100 text-slate-500 rounded px-1 py-0.5 mr-1">소속</span>{u.affiliation}</p>}
              <p className="text-sm text-slate-500 mt-0.5">{u.email}{u.phone ? " · " + u.phone : ""}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {u.status === "pending" ? (
                  <React.Fragment>
                    <button className={btnPrimary + " !py-1.5"} onClick={() => approve(u, "viewer")}>보담회원으로 승인</button>
                    {(isAdminU || isManagerU) && <button className={btnGhost + " !py-1.5"} onClick={() => approve(u, "editor")}>편집자로 승인</button>}
                    {isAdminU && <button className={btnGhost + " !py-1.5"} onClick={() => approve(u, "manager")}>관리인으로 승인</button>}
                    {isAdminU && <button className={btnDanger + " !py-1.5"} onClick={() => removeUser(u)}>거절</button>}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <select className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white" value={u.role} onChange={(e) => setRole(u, e.target.value)}>
                      <option value="viewer">보담회원</option>
                      <option value="editor">편집자</option>
                      <option value="manager">관리인</option>
                      <option value="admin">관리자</option>
                    </select>
                    <button className={btnGhost + " !py-1.5"} onClick={() => renameUser(u)}>이름수정</button>
                    <button className={btnDanger + " !py-1.5"} onClick={() => removeUser(u)}>삭제</button>
                  </React.Fragment>
                )}
              </div>
            </div>
          ))}
          </div>
          </div>
          ))}
        </div>
        );
      })()}

      {tab === "fields" && (
        <div className="pb-2">
          <p className="text-sm text-slate-500 mb-3">임대 정보에 추가로 기록할 항목을 정의합니다. (예: 주차, 특약사항)</p>
          <div className="flex gap-2 mb-4">
            <input className={inputCls} value={newField} onChange={(e) => setNewField(e.target.value)} placeholder="새 필드 이름" onKeyDown={(e) => e.key === "Enter" && addField()} />
            <button className={btnPrimary + " shrink-0"} onClick={addField}>추가</button>
          </div>
          {msg && <p className="text-sm text-red-600 mb-2">{msg}</p>}
          <div className="space-y-2">
            {customFields.length === 0 && <p className="text-sm text-slate-400 text-center py-4">등록된 커스텀 필드가 없습니다.</p>}
            {customFields.map((cf) => (
              <div key={cf.id} className="flex items-center justify-between border rounded-xl px-3 py-2.5 bg-white">
                <span className="font-medium text-slate-700">{cf.field_label}</span>
                <button className="text-sm text-red-500 hover:text-red-700" onClick={() => removeField(cf)}>삭제</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "excel" && (
        <div className="pb-2">
          <div className="bg-slate-50 border rounded-xl p-3 mb-4 text-sm text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">엑셀 양식 (첫 행 = 열 제목)</p>
            <p className="break-keep">건물명(주소) · 호수 · 임차인명 · 연락처 · 입주날짜 · 만기일 · 보증금(만원) · 월세(만원) · 관리비(만원) · 보증보험 · 메모</p>
            <p className="mt-2 text-slate-400 break-keep">※ "엑셀 다운로드"로 받은 파일에는 ID 열이 있습니다. ID가 있는 행은 <b>기존 데이터 수정</b>으로 반영되고(중복 안 생김), ID가 없는 행은 신규 등록됩니다. ID 열은 수정하지 마세요.</p>
            <p className="mt-1 text-slate-400">※ 이미 등록된 것과 동일한 행(건물·호수·임차인·입주·만기 일치)은 자동으로 건너뜁니다.</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          <button className={btnPrimary + " w-full py-3"} disabled={importing} onClick={() => fileRef.current.click()}>
            {importing ? "가져오는 중..." : "엑셀 파일 선택"}
          </button>
          {importResult && (
            importResult.ok ? (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
                총 {importResult.total}행 중 <b>{importResult.added}건 추가</b>
                {importResult.updated > 0 && <span>, <b>{importResult.updated}건 수정</b></span>}
                {importResult.skipped > 0 && <span>, 중복 {importResult.skipped}건 건너뜀</span>}
                {importResult.invalid > 0 && <span>, 필수값 누락 {importResult.invalid}건 제외</span>}
              </div>
            ) : (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">오류: {importResult.message}</div>
            )
          )}
        </div>
      )}
    </Modal>
  );
}
