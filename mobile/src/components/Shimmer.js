import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

export default function Shimmer({ width = "100%", height = 16, borderRadius = 8, style }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: "#E2E8F0", opacity },
        style,
      ]}
    />
  );
}
