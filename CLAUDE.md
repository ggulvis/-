# 보담 (임대관리 PWA) — 세션 지도

> 이 파일은 **어디를 볼지만 정한다.** 규칙의 원본은 코드와 아래 ⛔ 항목이다.
> ⛔ **`index.html`을 통째로 읽지 말 것** — 2026-09-20에 본문을 `src/` 19개로 쪼갰다.
> `index.html`(82줄)은 껍데기·판 번호·로더뿐이다. 아래 표에서 **파일 하나만 골라** 읽는다.

**한 줄**: Google 로그인 → 건물·세대 목록 → 계약·미납·이벤트 관리.
React + Supabase, 라이브러리는 전부 CDN, **빌드 단계 없음**(브라우저에서 babel이 변환).

## 어디에 무엇이 있나 (`src/` · 로더가 부르는 순서 · 줄 수는 2026-09-20 기준)

| 파일 | 하는 일 | 찾을 이름 |
|---|---|---|
| `00-config.js` 40 | Supabase 접속·클라이언트 | `sb` `fetchTableAll` |
| `10-push.js` 90 | 푸시 알림·기기 판별 | `subscribePush` `isIOS` `isStandalone` |
| `20-utils.js` 220 | 날짜·돈·호수 서식, 정렬 | `dday` `fmtMoney` `fmtDate` `leaseSort` |
| `30-ui-common.js` 45 | 공용 부품 | `Modal` `Field` `inputCls` `btnPrimary` |
| `40-auth.js` 210 | 로그인·가입·승인대기 화면, 사진 | `LoginScreen` `RegisterScreen` `PendingScreen` `LeasePhotos` |
| `50-lease-modal.js` 280 | **임대정보 추가/수정 폼** | `LeaseModal` |
| `55-lease-list.js` 245 | 목록·카드·태그·배지 | `LEASE_TAGS` `BUILDING_OPTS` `legalMaxFee` |
| `60-building-modal.js` 60 | 건물 추가/수정 | `BuildingModal` |
| `62-profile-modal.js` 110 | 내 정보 | `ProfileModal` |
| `64-duplicates.js` 80 | 중복 매물 정리 | `DuplicateModal` |
| `66-lease-detail.js` 175 | 매물 상세(열람) · PDF | `LeaseDetailModal` `loadPdfJs` |
| `70-contract-upload.js` 140 | 계약서 사진 올리기(OCR) | `ContractUploadModal` |
| `72-contract-approve.js` 105 | 계약서 승인 | `SubmissionReviewModal` |
| `74-events.js` 955 | 이벤트 **+ 미납·입금 대조** ⚠️ | `EventModal` `arrearsOf` `parseBankText` `PaymentImportModal` |
| `76-roulette.js` 460 | 꽝 없는 룰렛 | `RouletteEventCard` `ROULETTE_PRIZES` |
| `78-ledger.js` 970 | **장부·세무**(관리자 전용) — 통장·카드 → 계정과목 분류 · 신고 자료 | `LedgerView` `ledgerClassify` `LEDGER_CATS` `LedgerImportModal` |
| `80-archive.js` 345 | 자료실(관리인) | `ArchiveView` `ARCHIVE_SPECS` |
| `85-admin.js` 535 | 관리자 패널 | `AdminPanel` |
| `90-main-app.js` 1300 | **화면 전체를 묶는 곳**(목록·탭·검색·동기화) | `MainApp` `OrganizeView` |
| `99-root.js` 50 | 로그인 상태 → 어떤 화면을 보일지 | `App` |

⚠️ `74-events.js`는 이름이 이벤트인데 **미납·입금 대조가 같이 들어 있다**. 미납 관련이면 여기다.
⚠️ `90-main-app.js`가 아직 1,300줄이다 — 다음에 쪼갠다면 여기다.

## 먼저 알아야 하는 것 (⛔ 지키지 않으면 조용히 깨진다)

1. ⛔ **빌드 단계가 없다.** `src/*.js`는 브라우저가 받아서 babel로 변환한다.
   import/export를 쓰지 말 것 — 파일들은 **같은 전역을 공유**한다(앞 파일의 선언을 뒷 파일이 그냥 쓴다).
2. ⛔ **`src/`를 고쳤으면 `index.html`의 `window.APP_VERSION`을 반드시 올린다.**
   모듈을 `?v=판번호`로 받기 때문에, 안 올리면 **사용자는 새로고침해도 옛 코드를 받는다.**
   `node validate.js`가 이걸 잡는다(안 올렸으면 FAIL).
3. ⛔ **`APP_VERSION`은 `index.html`에 있어야 한다.** 앱이 index.html을 다시 받아 이 값을 견주어
   「업데이트」 배너를 띄운다. `src/`로 옮기면 그 비교가 **말없이** 죽는다.
4. ⛔ **로더의 나열 순서 = 의존 순서.** 파일을 추가하면 `index.html`의 목록에도 넣는다
   (안 넣으면 `validate.js`가 「있는데 안 부르는 파일」로 잡는다).
5. ⛔ **주소를 `/src/...`처럼 뿌리부터 쓴다** — 앱이 도메인 뿌리에 올라가는 전제다(`/icon-192.png`도 그렇다).
6. ⛔ **`main`에 밀면 곧 배포다**(손님에게 바로 나간다). 되돌리기 어려운 변경은 밀기 전에 사용자 확인.

## 확인하는 법 — 커밋 전에 둘 다 돌린다

```
node validate.js   # 문법 + 로더 목록 + 판 번호 (1초)
npm test           # 스모크: 로드 → 로그인 → 목록 렌더 → 계약 저장 (1.4초)
```

스모크는 **진짜 DB를 안 건드린다**(Supabase를 가로챈다 · `tests/fixtures/supabase-mock.js`).
로그인이 Google 단독이라 자동으로 진짜 로그인은 못 한다 — 세션을 심어서 통과시킨다.
⭕ **지키는 것**: 앱이 뜨는가 · 화면이 그려지는가 · 저장 요청이 **실제로 나가는가** · 콘솔 오류.
⛔ **안 지키는 것**: RLS·권한·진짜 컬럼 제약, 그리고 스모크가 안 들르는 화면
(룰렛·자료실·관리자 패널·계약서 OCR·미납). 거기를 고쳤으면 **사람이 봐야 한다.**

## 데이터 (Supabase)

주요 표: `leases`(세대·계약) `buildings` `user_roles`(회원·권한) `contract_submissions`
`payments` `lease_billing` `events` `as_records` `collection_log` `app_settings`.

- ⛔ **1000행 함정** — PostgREST는 한 번에 1000행까지만 준다. 넘을 수 있는 표는 반드시
  `fetchTableAll`로 읽는다. (2026-07-20에 `leases` 1,275건 중 **275건이 5개월간 통째로 누락**된 사고의 원인)
- 로그인 안 한 손님(anon)은 `buildings`·`user_roles`를 **못 읽는다**(RLS). `app_settings`는 읽힌다 —
  `.github/workflows/keep-alive.yml`이 3일마다 거기를 찔러 무료 프로젝트가 잠드는 것을 막는다.
  ⚠️ 종전엔 `buildings`를 찔러 **2026-08-07부터 12회 연속 실패**했다(RLS로 401). 2026-09-20에 고쳤으나
  **아직 GitHub에 못 올렸다** — `.github/workflows/`를 고치려면 `gh auth refresh -h github.com -s workflow`가 먼저다.

## 로그인·권한

Google 로그인만 있다(`sb.auth.signInWithOAuth`). 로그인하면 `user_roles`에 **대기(pending)** 로 자동 등록되고,
관리자가 **active**로 바꿔야 들어온다. 역할 넷: `viewer` < `editor`(가입 승인) < `manager`(매물 편집·계약 승인) < `admin`.
관리인 이상은 로그인 직후 **모드 선택**(임대 홈 / 관리모드) 화면을 먼저 만난다.
