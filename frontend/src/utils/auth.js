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

export function clearUser() {
  // Login stores both keys ("user" and a separate "token"); clearing only "user" left a
  // stale token behind, which api.js's getToken() would still pick up after "signing out".
  localStorage.removeItem("user");
  localStorage.removeItem("token");
}
