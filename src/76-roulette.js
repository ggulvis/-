/* 보담 — 꽝 없는 룰렛 이벤트
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 꽝 없는 룰렛 이벤트 ---------------- */
const ROULETTE_START = "2026-07-17";
const ROULETTE_END = "2026-09-28";
const ROULETTE_PRIZES = [150, 50, 50, 30, 30, 30, 10, 10, 10, 10, 10, 10]; // 만원 · 총 400
const ROULETTE_COLORS = { 150: "#f59e0b", 50: "#f43f5e", 30: "#0ea5e9", 10: "#10b981" };

function rouletteToday() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function RoulettePractice() {
  const [stage, setStage] = useState("idle"); // idle | ask | pick | wheel | done
  const [count, setCount] = useState(0);
  const [lie, setLie] = useState(false);
  const [picked, setPicked] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [consumed, setConsumed] = useState([]);
  const [turn, setTurn] = useState(0);
  const [banner, setBanner] = useState("");
  const [bannerHot, setBannerHot] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [total, setTotal] = useState(0);
  const [myResults, setMyResults] = useState([]);
  const wheelRef = useRef(null);
  const rotRef = useRef(0);
  const pausedRef = useRef(false);
  const stopRef = useRef(false);
  const genRef = useRef(0);
  const audioRef = useRef(null);

  const ac = () => {
    if (!audioRef.current) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) try { audioRef.current = new C(); } catch (e) {}
    }
    if (audioRef.current && audioRef.current.state === "suspended") try { audioRef.current.resume(); } catch (e) {}
    return audioRef.current;
  };
  const beep = (freq, dur, type, vol, delay) => {
    const ctx = ac(); if (!ctx) return;
    try {
      const t = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  };
  const tickSound = () => beep(1250, 0.04, "square", 0.035);
  const thud = () => beep(200, 0.16, "sine", 0.09);
  const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, "triangle", 0.08, i * 0.12));

  const hardReset = (next) => {
    genRef.current++;
    stopRef.current = true; pausedRef.current = false;
    setRunning(false); setPaused(false); setCount(0); setLie(false); setPicked([]);
    setPrizes([]); setConsumed([]); setTurn(0); setBanner(""); setBannerHot(false);
    setTotal(0); setMyResults([]);
    rotRef.current = 0;
    setStage(next);
  };

  // 일시정지를 반영하는 대기
  const wait = (ms) => new Promise((res) => {
    let left = ms; let last = performance.now();
    const step = (now) => {
      if (stopRef.current) return res();
      if (!pausedRef.current) left -= now - last;
      last = now;
      if (left <= 0) return res();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  // seg(0~11) 칸이 상단 포인터에 오도록 감속 회전
  const spinTo = (seg, duration, extraTurns) => new Promise((res) => {
    const startRot = ((rotRef.current % 360) + 360) % 360;
    const targetMod = (360 - (seg * 30 + 15) + 360) % 360;
    const jitter = Math.random() * 20 - 10; // 칸(30°) 안에서만 흔들림
    const final = startRot + 360 * extraTurns + ((targetMod - startRot + 360) % 360) + jitter;
    let elapsed = 0; let last = performance.now();
    let lastTick = Math.floor(startRot / 30);
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const frame = (now) => {
      if (stopRef.current) return res();
      if (!pausedRef.current) elapsed += now - last;
      last = now;
      const p = Math.min(1, elapsed / duration);
      const rot = startRot + (final - startRot) * ease(p);
      rotRef.current = rot;
      if (wheelRef.current) wheelRef.current.style.transform = "rotate(" + rot + "deg)";
      const ti = Math.floor(rot / 30);
      if (ti !== lastTick) { lastTick = ti; tickSound(); }
      if (p >= 1) return res();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  const startWheel = () => {
    const arr = [...ROULETTE_PRIZES];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    setPrizes(arr); setConsumed([]); setTotal(0); setMyResults([]); setTurn(0);
    setBanner("👇 룰렛을 터치하세요!"); setBannerHot(false);
    rotRef.current = 0;
    setStage("wheel");
  };

  const runAll = async () => {
    if (running) return;
    ac(); // 사용자 제스처 시점에 오디오 활성화
    const g = genRef.current;
    stopRef.current = false; pausedRef.current = false;
    setPaused(false); setRunning(true);
    const used = [];
    let sum = 0;
    for (let t = 1; t <= 12; t++) {
      if (stopRef.current || genRef.current !== g) break;
      setTurn(t);
      const mine = picked.includes(t);
      setBannerHot(mine);
      setBanner(mine ? "🔥 당신의 순서입니다!" : t + "번째 참가자 순서...");
      await wait(mine ? 1200 : 500);
      if (stopRef.current || genRef.current !== g) break;
      const remaining = ROULETTE_PRIZES.map((_, i) => i).filter((i) => used.indexOf(i) < 0);
      const seg = remaining[Math.floor(Math.random() * remaining.length)];
      await spinTo(seg, mine ? 7000 : 2600, mine ? 8 : 3);
      if (stopRef.current || genRef.current !== g) break;
      used.push(seg);
      setConsumed(used.slice());
      const prize = prizes[seg];
      if (mine) {
        sum += prize; setTotal(sum);
        setMyResults((r) => [...r, { turn: t, prize }]);
        fanfare();
        setBanner("🎊 " + prize + "만원 당첨!");
      } else {
        thud();
        setBanner(t + "번째 참가자: " + prize + "만원");
      }
      await wait(mine ? 1800 : 1000);
    }
    if (genRef.current !== g) return;
    setRunning(false);
    setStage("done");
  };

  const pt = (ang, r) => [r * Math.cos(ang * Math.PI / 180), r * Math.sin(ang * Math.PI / 180)];
  const nums = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="mt-4 border-t border-amber-100 pt-3">
      {stage === "idle" && (
        <button onClick={() => hardReset("ask")}
          className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 active:bg-amber-100 py-3 font-bold text-amber-700">
          🎰 룰렛 연습하기
        </button>
      )}
      {stage !== "idle" && (
        <p className="text-[11px] text-slate-400 mb-2">🎮 연습 게임 — 실제 추첨과 무관해요. 상금 구성만 동일!</p>
      )}

      {stage === "ask" && (
        <div className="text-center">
          <p className="font-bold text-slate-700 mb-2">당신은 몇 개의 방을 계약했나요?</p>
          {lie && <p className="text-sm font-bold text-rose-600 mb-2 animate-bounce">뻥치지마… 진정하고 다시 써! 🤥</p>}
          <div className="grid grid-cols-6 gap-1.5 max-w-xs mx-auto">
            {nums.map((n) => (
              <button key={n}
                onClick={() => { if (n >= 10) { setLie(true); } else { setLie(false); setCount(n); setPicked([]); setStage("pick"); } }}
                className="rounded-lg border border-slate-300 bg-white py-2 text-sm font-bold text-slate-700 hover:bg-amber-50 active:scale-95">{n}</button>
            ))}
          </div>
          <button className="text-xs text-slate-400 mt-3 underline" onClick={() => hardReset("idle")}>닫기</button>
        </div>
      )}

      {stage === "pick" && (
        <div className="text-center">
          <p className="font-bold text-slate-700 mb-1">몇 번째로 룰렛을 돌리실 건가요?</p>
          <p className="text-sm text-slate-500 mb-2">남은횟수 : <b className="text-rose-600">{count - picked.length}</b></p>
          <div className="grid grid-cols-6 gap-1.5 max-w-xs mx-auto">
            {nums.map((n) => {
              const on = picked.indexOf(n) >= 0;
              return (
                <button key={n}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== n) : picked.length < count ? [...picked, n] : picked)}
                  className={"rounded-lg border py-2 text-sm font-bold active:scale-95 " +
                    (on ? "border-rose-400 bg-rose-500 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-amber-50")}>{n}</button>
              );
            })}
          </div>
          <button className={btnPrimary + " mt-3 w-full max-w-xs"} disabled={picked.length !== count} onClick={startWheel}>
            {picked.length === count ? "이 순서로 도전! 🎰" : "순서를 " + (count - picked.length) + "개 더 선택하세요"}
          </button>
        </div>
      )}

      {stage === "wheel" && (
        <div className="text-center select-none">
          <p className={"font-bold mb-2 " + (bannerHot ? "text-rose-600 text-lg" : "text-slate-700")}>{banner}</p>
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto cursor-pointer" onClick={() => { if (!running) runAll(); }}>
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 text-2xl drop-shadow">🔻</div>
            <svg viewBox="-100 -100 200 200" className="w-full h-full">
              <g ref={wheelRef} style={{ transformOrigin: "0px 0px" }}>
                {prizes.map((p, i) => {
                  const a0 = -90 + i * 30, a1 = a0 + 30, mid = a0 + 15;
                  const s = pt(a0, 96), e = pt(a1, 96), l = pt(mid, 62);
                  const used = consumed.indexOf(i) >= 0;
                  return (
                    <g key={i}>
                      <path d={"M0 0 L" + s[0] + " " + s[1] + " A96 96 0 0 1 " + e[0] + " " + e[1] + " Z"}
                        fill={used ? "#e2e8f0" : ROULETTE_COLORS[p]} stroke="#fff" strokeWidth="1.5" />
                      <text x={l[0]} y={l[1]} fill={used ? "#94a3b8" : "#fff"} fontSize="11" fontWeight="bold"
                        textAnchor="middle" dominantBaseline="middle"
                        transform={"rotate(" + (mid + 90) + " " + l[0] + " " + l[1] + ")"}>{p}만</text>
                    </g>
                  );
                })}
              </g>
              <circle r="24" fill="#fff" stroke="#f59e0b" strokeWidth="3" />
              <text y="1" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="bold" fill="#b45309">
                {running ? turn + " / 12" : "터치!"}
              </text>
            </svg>
          </div>
          <p className="mt-2 text-xs text-slate-500">내 순서: {picked.slice().sort((a, b) => a - b).join(", ")}번째</p>
          <p className="text-lg font-extrabold text-amber-600">누적 상금: {total}만원</p>
          {running && (
            <div className="flex gap-2 justify-center mt-2">
              <button className={btnGhost} onClick={() => { const nv = !pausedRef.current; pausedRef.current = nv; setPaused(nv); }}>
                {paused ? "▶ 계속" : "⏸ 일시정지"}
              </button>
              <button className={btnDanger} onClick={() => { pausedRef.current = false; setPaused(false); stopRef.current = true; }}>그만하기</button>
            </div>
          )}
        </div>
      )}

      {stage === "done" && (
        <div className="text-center">
          <div className="text-3xl mb-1">🎊</div>
          <p className="font-bold text-slate-800">연습 결과</p>
          <p className="text-2xl font-extrabold text-amber-600 my-1">{total}만원</p>
          {myResults.length > 0 ? (
            <p className="text-sm text-slate-500 mb-3">{myResults.map((r) => r.turn + "번째 → " + r.prize + "만원").join(" · ")}</p>
          ) : (
            <p className="text-sm text-slate-400 mb-3">돌린 룰렛이 없어요.</p>
          )}
          <div className="flex gap-2 justify-center pb-1">
            <button className={btnPrimary} onClick={() => hardReset("ask")}>다시하기</button>
            <button className={btnGhost} onClick={() => hardReset("idle")}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RouletteEventCard({ slots, leases, me, onChanged, onOpenLease, eventId }) {
  const [claim, setClaim] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!slots || slots.length === 0) return null; // 테이블 미생성 시 숨김

  // 칸의 실제 계약완료 상태: 이벤트에서 처리(slot) 또는 원본 매물에서 처리(lease) 모두 반영
  const effOf = (s) => {
    if (s.done_by) return { by: s.done_by, at: s.done_at, viaSlot: true };
    const l = s.lease_id ? (leases || []).find((x) => x.id === s.lease_id) : null;
    if (l && l.contract_done) return { by: l.contract_done_by || "계약완료", at: l.contract_done_at, viaSlot: false };
    return null;
  };
  const leaseOf = (s) => (s.lease_id ? (leases || []).find((x) => x.id === s.lease_id) : null);

  const today = rouletteToday();
  const doneCount = slots.filter((s) => effOf(s)).length;
  const allDone = doneCount === slots.length;
  const notStarted = today < ROULETTE_START;
  const expired = today > ROULETTE_END;
  const active = !notStarted && !expired && !allDone;
  const isMgr = ["manager", "admin"].includes(me.role);

  const openSlot = (s) => {
    const eff = effOf(s);
    if (!eff && !active) return;
    setErr("");
    if (!eff) setName(me.full_name || me.email || "");
    setClaim({ ...s, _eff: eff });
  };
  const doClaim = async () => {
    if (!name.trim()) { setErr("이름을 입력하세요."); return; }
    setBusy(true);
    const { data, error } = await sb.from("roulette_slots")
      .update({ done_by: name.trim(), done_at: new Date().toISOString(), done_by_user: me.user_id })
      .eq("idx", claim.idx).is("done_by", null).select();
    if (error) { setBusy(false); setErr(error.message); return; }
    if (!data || data.length === 0) { setBusy(false); setErr("이미 다른 분이 계약완료 처리했어요."); await onChanged(); return; }
    // 원본 매물도 계약완료 처리 → 축하 코너·실적 자동 반영 (실패해도 칸 처리는 유지)
    let warn = "";
    const l = leaseOf(claim);
    if (claim.lease_id && !(l && l.contract_done)) {
      const { error: e2 } = await sb.rpc("set_contract_done", { p_lease: claim.lease_id, p_done: true });
      if (e2) warn = "칸은 처리됐지만 원본 매물 계약완료 연동에 실패했습니다: " + e2.message + "\n매물 상세에서 직접 계약완료 처리해주세요.";
    }
    setBusy(false);
    setClaim(null);
    await onChanged();
    if (warn) alert(warn);
  };
  const undoClaim = async () => {
    if (!confirm(claim.building + " " + claim.room + " 계약완료(" + (claim._eff && claim._eff.by) + ")를 취소할까요?\n원본 매물의 계약완료(축하 코너·실적 포함)도 함께 취소됩니다.")) return;
    setBusy(true);
    if (claim.done_by) {
      const { error } = await sb.from("roulette_slots").update({ done_by: null, done_at: null, done_by_user: null }).eq("idx", claim.idx);
      if (error) { setBusy(false); setErr(error.message); return; }
    }
    const l = leaseOf(claim);
    if (l && l.contract_done) {
      const { error: e2 } = await sb.rpc("set_contract_done", { p_lease: claim.lease_id, p_done: false });
      if (e2) { setBusy(false); setErr("칸은 원복됐지만 원본 매물 계약완료 취소에 실패: " + e2.message); await onChanged(); return; }
    }
    setBusy(false);
    setClaim(null);
    await onChanged();
  };

  // 취소 가능: 관리인/관리자, 이벤트에서 본인이 처리한 칸(done_by_user), 원본에서 본인이 완료한 매물(이름 일치)
  const canUndo = !!(claim && claim._eff && (isMgr ||
    (claim._eff.viaSlot && claim.done_by_user && claim.done_by_user === me.user_id) ||
    (!claim._eff.viaSlot && claim._eff.by === (me.full_name || me.email))));

  return (
    <div className="bg-white rounded-2xl border-2 border-amber-300 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-800 text-lg break-keep">🎡 꽝 없는 룰렛 이벤트</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {ROULETTE_START.split("-").join(".")} ~ {ROULETTE_END.split("-").join(".")} · 모든 매물 계약 시 조기 종료
          </p>
        </div>
        {notStarted ? (
          <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 font-bold shrink-0">곧 시작!</span>
        ) : allDone && !expired ? (
          <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1 font-bold shrink-0">🎉 전 매물 계약! 조기 종료</span>
        ) : expired ? (
          <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2.5 py-1 font-bold shrink-0">종료</span>
        ) : (
          <span className="text-xs bg-rose-100 text-rose-600 border border-rose-200 rounded-full px-2.5 py-1 font-bold shrink-0 animate-pulse">진행중</span>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        🏆 <b className="text-amber-600">150만원 ×1</b> · 50만원 ×2 · 30만원 ×3 · 10만원 ×6 — 꽝 없음! · 계약완료 <b>{doneCount}</b> / {slots.length}
      </p>

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-3">
        {slots.map((s) => {
          const eff = effOf(s);
          return eff ? (
          <button key={s.idx} onClick={() => openSlot(s)}
            className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-1 py-2 text-center min-h-[68px] flex flex-col items-center justify-center">
            <span className="text-base leading-none">🎉</span>
            <span className="text-xs sm:text-sm font-bold text-emerald-700 break-keep leading-tight mt-0.5">{eff.by}</span>
            <span className="text-[9px] sm:text-[10px] text-emerald-500 line-through leading-tight mt-0.5">{s.building} {s.room}</span>
          </button>
        ) : (
          <button key={s.idx} onClick={() => openSlot(s)} disabled={!active}
            className={"rounded-xl border px-1 py-2 text-center min-h-[68px] flex flex-col items-center justify-center transition " +
              (active ? "border-amber-200 bg-amber-50 hover:bg-amber-100 active:scale-95" : "border-slate-200 bg-slate-50 opacity-60")}>
            <span className="text-xs sm:text-sm font-bold text-slate-700 break-keep leading-tight">{s.building}</span>
            <span className="text-[11px] sm:text-xs text-slate-500 leading-tight mt-0.5">{s.room}</span>
          </button>
        );})}
      </div>

      {isMgr && eventId && !active && !notStarted && (
        <button className="w-full mt-3 border border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-xl py-2.5 text-sm font-semibold text-slate-600"
          onClick={async () => {
            if (!confirm("이벤트 종료 처리할까요?\n12개 매물에 붙은 '이벤트' 배지가 일괄 해제됩니다.\n(이 룰렛 카드와 계약완료 기록은 그대로 남습니다)")) return;
            const { error } = await sb.from("events").delete().eq("id", eventId);
            if (error) alert("처리 실패: " + error.message);
            else await onChanged();
          }}>
          🏁 이벤트 종료 처리 — 매물 "이벤트" 배지 일괄 해제
        </button>
      )}

      <RoulettePractice />

      {claim && (
        <Modal title={claim._eff ? "계약완료 정보" : "🎡 계약완료 처리"} onClose={() => setClaim(null)}>
          <p className="text-center text-lg font-bold text-slate-800 mb-2">{claim.building} {claim.room}</p>
          {(() => {
            const l = leaseOf(claim);
            if (!l) return null;
            const bonus = [
              Number(l.bonus_landlord) > 0 ? "임대인 " + fmtMoney(l.bonus_landlord) + "만" : null,
              Number(l.bonus_tenant) > 0 ? "임차인 " + fmtMoney(l.bonus_tenant) + "만" : null,
              l.bonus_other || null,
            ].filter(Boolean).join(" · ");
            return (
              <div className="bg-slate-50 border rounded-xl p-3 mb-3 space-y-1">
                <div className="text-sm text-slate-700">
                  💰 보 <b>{fmtMoney(l.deposit)}</b> / 월 <b>{fmtMoney(l.monthly_rent)}</b>
                  {l.management_fee != null && l.management_fee !== "" ? <span> / 관 {fmtMoney(l.management_fee)}</span> : null}
                  <span className="text-slate-400 text-xs"> (만원{l._hope ? " · 희망가" : ""})</span>
                </div>
                <div className="text-xs text-slate-500">
                  {l.vacant ? "🟢 공실" : l.move_out ? "🟠 중도퇴실 예정 · 만기 " + (l.end_date || "-") : "만기 " + (l.end_date || "-")}
                  {l.vacant && l.door_code ? " · 🔑 " + l.door_code : ""}
                </div>
                {bonus && <div className="text-xs text-amber-700 font-semibold break-keep">🎁 중개보수 보너스: {bonus}</div>}
                {l.memo && <div className="text-xs text-slate-500 whitespace-pre-wrap break-keep border-t border-slate-200 pt-1.5">{l.memo}</div>}
                {onOpenLease && (
                  <button className="w-full !mt-2 border border-slate-300 bg-white rounded-lg py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-100"
                    onClick={() => { setClaim(null); onOpenLease(l); }}>📋 매물 상세정보 보기</button>
                )}
              </div>
            );
          })()}
          {claim._eff ? (
            <div className="text-center">
              <p className="text-sm text-slate-600">🎉 <b>{claim._eff.by}</b> 님이 계약했어요!</p>
              {claim._eff.at && <p className="text-xs text-slate-400 mt-1">{String(claim._eff.at).slice(0, 10)}</p>}
              {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
              <div className="flex gap-2 pt-4 pb-2">
                {canUndo && <button className={btnDanger + " flex-1"} onClick={undoClaim} disabled={busy}>{busy ? "처리 중..." : "계약완료 취소 (원본 포함)"}</button>}
                <button className={btnGhost + " flex-1"} onClick={() => setClaim(null)}>닫기</button>
              </div>
              {canUndo && <p className="text-[11px] text-slate-400 pb-1 break-keep">계약이 파기되었나요? 취소하면 이 칸이 다시 열리고, 원본 매물의 계약완료·축하 코너·실적도 함께 원복됩니다.</p>}
              {!canUndo && <p className="text-[11px] text-slate-400 pb-1 break-keep">취소(파기 원복)는 본인 또는 관리인만 할 수 있어요.</p>}
            </div>
          ) : (
            <div>
              <Field label="계약한 사람 이름 *">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
              </Field>
              <p className="text-xs text-slate-400 mb-2 break-keep">
                계약완료 처리하면 이 칸이 위 이름으로 바뀌고, <b className="text-slate-500">원본 매물도 계약완료 처리되어 축하 코너에 올라갑니다.</b>
                {claim.lease_id ? " (실적 기록은 " + (me.full_name || "처리자") + " 이름으로 남습니다)" : ""}
              </p>
              {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
              <div className="flex gap-2 pb-2">
                <button className={btnPrimary + " flex-1 py-3"} onClick={doClaim} disabled={busy}>{busy ? "처리 중..." : "🎉 계약완료"}</button>
                <button className={btnGhost} onClick={() => setClaim(null)}>취소</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
