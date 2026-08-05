import * as SecureStore from "expo-secure-store";

// SecureStore keys must be alphanumeric plus ".", "-", "_" — Supabase's own storage keys
// (e.g. "sb-<project-ref>-auth-token") already satisfy this, but sanitize defensively.
function safeKey(key) {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Adapter matching the {getItem,setItem,removeItem} shape Supabase's auth client expects,
// backed by the OS keychain/keystore instead of AsyncStorage's unencrypted disk storage.
export const secureStorage = {
  getItem: (key) => SecureStore.getItemAsync(safeKey(key)),
  setItem: (key, value) => SecureStore.setItemAsync(safeKey(key), value),
  removeItem: (key) => SecureStore.deleteItemAsync(safeKey(key)),
};
