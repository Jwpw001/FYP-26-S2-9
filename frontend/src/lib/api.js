const BASE_URL = import.meta.env.VITE_API_URL;

function getToken() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.token || null;
  } catch {
    return null;
  }
}

async function request(method, path, body = null) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export const api = {
  get:    (path)       => request("GET",    path),
  post:   (path, body) => request("POST",   path, body),
  patch:  (path, body) => request("PATCH",  path, body),
  delete: (path)       => request("DELETE", path),
};