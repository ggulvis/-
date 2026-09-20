// 스모크 테스트 설정 — 정적 서버로 index.html을 띄우고 크롬 하나로 돈다.
// 서버는 의존성 없는 python3 http.server를 쓴다(빌드 단계가 없는 앱이라 이걸로 충분).
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.SMOKE_PORT || 4173);

module.exports = defineConfig({
  testDir: './tests',
  timeout: 90_000,          // babel-standalone이 5천 줄을 런타임에 컴파일한다 — 넉넉히 준다
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    serviceWorkers: 'block',   // sw.js 캐시가 옛 화면을 보여주는 것을 막는다
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
