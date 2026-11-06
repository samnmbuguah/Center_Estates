import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../auth/AuthContext";
import { colors, radius, spacing, typography } from "../theme/theme";
import { navigationRef } from "./navRef";

/**
 * Left-hand navigation drawer (replaces the bottom tab bar). Built on React
 * Native's built-in Animated API — no gesture-handler / reanimated — so it runs
 * in plain Expo Go. Open it with the header hamburger; it slides in from the
 * left, dims the screen, and switches the top-level section via navigationRef.
 */
type Dest = { key: "Home" | "Account"; label: string; glyph: string };
const DESTS: Dest[] = [
  { key: "Home", label: "Projects", glyph: "🏗️" },
  { key: "Account", label: "Account", glyph: "👤" },
];

interface DrawerCtx {
  toggle: () => void;
  close: () => void;
}
const Ctx = createContext<DrawerCtx>({ toggle: () => {}, close: () => {} });
export const useDrawer = () => useContext(Ctx);

const WIDTH = Math.min(300, Math.round(Dimensions.get("window").width * 0.8));

export function DrawerProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, me, signOut } = useAuth();
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<Dest["key"]>("Home");
  const tx = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [tx, fade]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(tx, { toValue: -WIDTH, duration: 200, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => finished && setVisible(false));
  }, [tx, fade]);

  const toggle = useCallback(() => (visible ? close() : open()), [visible, open, close]);

  function go(dest: Dest["key"]) {
    setActive(dest);
    if (navigationRef.isReady()) navigationRef.navigate(dest as never);
    close();
  }

  return (
    <Ctx.Provider value={{ toggle, close }}>
      {children}
      {isAuthenticated && visible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fade }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close menu" />
          </Animated.View>
          <Animated.View style={[styles.panel, { transform: [{ translateX: tx }] }]}>
            <SafeAreaView edges={["top", "left", "bottom"]} style={{ flex: 1 }}>
              <View style={styles.brand}>
                <View style={styles.logo}><Text style={{ fontSize: 18 }}>👷</Text></View>
                <Text style={styles.brandText}>Construction Management</Text>
              </View>

              <View style={{ marginTop: spacing.lg }}>
                {DESTS.map((d) => {
                  const on = active === d.key;
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => go(d.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.item, on && styles.itemActive]}
                    >
                      <Text style={{ fontSize: 18 }}>{d.glyph}</Text>
                      <Text style={[styles.itemText, on && styles.itemTextActive]}>{d.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.footer}>
                <Text style={typography.muted} numberOfLines={1}>{me?.username ?? ""}</Text>
                <Pressable onPress={() => { close(); signOut(); }} accessibilityRole="button">
                  <Text style={styles.signOut}>Sign out</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      )}
    </Ctx.Provider>
  );
}

/** Header hamburger that opens the drawer. Place as a screen's headerLeft. */
export function HamburgerButton() {
  const { toggle } = useDrawer();
  return (
    <Pressable onPress={toggle} hitSlop={12} accessibilityRole="button" accessibilityLabel="Open menu"
      style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ fontSize: 22, color: colors.text }}>☰</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  panel: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: WIDTH,
    backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border,
    paddingHorizontal: spacing.md, elevation: 16, zIndex: 20,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 11, paddingTop: spacing.sm },
  logo: {
    width: 36, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  brandText: { ...typography.heading, fontWeight: "800" },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.sm, marginBottom: 4,
  },
  itemActive: { backgroundColor: colors.surfaceAlt },
  itemText: { fontSize: 15, fontWeight: "600", color: colors.textMuted },
  itemTextActive: { color: colors.text },
  footer: {
    marginTop: "auto", borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: spacing.md, gap: 6,
  },
  signOut: { color: colors.danger, fontWeight: "700", fontSize: 15 },
});
