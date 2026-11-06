import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { pendingSubmissionCount } from "../sitediary/offlineQueue";
import { colors, spacing } from "../theme/theme";

export default function ConnectivityBanner() {
  const [connected, setConnected] = useState(true);
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    try {
      const count = await pendingSubmissionCount();
      setPending(count);
    } catch { setPending(0); }
  }, []);

  useEffect(() => {
    refreshPending();
    const interval = setInterval(refreshPending, 10000);
    const unsub = NetInfo.addEventListener((s: NetInfoState) => {
      setConnected(s.isConnected ?? true);
    });
    return () => { unsub(); clearInterval(interval); };
  }, [refreshPending]);

  const [syncing, setSyncing] = useState(false);
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { flushDiaryQueue } = await import("../sitediary/diarySync");
      const result = await flushDiaryQueue();
      setPending(0);
    } catch {} finally { setSyncing(false); }
  }, []);

  if (connected && pending === 0) return null;

  const bannerStyle = connected ? styles.bannerOnline : styles.banner;

  return (
    <Pressable onPress={connected && pending > 0 ? handleSync : undefined} style={bannerStyle}>
      <Text style={styles.text}>
        {!connected
          ? `📡 Offline — ${pending} pending`
          : pending > 0
            ? syncing ? "🔄 Syncing..." : `📤 ${pending} pending — tap to sync`
            : null}
      </Text>
      {pending > 0 && connected && !syncing && (
        <Text style={styles.syncHint}>Tap to upload now</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.danger, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center" },
  bannerOnline: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 16, alignItems: "center" },
  text: { color: "#fff", fontSize: 13, fontWeight: "600" },
  syncHint: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
});
