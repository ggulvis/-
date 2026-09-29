// Supabase 모의 — 진짜 DB를 건드리지 않고 앱을 끝까지 돌린다.
//
// 왜 모의인가: 로그인이 Google OAuth 단독이라 자동화로 진짜 로그인을 할 수 없고,
// 「계약 저장」을 진짜로 하면 운영 DB에 시험용 행이 남는다.
// 그래서 세션은 브라우저 저장소에 심고, supabase 호출은 전부 가로챈다.
//
// ⚠️ 이 파일은 «앱이 뜨는가·화면이 그려지는가·저장 요청이 나가는가»를 지킨다.
//    RLS·권한·실제 컬럼 제약은 안 지킨다(그건 진짜 DB로만 잴 수 있다).
const fs = require('fs');
const path = require('path');

const INDEX_HTML = path.join(__dirname, '..', '..', 'index.html');

// 주소를 여기 또 적지 않는다 — index.html이 원본이다(두 곳에 적으면 갈린다).
function readSupabaseUrl() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const m = html.match(/const\s+SUPABASE_URL\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('index.html에서 SUPABASE_URL을 못 찾았다 — 어디를 가로챌지 알 수 없다');
  return m[1];
}

const TEST_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'smoke@example.test',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: { full_name: '스모크 관리자', name: '스모크 관리자' },
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const BUILDING = {
  id: 'bld-smoke-0001',
  name: '스모크빌딩',
  address: '서울시 시험구 시험로 1',
  active: true,
  options: [],
};

const LEASE = {
  id: 'lease-smoke-0001',
  building_id: BUILDING.id,
  room_number: '101',
  tenant_name: '홍길동',
  tenant_phone: '010-0000-0000',
  start_date: '2026-01-01',
  end_date: '2027-01-01',
  deposit: 10000000,
  monthly_rent: 500000,
  management_fee: 50000,
  hope_deposit: null, hope_rent: null, hope_fee: null,
  insurance: false, insurance_pending: false,
  door_code: null, memo: null,
  custom_data: {}, tags: [],
  move_out: false, vacant: false,
  contract_done: false, contract_done_by: null, contract_done_at: null,
  event_id: null, term_months: 12,
};

const USER_ROLE = {
  id: 'role-smoke-0001',
  user_id: TEST_USER.id,
  email: TEST_USER.email,
  full_name: '스모크 관리자',
  phone: '010-0000-0000',
  affiliation: '시험부동산',
  role: 'admin',     // 계약 저장까지 가려면 manager 이상이어야 한다
  status: 'active',  // active가 아니면 PendingScreen에서 막힌다
};

function session() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'smoke-access-token',
    token_type: 'bearer',
    expires_in: 31536000,
    expires_at: now + 31536000,   // 만료 임박이면 새로고침을 시도한다 — 멀리 둔다
    refresh_token: 'smoke-refresh-token',
    user: TEST_USER,
  };
}

// PostgREST는 maybeSingle()일 때 Accept 헤더로 «객체 하나»를 요구한다.
const wantsObject = (headers) =>
  String(headers['accept'] || '').includes('vnd.pgrst.object');

const NO_ROWS = {
  code: 'PGRST116',
  details: 'The result contains 0 rows',
  hint: null,
  message: 'JSON object requested, multiple (or no) rows returned',
};

/**
 * overrides.persist 가 켜진 테이블에 쓰기를 실제로 반영한다 — 저장 뒤 다시 읽는 화면을 시험할 때 쓴다.
 * upsert 는 on_conflict 칸(없으면 id)으로 같은 행을 찾고, ignore-duplicates 면 건너뛴다(응답에서도 뺀다).
 * 필터·정렬·페이지는 흉내 내지 않는다(읽기는 늘 전체를 준다).
 */
let seq = 0;
function applyWrite(rows, method, body, search, prefer) {
  const params = new URLSearchParams(search);
  if (method === 'DELETE') {
    const [col, cond] = [...params.entries()].find(([k, v]) => v.startsWith('eq.')) || [];
    if (!col) return [];
    const val = cond.slice(3);
    const gone = rows.filter((r) => String(r[col]) === val);
    for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][col]) === val) rows.splice(i, 1);
    return gone;
  }
  if (method !== 'POST') return Array.isArray(body) ? body : [body];
  const keys = (params.get('on_conflict') || 'id').split(',');
  const ignore = prefer.includes('ignore-duplicates');
  const upsert = prefer.includes('resolution=');
  const out = [];
  for (const row of Array.isArray(body) ? body : [body]) {
    const hit = upsert && keys.every((k) => row[k] != null)
      ? rows.find((r) => keys.every((k) => String(r[k]) === String(row[k]))) : null;
    if (hit) {
      if (ignore) continue;
      Object.assign(hit, row);
      out.push(hit);
    } else {
      const fresh = Object.assign({ id: `mock-${++seq}` }, row);
      rows.push(fresh);
      out.push(fresh);
    }
  }
  return out;
}

/**
 * 앱이 supabase로 보내는 모든 요청을 가로챈다.
 * overrides.tables    — 테이블 초기 행
 * overrides.persist   — 쓰기를 반영할 테이블 이름 목록
 * overrides.functions — Edge Function 이름 → (본문) => 응답 본문. 없는 함수는 404
 * @returns {{writes: Array, calls: Array, tables: Object, user: Object}} writes = 쓰기 요청, calls = 함수 호출 기록
 */
async function installSupabaseMock(context, overrides = {}) {
  const url = new URL(readSupabaseUrl());
  const ref = url.hostname.split('.')[0];

  const tables = Object.assign(
    { buildings: [BUILDING], leases: [LEASE], user_roles: [USER_ROLE] },
    overrides.tables || {}
  );
  const persist = new Set(overrides.persist || []);
  const functions = overrides.functions || {};
  const writes = [];
  const calls = [];

  // 세션 심기 — 앱 스크립트보다 먼저 돈다.
  await context.addInitScript(
    ([key, value]) => {
      try { window.localStorage.setItem(key, value); } catch (e) {}
    },
    [`sb-${ref}-auth-token`, JSON.stringify(session())]
  );

  await context.route(`**://${url.host}/**`, async (route) => {
    const req = route.request();
    const reqUrl = new URL(req.url());
    const p = reqUrl.pathname;
    const headers = req.headers();
    const json = (body, status = 200, extra = {}) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: Object.assign({ 'access-control-allow-origin': '*' }, extra),
        body: JSON.stringify(body),
      });

    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, body: '' });

    // 인증 — 토큰 새로고침/사용자 조회만 온다(로그인 자체는 앱이 OAuth로 한다)
    if (p.startsWith('/auth/v1/user')) return json(TEST_USER);
    if (p.startsWith('/auth/v1/token')) return json(session());
    if (p.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });

    // 저장 프로시저 — 있는 척만 한다
    if (p.startsWith('/rest/v1/rpc/')) return json(null);

    // Edge Function — 시험이 준 처리기만 있다
    if (p.startsWith('/functions/v1/')) {
      const name = p.replace('/functions/v1/', '').split('/')[0];
      let body = null;
      try { body = req.postDataJSON(); } catch (e) { body = req.postData(); }
      calls.push({ name, body });
      if (!functions[name]) return json({ code: 'NOT_FOUND', message: 'Requested function was not found' }, 404);
      return json(await functions[name](body));
    }

    if (p.startsWith('/rest/v1/')) {
      const table = p.replace('/rest/v1/', '').split('?')[0];
      const method = req.method();

      if (method !== 'GET' && method !== 'HEAD') {
        let body = null;
        try { body = req.postDataJSON(); } catch (e) { body = req.postData(); }
        writes.push({ table, method, body, search: reqUrl.search });
        const prefer = String(headers['prefer'] || '');
        let rows = Array.isArray(body) ? body : [body];
        if (persist.has(table)) rows = applyWrite(tables[table] = tables[table] || [], method, body, reqUrl.search, prefer);
        // Prefer: return=minimal 이면 PostgREST는 빈 201을 준다
        if (prefer.includes('return=minimal')) return route.fulfill({ status: 201, body: '' });
        return json(rows, method === 'POST' ? 201 : 200);
      }

      const rows = tables[table] || [];
      if (wantsObject(headers)) {
        return rows.length ? json(rows[0]) : json(NO_ROWS, 406);
      }
      return json(rows, 200, { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }

    // 나머지(스토리지·실시간 등)는 조용히 비운다
    return json({});
  });

  return { writes, calls, tables, user: TEST_USER, building: BUILDING, lease: LEASE, role: USER_ROLE };
}

module.exports = { installSupabaseMock, TEST_USER, BUILDING, LEASE, USER_ROLE };
