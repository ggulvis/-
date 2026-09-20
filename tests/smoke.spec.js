// 스모크 테스트 1개 — 「앱이 살아 있는가」만 본다.
// 로드 → 로그인(세션) 통과 → 목록 렌더 → 계약 저장, 이 네 관문 중 하나라도 막히면 빨간불.
//
// 이 테스트가 있는 이유: index.html을 모듈로 쪼갤 때 «쪼개다 깨진 것»을 잡는 그물이다.
// 문법 오류는 validate.js가 잡지만, 문법이 멀쩡한 채 화면이 안 그려지는 것은 못 잡는다.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('./fixtures/supabase-mock');

// 앱 잘못이 아닌 소음 — 서비스워커는 테스트에서 일부러 막아 뒀다.
const NOISE = /ServiceWorker|service worker|sw\.js|favicon|Tailwind CDN|cdn\.tailwindcss\.com/i;

test('스모크: 로드 → 로그인 → 목록 렌더 → 계약 저장', async ({ page, context }) => {
  const mock = await installSupabaseMock(context);

  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(`console.error: ${m.text()}`);
  });

  // ① 로드 — babel이 5천 줄을 컴파일하고 React가 뜬다
  await page.goto('/index.html');
  await expect(page.locator('#root')).not.toBeEmpty();

  // ② 로그인 통과 — 세션이 먹혔으면 로그인 화면이 아니라 모드 선택이 나온다
  await expect(page.getByText('Google 계정으로 로그인')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '어떤 모드로 시작할까요?' })).toBeVisible();
  await page.getByRole('button', { name: /임대 홈/ }).click();

  // ③ 목록 렌더 — 건물 카드와 그 안의 호수가 보인다
  const card = page.getByText('스모크빌딩', { exact: false }).first();
  await expect(card).toBeVisible();
  await expect(page.getByText('1건').first()).toBeVisible();

  // ④ 계약 저장 — 건물로 들어가 임대정보를 하나 넣는다
  await card.click();
  await page.getByRole('button', { name: '+ 임대정보 등록' }).first().click();
  await expect(page.getByRole('heading', { name: '임대 정보 추가' })).toBeVisible();

  await page.getByLabel('호수 *').fill('999');
  await page.getByLabel('임차인명').fill('스모크 임차인');
  await page.getByRole('button', { name: '저장', exact: true }).click();

  // 저장 요청이 «실제로 나갔는지»를 본다 — 화면이 닫힌 것만으로는 부족하다
  await expect
    .poll(() => mock.writes.filter((w) => w.table === 'leases' && w.method === 'POST').length, {
      message: 'leases INSERT 요청이 나가지 않았다',
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  const insert = mock.writes.find((w) => w.table === 'leases' && w.method === 'POST');
  const row = Array.isArray(insert.body) ? insert.body[0] : insert.body;
  expect(row.room_number).toBe('999');
  expect(row.tenant_name).toBe('스모크 임차인');
  expect(row.building_id).toBe(mock.building.id);

  // 저장이 끝나면 폼이 닫힌다
  await expect(page.getByRole('heading', { name: '임대 정보 추가' })).toHaveCount(0);

  expect(errors, `콘솔/런타임 오류:\n${errors.join('\n')}`).toEqual([]);
});
