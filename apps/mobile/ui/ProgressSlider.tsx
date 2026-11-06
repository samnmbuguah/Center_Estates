import { useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../theme/theme";

/**
 * Drag-to-set progress slider (0-100). Built on React Native's PanResponder —
 * no native module, so it runs in plain Expo Go. Large hit area + +/- nudge
 * buttons for precise, one-handed on-site use.
 */
export function ProgressSlider({
  value,
  onChange,
  label = "Progress",
}: {
  value: number;
  onChange: (pct: number) => void;
  label?: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const setFromX = (x: number) => {
    const w = widthRef.current;
    if (w > 0) onChange(clamp((x / w) * 100));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const pct = clamp(value);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.headRow}>
        <Text style={typography.muted}>{label}</Text>
        <Text style={styles.value}>{pct}%</Text>
      </View>
      <View style={styles.controlRow}>
        <Pressable style={styles.nudge} onPress={() => onChange(clamp(pct - 5))} accessibilityLabel="Decrease 5 percent">
          <Text style={styles.nudgeText}>−</Text>
        </Pressable>

        <View
          style={styles.track}
          onLayout={(e) => { const w = e.nativeEvent.layout.width; widthRef.current = w; setWidth(w); }}
          {...pan.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={`${label} ${pct} percent`}
        >
          <View style={[styles.fill, { width: `${pct}%` }]} />
          {/* Thumb — positioned by percent; pointerEvents none so drags hit the track. */}
          {width > 0 && (
            <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, Math.min(width - 24, (pct / 100) * width - 12)) }]} />
          )}
        </View>

        <Pressable style={styles.nudge} onPress={() => onChange(clamp(pct + 5))} accessibilityLabel="Increase 5 percent">
          <Text style={styles.nudgeText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: spacing.xs },
  value: { fontSize: 22, fontWeight: "800", color: colors.text },
  controlRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nudge: {
    width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  nudgeText: { fontSize: 22, color: colors.text, fontWeight: "700", lineHeight: 24 },
  track: {
    flex: 1, height: 28, borderRadius: 14, backgroundColor: colors.surface3,
    justifyContent: "center", overflow: "visible",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 14, backgroundColor: colors.primary },
  thumb: {
    position: "absolute", width: 24, height: 24, borderRadius: 12, top: 2,
    backgroundColor: "#fff", borderWidth: 2, borderColor: colors.primary,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3, elevation: 3,
  },
});
