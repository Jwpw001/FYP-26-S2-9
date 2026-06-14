import React from "react";
import { View, Text, StyleSheet } from "react-native";

const VARIANTS = {
  published: { bg: "#DCFCE7", color: "#166534" },
  approved:  { bg: "#DCFCE7", color: "#166534" },
  draft:     { bg: "#F3F4F6", color: "#6B7280" },
  pending:   { bg: "#FEF3C7", color: "#92400E" },
  completed: { bg: "#DBEAFE", color: "#1E40AF" },
  cancelled: { bg: "#FEE2E2", color: "#991B1B" },
  rejected:  { bg: "#FEE2E2", color: "#991B1B" },
  assigned:  { bg: "#EFF6FF", color: "#1D4ED8" },
  annual:    { bg: "#EFF6FF", color: "#1D4ED8" },
  medical:   { bg: "#F0FDF4", color: "#166534" },
  emergency: { bg: "#FEF2F2", color: "#991B1B" },
};

export default function Badge({ label, variant }) {
  const v = VARIANTS[variant] || VARIANTS.draft;
  return (
    <View style={[s.badge, { backgroundColor: v.bg }]}>
      <Text style={[s.text, { color: v.color }]}>{label || variant}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 100 },
  text: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});
