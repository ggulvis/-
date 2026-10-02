/* 보담 — 루트
   ⚠️ index.html의 로더가 «순서대로» 부른다. 선언을 옮길 때 순서를 같이 보라.
   (babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 루트 ---------------- */
function App() {
  const [session, setSession] = useState(undefined); // undefined=확인중, null=미로그인
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = async (uid) => {
    let { data } = await sb.from("user_roles").select("*").eq("user_id", uid).maybeSingle();
    if (!data && session) {
      // 예전에 이메일로만 등록된 행 연결
      const { data: byEmail } = await sb.from("user_roles").select("*").eq("email", session.user.email).maybeSingle();
      if (byEmail) {
        await sb.from("user_roles").update({ user_id: uid }).eq("id", byEmail.id);
        data = { ...byEmail, user_id: uid };
      }
    }
    if (!data && session) {
      // 신규: 로그인만으로 자동 대기 등록 (폼 없이) — 관리자가 즉시 명단에서 보고 승인. 이름은 구글에서 자동
      const gname = (session.user.user_metadata && (session.user.user_metadata.full_name || session.user.user_metadata.name)) || "";
      await sb.from("user_roles").upsert(
        { user_id: uid, email: session.user.email, full_name: gname, role: "viewer", status: "pending" },
        { onConflict: "email" }
      );
      const re = await sb.from("user_roles").select("*").eq("user_id", uid).maybeSingle();
      data = re.data || null;
    }
    setProfile(data || null);
  };
  useEffect(() => {
    if (session) loadProfile(session.user.id); else setProfile(undefined);
  }, [session && session.user.id]);

  if (!IS_CONFIGURED) return <SetupScreen />;
  if (session === undefined) return <div className="screen-h flex items-center justify-center text-slate-400">확인 중...</div>;
  if (!session) return <LoginScreen />;
  if (profile === undefined) return <div className="screen-h flex items-center justify-center text-slate-400">프로필 확인 중...</div>;
  if (profile === null) return <RegisterScreen session={session} onDone={() => loadProfile(session.user.id)} />;
  if (profile.status !== "active") return <PendingScreen profile={profile} onUpdated={() => loadProfile(session.user.id)} />;
  return <MainApp session={session} profile={profile} onProfileChanged={() => loadProfile(session.user.id)} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
