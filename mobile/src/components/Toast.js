import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet } from "react-native";

export default function Toast({ message, type = "success", onHide }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onHide?.());
  }, []);

  const bg = type === "error" ? "#EF4444" : "#22C55E";

  return (
    <Animated.View style={[s.toast, { backgroundColor: bg, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: {
    position: "absolute", bottom: 32, alignSelf: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, zIndex: 9999,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
