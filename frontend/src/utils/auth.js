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
  localStorage.removeItem("user");
  localStorage.removeItem("token");
}

export function isAuthenticated() {
  return getUser() !== null;
}

export function logout(navigate) {
  clearUser();
  navigate("/login", { replace: true });
}
