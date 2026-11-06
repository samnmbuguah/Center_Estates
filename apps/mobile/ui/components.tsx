import { useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, MIN_TOUCH_SIZE, gradients, radius, spacing, typography } from "../theme/theme";
import type { Badge as BadgeData } from "./status";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={[typography.title, { marginBottom: spacing.md }]}>{children}</Text>;
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const content = <View style={styles.card}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
}) {
  const dim = disabled || loading;
  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  const label = (
    <Text style={[styles.buttonText, variant === "ghost" && { color: colors.text }]}>{title}</Text>
  );

  if (variant === "primary") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={dim}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: !!dim, busy: !!loading }}
        style={({ pressed }) => [styles.btnShadow, { opacity: dim ? 0.5 : pressed ? 0.85 : 1 }]}
      >
        <LinearGradient
          colors={gradients.amber}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {loading ? <ActivityIndicator color={colors.primaryText} /> : label}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={dim}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!dim, busy: !!loading }}
      style={[
        styles.button,
        { marginTop: spacing.sm },
        variant === "danger" ? { backgroundColor: colors.danger } : styles.buttonGhost,
        { opacity: dim ? 0.5 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : label}
    </Pressable>
  );
}

/** Compact icon-only tap target (44x44 hit area for a11y). `glyph` is a short
 *  symbol/emoji so we don't pull in a vector-icon font dependency. */
/**
 * Compact icon-only button with minimum 44x44 touch target for a11y.
 * The visible icon may be smaller but the hit area meets WCAG requirements.
 */
export function IconButton({
  glyph,
  onPress,
  label,
  tint,
}: {
  glyph: string;
  onPress: () => void;
  label: string;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={`Double tap to ${label.toLowerCase()}`}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.iconGlyph, tint ? { color: tint } : null]}>{glyph}</Text>
    </Pressable>
  );
}

export function Badge({ badge }: { badge: BadgeData }) {
  return (
    <View
      style={[styles.badge, { backgroundColor: badge.color }]}
      accessibilityRole="text"
      accessibilityLabel={badge.label}
    >
      <Text style={styles.badgeText}>{badge.label}</Text>
    </View>
  );
}

export function Field({ label, secureTextEntry, ...props }: { label: string } & TextInputProps) {
  const isSecure = !!secureTextEntry;
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[typography.muted, { marginBottom: spacing.xs }]}>{label}</Text>
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[styles.input, isSecure && { paddingRight: 52 }]}
          secureTextEntry={isSecure && hidden}
          accessibilityLabel={label}
          {...props}
        />
        {isSecure && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={styles.eyeBtn}
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Text style={styles.eye}>{hidden ? "👁" : "🙈"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={typography.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  btnShadow: {
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  button: {
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    minHeight: MIN_TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonGhost: { borderWidth: 1, borderColor: colors.borderStrong },
  buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: "700" },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    minHeight: MIN_TOUCH_SIZE,
  },
  eyeBtn: { position: "absolute", right: 12, padding: 8, minWidth: MIN_TOUCH_SIZE, minHeight: MIN_TOUCH_SIZE, justifyContent: "center", alignItems: "center" },
  eye: { fontSize: 20 },
  iconBtn: { width: MIN_TOUCH_SIZE, height: MIN_TOUCH_SIZE, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  iconGlyph: { fontSize: 20 },
});
