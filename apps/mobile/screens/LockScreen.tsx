import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { useAuth } from "../auth/AuthContext";
import { Button, Muted, Screen, Title } from "../ui/components";
import { spacing, typography } from "../theme/theme";

/**
 * Shown on cold start when a session is already stored: unlock with biometrics
 * to continue (no password, works offline). First-time login / "different user"
 * still goes through the full LoginScreen.
 */
export function LockScreen() {
  const { me, unlock, signOut, error } = useAuth();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      await unlock();
    } finally {
      setBusy(false);
    }
  }, [unlock]);

  // Prompt for biometrics automatically as soon as the lock screen appears.
  useEffect(() => {
    run();
  }, [run]);

  return (
    <Screen>
      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Title>Welcome back</Title>
        {me?.username ? <Muted>Signed in as {me.username}</Muted> : null}
        <Text style={typography.body}>
          Unlock with biometrics to continue. Once unlocked you can keep working even with no
          connection.
        </Text>

        <Button title={busy ? "Unlocking…" : "Unlock with biometrics"} loading={busy} onPress={run} />
        {error ? <Muted>{error}</Muted> : null}

        <Button title="Sign in as a different user" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
