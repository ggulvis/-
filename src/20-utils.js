/* 보담 — 유틸
   ⚠️ index.html의 로더가 «순서대로» 불러온다. 파일 사이에 선언을 옮길 때 순서를 같이 보라.
   (이 파일들은 babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ---------------- 유틸 ---------------- */
function dday(end) {
  if (!end) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const e = new Date(end + "T00:00:00");
  if (isNaN(e)) return null;
  return Math.round((e - t) / 86400000);
}
function ddayInfo(end) {
  const d = dday(end);
  if (d === null) return { label: "-", cls: "bg-slate-200 text-slate-600" };
  if (d < 0) return { label: "만료 " + Math.abs(d) + "일", cls: "bg-red-600 text-white" };
  if (d === 0) return { label: "D-DAY", cls: "bg-red-600 text-white" };
  if (d <= 30) return { label: "D-" + d, cls: "bg-red-100 text-red-700 border border-red-300" };
  if (d <= 90) return { label: "D-" + d, cls: "bg-amber-100 text-amber-700 border border-amber-300" };
  return { label: "D-" + d, cls: "bg-emerald-100 text-emerald-700 border border-emerald-300" };
}
function fmtMoney(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 10000) {
    const eok = Math.floor(n / 10000), man = n % 10000;
    return man ? `${eok}억 ${man.toLocaleString()}` : `${eok}억`;
  }
  return n.toLocaleString();
}
function fmtKRW(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 10000) {
    const eok = Math.floor(n / 10000), man = n % 10000;
    return man ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억`;
  }
  return n.toLocaleString() + "만원";
}
function fmtDate(d) { return d || "-"; }
function fmtRoom(r) { return r == null ? "" : String(r).replace(/\.0+$/, ""); } // "101.0" → "101"
function telHref(p) { return "tel:" + String(p).replace(/[^0-9+]/g, ""); }
function fmtIns(v) { return v === true ? "가입" : v === false ? "미가입" : "-"; }
function parseIns(v) { // 엑셀 텍스트 → boolean
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/미가입|없|아니|x|no|false|0/i.test(s)) return false;
  if (/가입|유|o|yes|true|1/i.test(s)) return true;
  return null;
}
function normDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) {
    const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, "0"), dd = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  if (typeof v === "number") { // 엑셀 시리얼 날짜
    const d = new Date(Math.round((v - 25569) * 86400000));
    return normDate(d);
  }
  const s = String(v).trim().replace(/[./]/g, "-").replace(/-+$/, "");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}
function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,\s원만]/g, ""));
  return isNaN(n) ? null : n;
}
let inactiveBuildingIds = new Set(); // 관리중단(active=false) 건물 id — 모든 정렬에서 항상 후순위(맨 뒤)
function leaseSort(a, b) {
  // 관리중단 건물은 모든 정렬에서 항상 맨 뒤(후순위)로
  const ai = inactiveBuildingIds.has(a.building_id), bi = inactiveBuildingIds.has(b.building_id);
  if (ai !== bi) return ai ? 1 : -1;
  // 공실을 최상단, 계약완료는 맨 뒤, 그 외에는 만기 임박순
  const av = !!a.vacant && !a.contract_done, bv = !!b.vacant && !b.contract_done;
  if (av !== bv) return av ? -1 : 1;
  if (!!a.contract_done !== !!b.contract_done) return a.contract_done ? 1 : -1;
  if (!a.end_date && !b.end_date) return 0;
  if (!a.end_date) return 1;
  if (!b.end_date) return -1;
  return a.end_date < b.end_date ? -1 : a.end_date > b.end_date ? 1 : 0;
}
// 만기일에 n년 더하기 (연장 빠른 설정용). 기준일 없으면 오늘부터
function addYears(dateStr, n) {
  const base = dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr) ? new Date(dateStr + "T00:00:00") : new Date();
  base.setFullYear(base.getFullYear() + n);
  const y = base.getFullYear(), m = String(base.getMonth() + 1).padStart(2, "0"), d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
// 날짜에 n개월 더하기 (월말 넘침 보정)
function addMonths(dateStr, n) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
  const base = new Date(dateStr + "T00:00:00");
  const day = base.getDate();
  base.setDate(1);
  base.setMonth(base.getMonth() + n);
  const dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(day, dim));
  const y = base.getFullYear(), m = String(base.getMonth() + 1).padStart(2, "0"), d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
// 두 날짜 사이 개월수 (입주~만기 = 계약기간). 월말·윤년 보정
function monthsBetween(a, b) {
  if (!a || !b || !/^\d{4}-\d{2}-\d{2}/.test(a) || !/^\d{4}-\d{2}-\d{2}/.test(b)) return 0;
  const s = new Date(a + "T00:00:00"), e = new Date(b + "T00:00:00");
  let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (m < 0) return 0;
  if (addMonths(a, m) > b) m -= 1; // 입주+m개월이 만기를 넘으면 1 줄임 (문자열 비교 안전)
  return m;
}
// 묵시적갱신: 만기일을 '원래 계약기간(입주~만기)'만큼 뒤로 연장. 계산 불가 시 null
function impliedRenewEnd(start, end) {
  const months = monthsBetween(start, end);
  if (months <= 0) return null;
  return addMonths(end, months);
}

/* 지역 분류 (건물 주소 기반) */
const REGION_TABS = [["all", "전체"], ["dongjak", "동작구"], ["gwanak", "관악구"], ["guro", "구로금천"]];
const REGION_SUBS = { all: [], dongjak: ["전체", "사당동", "상도동", "기타"], gwanak: ["전체", "봉천동", "신림동"], guro: ["전체"] };
function regionOf(b) {
  const a = (b.address || "") + " " + (b.name || "");
  if (/사당동|상도동|신대방동|대방동|동작구/.test(a)) return "dongjak";
  if (/봉천동|신림동|관악구/.test(a)) return "gwanak";
  if (/구로구|금천구|구로동|가산동|독산동/.test(a)) return "guro";
  return "etc";
}
function subAreaOf(b) {
  const a = b.address || "";
  if (a.includes("사당동")) return "사당동";
  if (a.includes("상도동")) return "상도동";
  if (a.includes("봉천동")) return "봉천동";
  if (a.includes("신림동")) return "신림동";
  return "기타";
}

/* 중복 검출
   - 완전 중복: 건물+호수+임차인+입주일+만기일이 모두 동일 → 재업로드 등으로 생긴 사본
   - 의심 중복: 건물+호수+보증금+월세가 동일하지만 나머지가 다름 → 사람이 확인 필요
   ※ 같은 호수라도 보증금/월세 금액이 다르면(전세·월세 병행 등) 중복으로 잡지 않음 */
/* 계약서 OCR 텍스트에서 정보 추출 (보조용 — 승인 시 사람이 확인) */
function parseMoneyToMan(s) {
  s = String(s || "").replace(/\s/g, "");
  let man = 0, matched = false;
  const eok = s.match(/([0-9,]+)억/);
  if (eok) { man += parseInt(eok[1].replace(/,/g, ""), 10) * 10000; matched = true; s = s.split("억")[1] || ""; }
  const manM = s.match(/([0-9,]+)만/);
  if (manM) { man += parseInt(manM[1].replace(/,/g, ""), 10); matched = true; }
  if (!matched) {
    const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
    if (!n) return null;
    man = n >= 1000000 ? Math.round(n / 10000) : n; // 원 단위 큰 숫자는 만원 환산
  }
  return man || null;
}
function parseContractText(t) {
  const out = {};
  const dates = [...t.matchAll(/(20\d{2})\s*[년.\-\/]\s*(\d{1,2})\s*[월.\-\/]\s*(\d{1,2})/g)]
    .map((m) => `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`);
  const uniq = [...new Set(dates)].sort();
  if (uniq.length >= 2) { out.start_date = uniq[0]; out.end_date = uniq[uniq.length - 1]; }
  else if (uniq.length === 1) { out.end_date = uniq[0]; }
  const money = (kw) => {
    const m = t.match(new RegExp(kw + "[^0-9억]{0,15}([0-9,억\\s]+(?:만)?)"));
    return m ? parseMoneyToMan(m[1]) : null;
  };
  out.deposit = money("보증금");
  out.rent = money("월세") ?? money("차임");
  out.management_fee = money("관리비");
  const ph = t.match(/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/);
  if (ph) out.tenant_phone = ph[0].replace(/[.\s]/g, "-");
  return out;
}

function fileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
async function downscaleImage(file, maxDim) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    if (scale >= 1 && file.size < 3500000) return file;
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
    return blob || file;
  } catch (e) { return file; }
}

function exactKey(l) {
  return [l.building_id, (l.room_number || "").trim(), (l.tenant_name || "").trim(), l.start_date || "", l.end_date || ""].join("|");
}
function findDupGroups(leases) {
  const exact = {}, amount = {};
  leases.forEach((l) => {
    const ek = exactKey(l);
    (exact[ek] = exact[ek] || []).push(l);
    const sk = [l.building_id, (l.room_number || "").trim(), l.deposit ?? "", l.monthly_rent ?? ""].join("|");
    (amount[sk] = amount[sk] || []).push(l);
  });
  const exactGroups = Object.values(exact).filter((g) => g.length > 1);
  const suspectGroups = Object.values(amount).filter((g) => {
    if (g.length < 2) return false;
    return new Set(g.map(exactKey)).size > 1; // 전부 동일하면 완전 중복 쪽에서 처리
  });
  return { exactGroups, suspectGroups };
}
