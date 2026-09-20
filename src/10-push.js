/* 보담 — 푸시 알림
   ⚠️ index.html의 로더가 «순서대로» 불러온다. 파일 사이에 선언을 옮길 때 순서를 같이 보라.
   (이 파일들은 babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 푸시 알림 (앱이 꺼져 있어도 잠금화면 알림) ---------------- */
const VAPID_PUBLIC = "BAH6PJJA0pHDquA3FmZumQ-chSkXz8XDyCtEZMUVnL_4o0flCebGe9BiWzs5qojsiGPSfyrPDnAwZtImgw6RQFA";
/* 삼성 인터넷 감지 — 이 브라우저는 강제 다크를 페이지가 막을 수 없다(크롬은 정상) */
const isSamsungBrowser = () => /SamsungBrowser/i.test(navigator.userAgent);
/* 기기가 지금 다크모드인가. 삼성 인터넷이 화면을 뒤집는 건 감지할 수 없지만,
   대다수는 다크모드를 자동(낮 라이트/밤 다크)으로 쓰므로 이걸로 갈음한다. */
const prefersDark = () => {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; }
};
/* 현재 주소를 크롬으로 여는 안드로이드 intent 링크. 크롬이 없으면 원래 주소로 폴백 */
const chromeIntentUrl = () => {
  const u = location.href.replace(/^https?:\/\//, "");
  return "intent://" + u + "#Intent;scheme=https;package=com.android.chrome;" +
    "S.browser_fallback_url=" + encodeURIComponent(location.href) + ";end";
};
const pushSupported = () => typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
// iOS는 홈 화면에 추가된 PWA(standalone)에서만 푸시 가능
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function getSWRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch (e) { return null; }
}
async function savePushSub(profile, sub) {
  const j = sub.toJSON();
  return await sb.from("push_subscriptions").upsert({
    user_id: profile.user_id, endpoint: sub.endpoint,
    p256dh: j.keys.p256dh, auth: j.keys.auth, user_name: profile.full_name || profile.email,
  }, { onConflict: "endpoint" });
}
async function subscribePush(profile) {
  const reg = await getSWRegistration();
  if (!reg) throw new Error("서비스 워커 등록 실패");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("알림 권한이 허용되지 않았어요.");
  const newSub = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) });
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await newSub();
  let { error } = await savePushSub(profile, sub);
  if (error) {
    // 이 기기가 예전에 '다른 계정'으로 등록돼 있으면 endpoint 충돌 → RLS가 막음.
    // 기존 구독을 해지하고 새 endpoint를 발급받아 내 계정으로 다시 등록 (자가복구)
    try { await sub.unsubscribe(); } catch (e) {}
    sub = await newSub();
    const retry = await savePushSub(profile, sub);
    if (retry.error) throw retry.error;
  }
  return true;
}
// 브라우저엔 구독이 있는데 DB(내 계정)엔 행이 없는 상태를 자동 복구.
// 계정을 바꿔 로그인한 기기가 "알림 켜짐"으로 보이면서 실제론 안 오던 문제 방지.
async function ensurePushRow(profile) {
  try {
    if (!profile || !profile.user_id) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub || Notification.permission !== "granted") return false;
    const { data } = await sb.from("push_subscriptions").select("endpoint")
      .eq("user_id", profile.user_id).eq("endpoint", sub.endpoint).maybeSingle();
    if (data) return true;
    await subscribePush(profile);
    return true;
  } catch (e) { return false; }
}
async function unsubscribePush(profile) {
  const reg = await getSWRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) { try { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); } catch (e) {} await sub.unsubscribe(); }
}
async function isPushSubscribed() {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    return !!sub && Notification.permission === "granted";
  } catch (e) { return false; }
}
// 축하 반응/댓글 후 피축하자에게 푸시 발송 (실패해도 무시 — 인앱 토스트가 폴백)
async function firePush(lease_id, text) {
  try { await sb.functions.invoke("send-celebration-push", { body: { lease_id, text } }); } catch (e) { /* 무시 */ }
}
