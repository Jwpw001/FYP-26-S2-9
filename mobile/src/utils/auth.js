import { secureStorage } from "../lib/secureStorage";

const KEY = "krewby_user";

export async function getUser() {
  try {
    const raw = await secureStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setUser(profile) {
  await secureStorage.setItem(KEY, JSON.stringify(profile));
}

export async function clearUser() {
  await secureStorage.removeItem(KEY);
}
