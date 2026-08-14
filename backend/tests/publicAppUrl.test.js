const { resolvePublicAppUrl } = require("../src/utils/publicAppUrl");

// B2: the bug was one variable read two different ways — FRONTEND_URL as a comma-separated CORS
// list in app.js, and as a single link-building origin in invitationController.js/
// authController.js. resolvePublicAppUrl is what config/publicAppUrl.js calls to produce
// PUBLIC_APP_URL, the new single-purpose variable — these tests are on the pure function so they
// don't need to mock process.env or the logger.
describe("resolvePublicAppUrl", () => {
  test("returns a single well-formed origin unchanged when given one", () => {
    expect(resolvePublicAppUrl("https://krewby.vercel.app")).toBe("https://krewby.vercel.app");
  });

  test("defensively takes just the first origin if given a comma-separated value — the exact mistake FRONTEND_URL had", () => {
    expect(resolvePublicAppUrl("https://krewby.vercel.app,https://krewby-preview.vercel.app"))
      .toBe("https://krewby.vercel.app");
  });

  test("trims whitespace around the first entry", () => {
    expect(resolvePublicAppUrl(" https://krewby.vercel.app , https://other.vercel.app"))
      .toBe("https://krewby.vercel.app");
  });

  test("falls back to localhost when unset", () => {
    expect(resolvePublicAppUrl(undefined)).toBe("http://localhost:5173");
    expect(resolvePublicAppUrl("")).toBe("http://localhost:5173");
  });
});

describe("config/publicAppUrl — the actual link-building value", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test("resolves a single well-formed URL when PUBLIC_APP_URL holds a comma-separated value", () => {
    process.env.PUBLIC_APP_URL = "https://a.vercel.app,https://b.vercel.app";
    const PUBLIC_APP_URL = require("../src/config/publicAppUrl");
    expect(PUBLIC_APP_URL).toBe("https://a.vercel.app");
    expect(() => new URL(`${PUBLIC_APP_URL}/invite/sometoken`)).not.toThrow();
  });

  test("resolves a single well-formed URL when PUBLIC_APP_URL is unset", () => {
    delete process.env.PUBLIC_APP_URL;
    const PUBLIC_APP_URL = require("../src/config/publicAppUrl");
    expect(PUBLIC_APP_URL).toBe("http://localhost:5173");
    expect(() => new URL(`${PUBLIC_APP_URL}/invite/sometoken`)).not.toThrow();
  });

  test("logs a warning at startup when unset in production, not silently", () => {
    delete process.env.PUBLIC_APP_URL;
    process.env.NODE_ENV = "production";
    jest.doMock("../src/config/logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));
    require("../src/config/publicAppUrl");
    const logger = require("../src/config/logger");
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toMatch(/PUBLIC_APP_URL is not set/);
  });

  test("does not warn when PUBLIC_APP_URL is set in production", () => {
    process.env.PUBLIC_APP_URL = "https://krewby.vercel.app";
    process.env.NODE_ENV = "production";
    jest.doMock("../src/config/logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));
    require("../src/config/publicAppUrl");
    const logger = require("../src/config/logger");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("does not warn outside production even when unset (local dev is fine)", () => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.NODE_ENV;
    jest.doMock("../src/config/logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }));
    require("../src/config/publicAppUrl");
    const logger = require("../src/config/logger");
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
