import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { setUser } from "../utils/auth";
import { useAuth } from "../context/AuthContext";

const SUPPORTED_ROLES = ["regular_staff", "casual_staff"];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleLogin() {
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) { setError("Invalid email or password."); return; }

      const response = await api.post("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const profile = { ...response.user, token: response.token };

      if (!SUPPORTED_ROLES.includes(profile.role)) {
        setError(`Role "${profile.role}" is not available on the mobile app.`);
        await supabase.auth.signOut();
        return;
      }

      await setUser(profile);
      signIn(profile);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={s.logoWrap}>
            <View style={s.logoBox}>
              <Text style={s.logoLetter}>K</Text>
            </View>
            <Text style={s.logoName}>Krewby</Text>
            <Text style={s.tagline}>F&B Workforce Management</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.title}>Welcome back</Text>
            <Text style={s.subtitle}>Sign in to your account</Text>

            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry
            />

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Sign In</Text>
              }
            </TouchableOpacity>

            <Text style={s.note}>
              Staff · Casual Staff only
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F172A" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoWrap: { alignItems: "center", marginBottom: 36 },
  logoBox: {
    width: 60, height: 60, borderRadius: 16, backgroundColor: "#3B82F6",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
    shadowColor: "#3B82F6", shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  logoLetter: { fontSize: 28, fontWeight: "800", color: "#fff" },
  logoName:   { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  tagline:    { fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
  },
  title:    { fontSize: 22, fontWeight: "800", color: "#1E293B", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748B", marginBottom: 24 },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: "#991B1B", fontSize: 13, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12,
    padding: 13, fontSize: 14, color: "#1E293B",
    backgroundColor: "#F8FAFC", marginBottom: 16,
  },
  btn: {
    backgroundColor: "#2563EB", borderRadius: 12, padding: 15,
    alignItems: "center", marginTop: 4,
    shadowColor: "#2563EB", shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  note: { textAlign: "center", fontSize: 11.5, color: "#94A3B8", marginTop: 16 },
});
