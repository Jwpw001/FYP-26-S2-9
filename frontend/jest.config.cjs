// B1: minimal Jest setup added specifically to cover the session-handling fix (utils/auth.js /
// api.js) — this project had no frontend test runner before. jsdom gives these tests a working
// `localStorage`, which is all utils/auth.js needs; nothing here touches component rendering, so
// no React Testing Library or router mocking was pulled in for it.
module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
};
