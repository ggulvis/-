/* 보담 — 임대 목록 (테이블/카드 반응형)
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 임대 목록 (테이블/카드 반응형) ---------------- */
function EventTag() {
  return <span className="text-[10px] font-bold bg-rose-100 text-rose-600 border border-rose-200 rounded px-1 py-px mr-1 align-middle">이벤트</span>;
}
function MoveOutTag() {
  return <span className="text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300 rounded px-1 py-px mr-1 align-middle">중도퇴실</span>;
}
function VacantTag() {
  return <span className="text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-300 rounded px-1 py-px mr-1 align-middle">공실</span>;
}
/* 보증보험 가입완료/가입중 매물 옆에 붙는 체크 배지 (둘 다 동일 표시) */
function InsMark() {
  return <span title="보증보험" className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded px-1 py-px ml-1 align-middle">✓보증보험</span>;
}
/* 꿀방에서 가져온 사진이 있는 매물 배지. n=장수 */
function PhotoMark({ n }) {
  return <span title={"매물 사진 " + n + "장"} className="text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-300 rounded px-1 py-px ml-1 align-middle">📷{n}</span>;
}
/* 가입완료(insurance) 또는 가입중(insurance_pending)이면 true */
const isInsured = (l) => !!l && (l.insurance === true || l.insurance_pending === true);
/* 복비 보너스/덤이 붙은 매물이면 true (태그 기준: 복비·보너스·덤 포함) */
const hasBonus = (l) => !!l && Array.isArray(l.tags) && l.tags.some((t) => /복비|보너스|덤/.test(String(t)));
const hasEvent = (l) => !!l && !!l.event_id; // 이벤트 매물 (events 연결)
/* 서울 주택 임대차 법정 중개보수 상한(만원). deposit·rent 만원 단위. 산정 불가 시 null.
   거래금액=보증금+월세×100(단 5천만 미만이면 ×70). 요율/한도: <5천만 0.5%·20만 / <1억 0.4%·30만 / <6억 0.3% / <12억 0.4% / <15억 0.5% / 이상 0.6% */
function legalMaxFee(deposit, rent) {
  const dep = Number(deposit) || 0, rt = Number(rent) || 0;
  if (dep <= 0 && rt <= 0) return null;
  const base = dep + rt * 100;
  const amt = base < 5000 ? dep + rt * 70 : base; // 거래금액(만원)
  let rate, cap;
  if (amt < 5000) { rate = 0.005; cap = 20; }
  else if (amt < 10000) { rate = 0.004; cap = 30; }
  else if (amt < 60000) { rate = 0.003; cap = Infinity; }
  else if (amt < 120000) { rate = 0.004; cap = Infinity; }
  else if (amt < 150000) { rate = 0.005; cap = Infinity; }
  else { rate = 0.006; cap = Infinity; }
  return Math.min(amt * rate, cap); // 만원
}
const BONUS_TAGS = ["임대인 복비보너스", "임차인 복비보너스", "복비보너스"];

/* 매물 세부 옵션 / 건물 옵션 어휘 (v=저장·배지 표시값, d=선택 화면 설명) */
const LEASE_TAGS = [
  { v: "가격협의", d: "가격협의 가능" },
  { v: "전입신고X", d: "전입신고 불가" },
  { v: "전기포함", d: "관리비에 전기 포함" },
  { v: "가스포함", d: "관리비에 가스 포함" },
  { v: "개런티즈", d: "개런티즈" },
  { v: "짐 미리 뺌", d: "짐 미리 뺌 (공실 정리)" },
  { v: "임차인 복비보너스", d: "임차인 복비 보너스" },
  { v: "임대인 복비보너스", d: "임대인 복비 보너스" },
  { v: "묵시적갱신", d: "묵시적 갱신된 계약" },
];
const BUILDING_OPTS = [
  { v: "주차가능", d: "주차 가능" },
  { v: "주차불가", d: "주차 불가" },
  { v: "엘리베이터", d: "엘리베이터 있음" },
  { v: "역세권", d: "역세권" },
  { v: "신축", d: "신축 건물" },
  { v: "CCTV", d: "CCTV 설치" },
  { v: "보증보험 가능", d: "보증보험 가능" },
];
/* 선택된 태그를 배지로 표시 */
function TagChips({ items, tone }) {
  if (!items || items.length === 0) return null;
  const cls = tone === "building"
    ? "bg-violet-50 text-violet-700 border-violet-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
  return <React.Fragment>{items.map((t, i) => (
    <span key={i} className={"inline-block text-[10px] font-semibold border rounded px-1.5 py-0.5 mr-1 mb-0.5 align-middle " + cls}>{t}</span>
  ))}</React.Fragment>;
}
/* 태그 선택기 (수정 모달용). allowCustom=true면 "직접입력"으로 자유 태그 추가 가능 */
function TagPicker({ options, selected, onToggle, tone, allowCustom }) {
  const [custom, setCustom] = useState("");
  const sel = selected || [];
  const activeCls = tone === "building" ? "bg-violet-600 border-violet-600 text-white" : "bg-amber-500 border-amber-500 text-white";
  const knownVals = options.map((o) => o.v);
  const customTags = sel.filter((v) => !knownVals.includes(v));
  const addCustom = () => {
    const t = custom.trim();
    if (!t) return;
    if (!sel.includes(t)) onToggle(t);
    setCustom("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = sel.includes(o.v);
          return (
            <button type="button" key={o.v} onClick={() => onToggle(o.v)}
              className={"text-xs font-semibold border rounded-full px-3 py-1.5 " + (on ? activeCls : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")}>
              {on ? "✓ " : ""}{o.d}
            </button>
          );
        })}
        {customTags.map((t) => (
          <button type="button" key={t} onClick={() => onToggle(t)} title="눌러서 제거"
            className={"text-xs font-semibold border rounded-full px-3 py-1.5 " + activeCls}>
            {t} ✕
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-1.5 mt-2">
          <input className={inputCls + " !py-1.5 text-sm"} value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="직접입력 (예: 복비 30만원)" />
          <button type="button" onClick={addCustom} className="shrink-0 text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3">추가</button>
        </div>
      )}
    </div>
  );
}
function LeaseList({ leases, buildings, canEdit, me, showBuilding, photos, onRowClick, onMarkDone, onCancelDone }) {
  const photoN = (l) => (photos || {})[l.id] || 0; // 꿀방 사진 장수 (0=없음)
  const bName = (id) => (buildings.find((b) => b.id === id) || {}).name || "-";
  const canCancel = (l) => canEdit || (me && l.contract_done_by === (me.full_name || me.email));
  if (leases.length === 0) return <p className="text-center text-slate-400 text-sm py-10">임대 정보가 없습니다.</p>;
  return (
    <div>
      {/* PC: 테이블 */}
      <div className="hidden md:block overflow-x-auto scrollbar-thin bg-white rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b bg-slate-50">
              {showBuilding && <th className="px-3 py-2.5 font-medium whitespace-nowrap">건물명</th>}
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">호수</th>
              {canEdit && <th className="px-3 py-2.5 font-medium whitespace-nowrap">임차인명</th>}
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">연락처</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">입주날짜</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">만기일</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">D-day</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">보증금(만원)</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">월세(만원)</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">관리비(만원)</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">보증보험</th>
              <th className="px-3 py-2.5 font-medium whitespace-nowrap">계약</th>
            </tr>
          </thead>
          <tbody>
            {leases.map((l) => {
              const d = ddayInfo(l.end_date);
              return (
                <tr key={l.id} className="border-b last:border-0 hover:bg-blue-50 cursor-pointer"
                    onClick={() => onRowClick(l)}>
                  {showBuilding && <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-700">{bName(l.building_id)}</td>}
                  <td className="px-3 py-2.5 align-top">
                    <div className="whitespace-nowrap font-semibold text-slate-800">{l.move_out && <MoveOutTag />}{l.vacant && <VacantTag />}{l.event_id && <EventTag />}{fmtRoom(l.room_number)}{isInsured(l) && <InsMark />}{photoN(l) > 0 && <PhotoMark n={photoN(l)} />}</div>
                    {l.tags && l.tags.length > 0 && <div className="mt-0.5 max-w-[180px]"><TagChips items={l.tags} tone="lease" /></div>}
                  </td>
                  {canEdit && <td className="px-3 py-2.5 whitespace-nowrap">{l.tenant_name || "-"}</td>}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {l.tenant_phone ? (
                      <a href={telHref(l.tenant_phone)} onClick={(e) => e.stopPropagation()}
                         className="text-blue-600 hover:underline font-medium">📞 <span className="text-[10px] font-bold bg-slate-100 text-slate-500 rounded px-1 py-0.5 mr-1">세</span>{l.tenant_phone}</a>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(l.start_date)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(l.end_date)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><span className={"text-xs font-bold px-2 py-0.5 rounded-full " + d.cls}>{d.label}</span></td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">{fmtMoney(l.deposit)}{l.hope_deposit != null && <div className="text-[11px] text-sky-600 font-medium">희망 {fmtMoney(l.hope_deposit)}</div>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">{fmtMoney(l.monthly_rent)}{l.hope_rent != null && <div className="text-[11px] text-sky-600 font-medium">희망 {fmtMoney(l.hope_rent)}</div>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right">{fmtMoney(l.management_fee)}{l.hope_fee != null && <div className="text-[11px] text-sky-600 font-medium">희망 {fmtMoney(l.hope_fee)}</div>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{isInsured(l) ? <span className="text-emerald-700 font-semibold">✓ 가입</span> : "-"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {l.contract_done ? (
                      <React.Fragment>
                        <span className="text-xs text-emerald-700 font-semibold" title={(l.contract_done_by || "") + " · " + String(l.contract_done_at || "").slice(0, 10)}>🎉 완료</span>
                        {canCancel(l) && (
                          <button className="ml-1.5 text-[11px] text-slate-400 underline hover:text-red-500"
                            onClick={(e) => { e.stopPropagation(); onCancelDone(l); }}>취소</button>
                        )}
                      </React.Fragment>
                    ) : (
                      <button className="text-xs font-semibold bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-full px-2 py-0.5 hover:bg-emerald-100"
                        onClick={(e) => { e.stopPropagation(); onMarkDone(l); }}>계약완료</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 모바일: 카드 */}
      <div className="md:hidden space-y-2">
        {leases.map((l) => {
          const d = ddayInfo(l.end_date);
          return (
            <div key={l.id} className="bg-white rounded-xl border p-3 active:bg-blue-50 cursor-pointer"
                 onClick={() => onRowClick(l)}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-slate-800">
                  {l.move_out && <MoveOutTag />}
                  {l.vacant && <VacantTag />}
                  {l.event_id && <EventTag />}
                  {showBuilding && <span className="text-slate-500 font-medium mr-1.5">{bName(l.building_id)}</span>}
                  {fmtRoom(l.room_number)}
                  {isInsured(l) && <InsMark />}
                  {photoN(l) > 0 && <PhotoMark n={photoN(l)} />}
                  {canEdit && l.tenant_name && <span className="font-medium text-slate-600 ml-1.5">· {l.tenant_name}</span>}
                </div>
                <span className={"text-xs font-bold px-2 py-0.5 rounded-full shrink-0 " + d.cls}>{d.label}</span>
              </div>
              <div className="text-sm text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>만기 {fmtDate(l.end_date)}</span>
                {l.deposit != null && <span>{(l.vacant || l._hope) ? "희망 " : ""}보증금 {fmtKRW(l.deposit)}</span>}
                {l.monthly_rent != null && <span>{(l.vacant || l._hope) ? "희망 " : ""}월세 {fmtKRW(l.monthly_rent)}</span>}
                {l.hope_deposit != null && <span className="text-sky-600 font-medium">희망 {fmtKRW(l.hope_deposit)}{l.hope_rent ? " / 월 " + fmtKRW(l.hope_rent) : ""}</span>}
              </div>
              {l.tags && l.tags.length > 0 && <div className="mt-1"><TagChips items={l.tags} tone="lease" /></div>}
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                {l.tenant_phone && (
                  <a href={telHref(l.tenant_phone)} onClick={(e) => e.stopPropagation()}
                     className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-sm px-3 py-1.5 rounded-lg active:bg-blue-100">
                    📞 <span className="text-[10px] font-bold bg-white/70 border border-blue-200 rounded px-1">세</span> {l.tenant_phone}
                  </a>
                )}
                {l.contract_done ? (
                  <React.Fragment>
                    <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">🎉 {l.contract_done_by} 계약완료</span>
                    {canCancel(l) && (
                      <button onClick={(e) => { e.stopPropagation(); onCancelDone(l); }}
                        className="text-xs text-slate-400 underline active:text-red-500">취소</button>
                    )}
                  </React.Fragment>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); onMarkDone(l); }}
                    className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-sm px-3 py-1.5 rounded-lg active:bg-emerald-100">
                    🎉 계약완료
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
