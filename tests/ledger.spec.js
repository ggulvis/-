// 장부 — 가져오기 → 자동 분류 → AI 분류 → 사람이 고침 → 저장 → 합계 → 다시 올려도 중복 없음
//
// 진짜 AI 는 부르지 않는다. Edge Function 은 목업이 대신 답한다(«AI 가 분류한 척»).
// 여기서 지키는 것: 분류 순서(세대 매칭·키워드·AI·사람)와 «카드값 이중계상 방지», 중복 방지, 합계 숫자.
const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('./fixtures/supabase-mock');

const NOISE = /ServiceWorker|service worker|sw\.js|favicon|Tailwind CDN|cdn\.tailwindcss\.com/i;

// 은행 엑셀에서 머리 줄까지 표째 복사한 모양 (탭 구분)
const BANK = [
  ['거래일시', '적요', '출금액', '입금액', '잔액'],
  ['2026-09-01 10:00:00', '홍길동101', '', '550,000', '10,550,000'],   // 세입자 월세 → 임대료 수입(세대)
  ['2026-09-02 09:00:00', '한국전력공사', '123,450', '', '10,426,550'], // 키워드 → 수도광열비
  ['2026-09-03 09:00:00', '삼성카드', '300,000', '', '10,126,550'],     // 카드값 → 경비 아님(이중계상 방지)
  ['2026-09-04 09:00:00', 'ABC상사', '45,000', '', '10,081,550'],       // 아무도 모름 → AI
].map((r) => r.join('\t')).join('\n');

test('장부: 가져오기 → 자동·AI 분류 → 저장 → 합계 → 중복 방지', async ({ page, context }) => {
  const mock = await installSupabaseMock(context, {
    tables: { ledger_entries: [], ledger_rules: [], payer_alias: [] },
    persist: ['ledger_entries', 'ledger_rules'],
    functions: {
      'ledger-classify': (body) => ({
        results: body.items.map((i) => ({ id: i.id, category: 'supplies', confidence: 'low', reason: '시험 응답' })),
      }),
    },
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(`console.error: ${m.text()}`);
  });
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

  await page.goto('/index.html');
  await page.getByRole('button', { name: /관리모드/ }).first().click();
  await page.getByRole('button', { name: /장부 · 세무/ }).click();
  await expect(page.getByRole('heading', { name: '📒 장부 · 세무' })).toBeVisible();
  await expect(page.getByText(/거래가 아직 없습니다/)).toBeVisible();

  // ① 가져오기 → 분석
  await page.getByRole('button', { name: '📥 내역 가져오기' }).click();
  await page.getByPlaceholder('예: 신한 임대료통장').fill('시험통장');
  await page.locator('textarea').fill(BANK);
  await page.getByRole('button', { name: '분석하기' }).click();

  const rows = page.getByTestId('ledger-import-row');
  await expect(rows).toHaveCount(4);
  const cat = (i) => rows.nth(i).getByLabel('계정과목');
  await expect(cat(0)).toHaveValue('rent');           // 세입자 매칭
  await expect(cat(1)).toHaveValue('utilities');      // 키워드
  await expect(cat(2)).toHaveValue('card_payment');   // 카드값은 경비가 아니다
  await expect(cat(3)).toHaveValue('');               // 미분류

  // ② AI — 미분류만 보낸다
  await page.getByRole('button', { name: /미분류 1건 AI로 분류/ }).click();
  await expect(cat(3)).toHaveValue('supplies');
  expect(mock.calls).toHaveLength(1);
  expect(mock.calls[0].body.items.map((i) => i.description)).toEqual(['ABC상사']);
  expect(mock.calls[0].body.categories.some((c) => c.key === 'rent')).toBe(true);
  await expect(rows.nth(3).getByText('AI?')).toBeVisible();   // 확신 낮음 표시

  // ③ 사람이 고친다 → 규칙으로 기억
  await cat(3).selectOption('other_expense');

  // ④ 저장
  await page.getByRole('button', { name: '저장 (4건)' }).click();
  await expect.poll(() => dialogs.find((m) => m.includes('장부에 넣었습니다'))).toContain('4건을 장부에 넣었습니다');

  const saved = mock.tables.ledger_entries;
  expect(saved).toHaveLength(4);
  const by = Object.fromEntries(saved.map((e) => [e.description, e]));
  expect(by['홍길동101']).toMatchObject({ direction: 'in', amount: 550000, category: 'rent', cat_by: 'lease', lease_id: mock.lease.id, balance: 10550000 });
  expect(by['한국전력공사']).toMatchObject({ direction: 'out', amount: 123450, category: 'utilities', cat_by: 'rule' });
  expect(by['삼성카드']).toMatchObject({ category: 'card_payment' });
  expect(by['ABC상사']).toMatchObject({ category: 'other_expense', cat_by: 'human', account_label: '시험통장' });
  expect(mock.tables.ledger_rules).toEqual([expect.objectContaining({ direction: 'out', pattern: 'abc상사', category: 'other_expense' })]);

  // ⑤ 합계 — 수입 55만, 경비 = 전기 123,450 + 기타 45,000 (카드값 30만은 빠진다)
  await expect(page.getByTestId('ledger-row')).toHaveCount(4);
  await expect(page.getByText('550,000원').first()).toBeVisible();
  await expect(page.getByText('168,450원').first()).toBeVisible();
  await expect(page.getByText('381,550원').first()).toBeVisible();

  // ⑥ 같은 내역을 또 올려도 한 건도 늘지 않는다
  await page.getByRole('button', { name: '📥 내역 가져오기' }).click();
  await page.locator('textarea').fill(BANK);
  await page.getByRole('button', { name: '분석하기' }).click();
  await expect(cat(3)).toHaveValue('other_expense');    // 방금 배운 규칙이 붙는다
  await page.getByRole('button', { name: '저장 (4건)' }).click();
  await expect.poll(() => dialogs.filter((m) => m.includes('장부에 넣었습니다')).length).toBe(2);
  expect(dialogs[dialogs.length - 1]).toContain('0건을 장부에 넣었습니다');
  expect(dialogs[dialogs.length - 1]).toContain('이미 있던 4건은 건너뜀');
  expect(mock.tables.ledger_entries).toHaveLength(4);

  // ⑦ 신고 준비 — 이 규모면 간편장부 대상
  await page.getByRole('button', { name: '🧾 신고 준비' }).click();
  await expect(page.getByText(/간편장부대상자/)).toBeVisible();
  await expect(page.getByText(/사업장현황신고/)).toBeVisible();

  expect(errors, `콘솔/런타임 오류:\n${errors.join('\n')}`).toEqual([]);
});

// 카드사 CSV — 한국 카드사·은행 CSV 는 EUC-KR 이 흔하다. 위에 제목 줄, 아래 합계 줄이 붙어 있다.
//   이용일자,가맹점명,이용금액,취소여부
//   2026.09.05 GS칼텍스 강남주유소 65,000 / 09.06 다이소 12,000 / 09.07 다이소 12,000 취소 / 09.08 스타벅스 6,500 / 합계
const CARD_CSV_EUCKR = 'xKu15bvnIMDMv+uzu7+qCgrAzL/rwM/A2iywobjNwaG47SzAzL/rsd2+1yzD67zSv6m6zgoyMDI2LjA5LjA1LEdTxK7F2L26ILCts7LB1sCvvNIsIjY1LDAwMCIsCjIwMjYuMDkuMDYstNnAzLzSIL+qu+/BoSwiMTIsMDAwIiwKMjAyNi4wOS4wNyy02cDMvNIgv6q778GhLCIxMiwwMDAiLMPrvNIKMjAyNi4wOS4wOCy9usW4ufe9uiC/qrvvLCI2LDUwMCIsCsfVsOgsLCI5NSw1MDAiLAo=';

test('장부: 카드사 CSV(EUC-KR) — 취소는 산 것과 같은 과목으로 상쇄된다', async ({ page, context }) => {
  const mock = await installSupabaseMock(context, {
    tables: { ledger_entries: [], ledger_rules: [], payer_alias: [] },
    persist: ['ledger_entries', 'ledger_rules'],
  });
  page.on('dialog', (d) => d.accept());
  await page.goto('/index.html');
  await page.getByRole('button', { name: /관리모드/ }).first().click();
  await page.getByRole('button', { name: /장부 · 세무/ }).click();
  await page.getByRole('button', { name: '📥 내역 가져오기' }).click();
  await page.getByRole('button', { name: '💳 카드 내역' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'card.csv', mimeType: 'text/csv', buffer: Buffer.from(CARD_CSV_EUCKR, 'base64') });
  await page.getByRole('button', { name: '분석하기' }).click();

  const rows = page.getByTestId('ledger-import-row');
  await expect(rows).toHaveCount(4);                     // 제목·합계 줄은 빠진다
  await expect(rows.nth(0)).toContainText('GS칼텍스 강남주유소');   // 한글이 깨지지 않았다
  await expect(rows.nth(0).getByLabel('계정과목')).toHaveValue('vehicle');
  await expect(rows.nth(1).getByLabel('계정과목')).toHaveValue('supplies');
  await expect(rows.nth(2).getByLabel('계정과목')).toHaveValue('supplies');   // 취소도 같은 과목
  await expect(rows.nth(3).getByLabel('계정과목')).toHaveValue('');           // 스타벅스 — 사람·AI 몫
  await page.getByRole('button', { name: '저장 (4건)' }).click();
  await expect(page.getByTestId('ledger-row')).toHaveCount(4);

  const saved = mock.tables.ledger_entries;
  expect(saved.map((e) => [e.entry_date, e.direction, e.amount, e.source])).toEqual([
    ['2026-09-05', 'out', 65000, 'card'], ['2026-09-06', 'out', 12000, 'card'],
    ['2026-09-07', 'in', 12000, 'card'], ['2026-09-08', 'out', 6500, 'card'],
  ]);
  // 경비 = 주유 65,000 + (다이소 12,000 − 취소 12,000) = 65,000
  await expect(page.getByText('65,000원').first()).toBeVisible();
});

test('장부: AI 함수가 아직 없으면 그렇다고 알려준다', async ({ page, context }) => {
  await installSupabaseMock(context, {
    tables: { ledger_entries: [], ledger_rules: [], payer_alias: [] },
    persist: ['ledger_entries', 'ledger_rules'],
  });
  page.on('dialog', (d) => d.accept());
  await page.goto('/index.html');
  await page.getByRole('button', { name: /관리모드/ }).first().click();
  await page.getByRole('button', { name: /장부 · 세무/ }).click();
  await page.getByRole('button', { name: '📥 내역 가져오기' }).click();
  await page.locator('textarea').fill(BANK);
  await page.getByRole('button', { name: '분석하기' }).click();
  await page.getByRole('button', { name: /미분류 1건 AI로 분류/ }).click();
  await expect(page.getByText('AI 분류 함수(ledger-classify)가 아직 배포되지 않았습니다.')).toBeVisible();
  // AI 가 없어도 저장은 된다 — 미분류는 미분류로 남는다
  await page.getByRole('button', { name: '저장 (4건)' }).click();
  await expect(page.getByTestId('ledger-row')).toHaveCount(4);
  await expect(page.getByText(/미분류 1건/).first()).toBeVisible();
});

test('장부: 테이블이 없으면 설정 방법을 안내한다', async ({ page, context }) => {
  await installSupabaseMock(context, { tables: { payer_alias: [] } });
  // ledger_entries 를 «없는 테이블»로 만든다 — PostgREST 가 주는 그 오류
  await context.route('**/rest/v1/ledger_entries**', (route) => route.fulfill({
    status: 404, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.ledger_entries' in the schema cache" }),
  }));
  await page.goto('/index.html');
  await page.getByRole('button', { name: /관리모드/ }).first().click();
  await page.getByRole('button', { name: /장부 · 세무/ }).click();
  await expect(page.getByText('장부 테이블이 아직 없습니다.')).toBeVisible();
  await expect(page.getByText('supabase/ledger.sql')).toBeVisible();
});
