import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../auth/AuthContext";
import { Button, Field } from "../ui/components";
import { colors, gradients, radius, spacing, typography } from "../theme/theme";

export function LoginScreen() {
  const { signIn, signingIn, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.hero}>
        <LinearGradient colors={gradients.amber} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
          <Text style={styles.logoText}>🦺</Text>
        </LinearGradient>
        <Text style={styles.appName}>MonitoringERP</Text>
        <Text style={styles.tagline}>Center Estates · Clerk of Works capture</Text>
      </View>

      <View style={styles.card}>
        <Text style={[typography.heading, { marginBottom: spacing.md }]}>Sign in</Text>
        <Field
          label="Username"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@company.com"
          value={username}
          onChangeText={setUsername}
        />
        <Field
          label="Password"
          secureTextEntry
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title="Sign in"
          loading={signingIn}
          disabled={!username || !password}
          onPress={() => signIn(username, password).catch(() => {})}
        />
      </View>

      <View style={styles.pills}>
        {["Geofenced", "Audit-sealed", "Offline-first"].map((p) => (
          <View key={p} style={styles.pill}>
            <Text style={styles.pillText}>{p}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        Signing in enrols this device's biometric key, so your submissions are
        digitally signed.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.lg },
  hero: { alignItems: "center", marginBottom: spacing.xl },
  logo: {
    width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md, shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  logoText: { fontSize: 40 },
  appName: { ...typography.title, fontSize: 25, textAlign: "center" },
  tagline: { ...typography.muted, marginTop: spacing.xs, color: colors.steel },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3,
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
  pills: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg },
  pill: { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  note: { ...typography.muted, marginTop: spacing.md, textAlign: "center", paddingHorizontal: spacing.md },
});
