// B1: setSession is the one place a page establishes a session from a backend
// { user, token } response — see utils/auth.js's own comment for the three inconsistent
// patterns this replaces (CreateAccount.jsx storing nothing at all was the reported bug).
import { setSession, getUser, setUser, clearUser } from "../src/utils/auth";

beforeEach(() => {
  localStorage.clear();
});

describe("setSession", () => {
  test("a successful signup leaves both a stored user and a retrievable token", () => {
    const user = { user_id: 1, full_name: "Andrea", email: "andrea@example.com", role: "pending" };
    setSession({ user, token: "abc.def.ghi" });

    expect(getUser()).toEqual(user);
    expect(localStorage.getItem("token")).toBe("abc.def.ghi");
  });

  test("does not nest the token inside the stored user object (the RegisterBusiness.jsx variant)", () => {
    setSession({ user: { user_id: 2, role: "business_owner" }, token: "xyz" });

    const stored = getUser();
    expect(stored.token).toBeUndefined();
    expect(localStorage.getItem("token")).toBe("xyz");
  });

  test("overwrites a stale token left over from a previous session", () => {
    localStorage.setItem("token", "stale-token-from-earlier-testing");
    setUser({ user_id: 99, role: "system_admin" }); // simulates a leftover profile too

    setSession({ user: { user_id: 3, role: "regular_staff" }, token: "fresh-token" });

    expect(localStorage.getItem("token")).toBe("fresh-token");
    expect(getUser().user_id).toBe(3);
  });
});

describe("clearUser", () => {
  test("removes both the user and the token, not just the user", () => {
    setSession({ user: { user_id: 1 }, token: "abc" });
    clearUser();
    expect(getUser()).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });
});
