/* 보담 — 설정·Supabase 클라이언트·전량 조회 헬퍼
   ⚠️ index.html의 로더가 «순서대로» 불러온다. 파일 사이에 선언을 옮길 때 순서를 같이 보라.
   (이 파일들은 babel-standalone이 브라우저에서 변환한다 — 빌드 단계 없음) */
/* ============================================================
   ⚙️ 설정 — 본인의 Supabase 프로젝트 값으로 교체하세요.
   (Supabase 대시보드 → Settings → API)
   ============================================================ */
const SUPABASE_URL = "https://nhkbymfhmqgilbdxirpq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oa2J5bWZobXFnaWxiZHhpcnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTQ3MDgsImV4cCI6MjA5MjI5MDcwOH0.Ob3Suz5Fi1zCkVSf3Hoiafns75nKIq0YJ7z9Uh3bt_c";

const IS_CONFIGURED = SUPABASE_URL.startsWith("https://") && !SUPABASE_ANON_KEY.includes("YOUR_");
const sb = IS_CONFIGURED ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* ⚠️ 배포(커밋)할 때마다 이 값을 반드시 새 값으로 바꿀 것.
   앱이 최신 index.html의 APP_VERSION과 비교해 다르면 "업데이트" 배너를 띄웁니다.
   안 바꾸면 새 기능이 배포돼도 업데이트 알림이 안 뜹니다. */
/* APP_VERSION은 index.html에 있다(업데이트 배너가 그 파일에서 찾는다) — window.APP_VERSION 참조 */
const APP_VERSION = window.APP_VERSION;

const { useState, useEffect, useMemo, useRef } = React;

/* ---------------- 전량 조회 헬퍼 ----------------
   PostgREST는 한 번의 select에 기본 1000행 상한이 있어, 그걸 넘는 테이블은 말없이 잘린다.
   (2026-07-20 leases 1275건 중 275건이 5개월간 통째로 누락됐던 사고의 원인)
   그래서 1000행을 넘을 수 있는 테이블은 반드시 이 헬퍼로 읽는다.
   orderCols = 페이지 간 중복/누락이 없도록 행을 유일하게 정하는 정렬 키(보통 PK).
   대상: leases(1275) · lease_admin(765·leases 따라 증가) · app_visits(누적 증가) */
const fetchTableAll = async (table, cols = "*", orderCols = ["id"]) => {
  const CHUNK = 1000;
  let from = 0, all = [];
  for (;;) {
    let q = sb.from(table).select(cols);
    orderCols.forEach((c) => { q = q.order(c); });
    const { data, error } = await q.range(from, from + CHUNK - 1);
    if (error) return { data: all, error };
    all = all.concat(data || []);
    if (!data || data.length < CHUNK) break;
    from += CHUNK;
  }
  return { data: all };
};
