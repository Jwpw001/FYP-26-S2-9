// B1: proves the actual mechanism behind "accepting an invitation immediately after signing up
// succeeds rather than 401ing" — api.js sends whatever setSession just stored as the
// Authorization header. Before the fix, CreateAccount.jsx never called setSession, so this
// header carried a stale or missing token instead, and invitationController.acceptInvitation's
// (correct, untouched) guard rejected it with 401.
import { setSession } from "../src/utils/auth";
import { api } from "../src/lib/api";

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, user: { user_id: 1, role: "regular_staff" }, token: "new-token" }),
  });
});

test("a request made right after setSession carries the token it just stored", async () => {
  setSession({ user: { user_id: 1, full_name: "Andrea" }, token: "freshly-issued-token" });

  await api.post("/api/invitations/some-token/accept", { existing_user_id: 1 });

  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [, options] = global.fetch.mock.calls[0];
  expect(options.headers.Authorization).toBe("Bearer freshly-issued-token");
});

test("with no session established, no Authorization header is sent (reproduces the pre-fix 401 path)", async () => {
  await api.post("/api/invitations/some-token/accept", { existing_user_id: 1 });

  const [, options] = global.fetch.mock.calls[0];
  expect(options.headers.Authorization).toBeUndefined();
});
