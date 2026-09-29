# 📒 장부 · 세무 — 설정

관리모드 → 「장부 · 세무」 (관리자만 보입니다).

## 1. 테이블 만들기 (필수, 1회)

Supabase 대시보드 → **SQL Editor** → `ledger.sql` 내용을 통째로 붙여넣고 **Run**.
여러 번 실행해도 안전합니다. 장부 테이블은 **관리자(admin)만** 읽고 쓸 수 있습니다.

## 2. AI 자동 분류 켜기 (선택)

AI 없이도 장부는 동작합니다(세입자 입금·키워드·사람이 가르친 규칙으로 분류).
규칙으로 못 맞춘 거래를 AI가 분류하게 하려면:

1. [console.anthropic.com](https://console.anthropic.com) 에서 API 키를 만듭니다.
2. Supabase 대시보드 → **Edge Functions → Secrets** → `ANTHROPIC_API_KEY` 에 키를 넣습니다.
3. **Edge Functions → Deploy a new function → Via Editor** → 이름을 `ledger-classify` 로 하고
   `functions/ledger-classify/index.ts` 내용을 붙여넣어 배포합니다.
   (Supabase CLI를 쓰면: `supabase functions deploy ledger-classify`)

- 모델: Claude Opus 5.5, 노력도 low. 미분류 거래만, 80건씩 보냅니다.
- 보내는 것: 날짜·금액·입출금 방향·적요. 적요에 사람 이름이 들어 있을 수 있어 보내기 전에 확인을 받습니다.
- 함수는 호출한 사람이 관리자인지 먼저 확인합니다.

## 분류 순서

1. 사람이 고친 규칙 — 한 번 고치면 같은 적요는 다음부터 자동
2. 세입자 입금 — 미납 관리와 같은 매칭(입금자 표기·이름·호수)
3. 내장 키워드 — 한전·재산세·도배·카드대금…
4. AI
5. 사람

자동 분류는 초안입니다. 신고 전에 「자동분류 확인」 필터로 훑어보세요.

## 아직 없는 것

감가상각비, 간주임대료, 원천세(인건비) — 「신고 준비」 탭에 체크리스트로 안내합니다.
