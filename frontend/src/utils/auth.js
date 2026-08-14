export function getUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(profile) {
  localStorage.setItem("user", JSON.stringify(profile));
}

// B1: the one place a page establishes a session from a backend response shaped
// { user, token } (register, register-business, register-casual, login, invitation accept all
// return this shape). Before this existed, three different patterns had grown up across the auth
// pages: CreateAccount.jsx stored nothing at all (the actual bug — signup left the user
// unauthenticated, so accepting an invitation right after signing up 401'd), RegisterBusiness.jsx
// nested the token inside the stored user object with no top-level "token" key, and the rest
// wrote both localStorage keys correctly. Only the last pattern actually works with api.js's
// getToken(), which checks localStorage.token first — every page must call this, not write
// localStorage directly, so a fourth variant can't appear.
export function setSession({ user, token }) {
  setUser(user);
  localStorage.setItem("token", token);
}

export function clearUser() {
  // Login stores both keys ("user" and a separate "token"); clearing only "user" left a
  // stale token behind, which api.js's getToken() would still pick up after "signing out".
  localStorage.removeItem("user");
  localStorage.removeItem("token");
}
