import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "krewby_user";

export async function getUser() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setUser(profile) {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}

export async function clearUser() {
  await AsyncStorage.removeItem(KEY);
}
