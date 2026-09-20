// 커밋 전 문법 검증 — index.html의 인라인 babel 블록 + src/*.js 를 전부 transform해서 문법 오류를 잡는다.
// 사용법: node validate.js   (통과 시 "OK", 실패 시 에러 출력 후 exit 1)
//
// ⛔ 2026-09-20: 코드를 src/로 쪼개면서 이 파일도 같이 고쳤다.
//    전에는 index.html의 «첫 babel 블록 하나»만 봤다 — 쪼갠 뒤 그대로 뒀다면
//    본문 대부분이 검사 밖에 있는데도 초록불이 떴을 것이다.
const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const sources = [];

// ① index.html 안에 남아 있는 인라인 babel 블록 전부
// ⚠️ 줄머리에 붙은 진짜 태그만 센다 — 로더가 document.write로 «문자열» 안에 같은 태그를
//    적고 있어서, 아무 데나 맞추면 그 문자열을 코드로 착각해 거짓 실패가 난다(실제로 났다).
const inline = [...html.matchAll(/^<script type="text\/babel"[^>]*>$([\s\S]*?)^<\/script>$/gm)]
  .filter((m) => m[1].trim());
inline.forEach((m, i) => sources.push({ name: `index.html 인라인#${i + 1}`, code: m[1] }));

// ② 로더가 부르는 src 파일 — «부르는 목록»을 원본으로 삼는다(폴더를 훑지 않는다).
//    그래야 «있는데 안 불리는 파일»과 «부르는데 없는 파일»이 둘 다 드러난다.
const listed = (html.match(/\[([^\]]*)\]\.forEach\(function \(n\)/) || [])[1] || '';
const names = [...listed.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
if (!names.length) {
  console.error('FAIL: index.html에서 모듈 로더 목록을 찾지 못함');
  process.exit(1);
}
for (const n of names) {
  const f = path.join('src', `${n}.js`);
  if (!fs.existsSync(f)) { console.error(`FAIL: 로더가 부르는 ${f} 가 없다`); process.exit(1); }
  sources.push({ name: f, code: fs.readFileSync(f, 'utf8') });
}
const onDisk = fs.readdirSync('src').filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));
const orphan = onDisk.filter((f) => !names.includes(f));
if (orphan.length) { console.error(`FAIL: src에 있는데 로더가 안 부르는 파일: ${orphan.join(', ')}`); process.exit(1); }

// ③ 판 번호 잠금 — src/를 고쳤는데 APP_VERSION이 그대로면, 사용자는 새로고침해도
//    브라우저 캐시의 «옛 모듈»을 계속 받는다(로더가 ?v=판번호로 받기 때문).
//    쪼개기 전에는 없던 병이다 — index.html 자체는 늘 새로 받았으니까.
try {
  const { execSync } = require('child_process');
  const sh = (c) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const verOf = (t) => (t.match(/APP_VERSION\s*=\s*"([^"]+)"/) || [])[1];
  if (sh('git status --porcelain -- src').trim()) {
    const head = verOf(sh('git show HEAD:index.html'));
    if (head && head === verOf(html)) {
      console.error(`FAIL: src/를 고쳤는데 APP_VERSION이 그대로다("${head}") — 사용자는 옛 코드를 계속 받는다.`);
      console.error('      index.html의 window.APP_VERSION을 새 값으로 바꿀 것.');
      process.exit(1);
    }
  }
} catch (e) { /* git이 없거나 첫 커밋 전 — 이 검사만 건너뛴다 */ }

// ④ 지도 잠금 — 모듈을 새로 만들고 CLAUDE.md 표에 안 적으면, 다음 세션은 그 파일이 있는 줄도 모른다.
//    ⚠️ 이 검사는 «빠진 파일»만 잡는다. 설명이 틀린 것은 못 잡는다(사람이 봐야 한다).
if (fs.existsSync('CLAUDE.md')) {
  const map = fs.readFileSync('CLAUDE.md', 'utf8');
  const missing = names.filter((n) => !map.includes(`${n}.js`));
  if (missing.length) {
    console.error(`FAIL: CLAUDE.md 지도에 없는 모듈: ${missing.join(', ')} — 표에 한 줄씩 적을 것`);
    process.exit(1);
  }
}

let bad = 0;
for (const s of sources) {
  try {
    babel.transformSync(s.code, { presets: ['@babel/preset-react'], filename: 'app.jsx' });
  } catch (e) {
    console.error('FAIL:', s.name, '—', e.message.split('\n')[0]);
    bad++;
  }
}
if (bad) process.exit(1);
console.log(`OK: babel 문법검증 통과 (${sources.length}곳: ${sources.map((s) => s.name).join(', ')})`);
