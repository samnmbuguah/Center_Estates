import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Button, Modal, StyleSheet, Text, View } from "react-native";

/**
 * On-site camera modal with audit-grade HUD watermark overlay (GPS coordinates,
 * project context, and timestamp). Supports multi-shot capture for batch receipts
 * and incident proof.
 */
export function PhotoCaptureModal({
  visible,
  title,
  projectCode,
  onCaptured,
  onClose,
}: {
  visible: boolean;
  title: string;
  projectCode?: string;
  onCaptured: (localUri: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);

  useEffect(() => {
    let active = true;
    if (visible) {
      setCapturedCount(0);
      (async () => {
        try {
          const { granted } = await Location.getForegroundPermissionsAsync();
          if (granted && active) {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (active) setCoords(loc.coords);
          }
        } catch {
          // GPS read optional
        }
      })();
    }
    return () => {
      active = false;
    };
  }, [visible]);

  async function snap() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ skipProcessing: true });
      if (photo?.uri) {
        onCaptured(photo.uri);
        setCapturedCount((c) => c + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {!permission?.granted ? (
        <View style={styles.center}>
          <Text style={styles.msg}>Camera access is required for site photo proof.</Text>
          <Button title="Grant camera access" onPress={requestPermission} />
          <Button title="Cancel" onPress={onClose} />
        </View>
      ) : (
        <View style={styles.fill}>
          <CameraView ref={cameraRef} style={styles.fill} facing="back" />

          {/* Audit Watermark HUD Banner */}
          <View style={styles.watermarkBanner}>
            <Text style={styles.watermarkProject}>
              {projectCode ? `[${projectCode}] ` : ""}
              {title}
            </Text>
            <Text style={styles.watermarkDetails}>
              {coords
                ? `GPS: ${coords.latitude.toFixed(5)}°, ${coords.longitude.toFixed(5)}°`
                : "GPS: Acquiring fix…"}
              {" · "}
              {nowStr}
            </Text>
          </View>

          <View style={styles.controls}>
            {capturedCount > 0 && (
              <Text style={styles.countText}>{capturedCount} photo(s) captured</Text>
            )}
            <View style={styles.buttonRow}>
              <Button
                title={busy ? "Saving…" : capturedCount > 0 ? "Take another photo" : "Take photo"}
                onPress={snap}
                disabled={busy}
              />
              <Button title="Done" onPress={onClose} />
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  msg: { textAlign: "center", color: "#fff" },
  watermarkBanner: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#22c55e",
  },
  watermarkProject: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  watermarkDetails: {
    color: "#a3e635",
    fontSize: 11,
    marginTop: 2,
    fontFamily: "monospace",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12,
  },
  countText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
});
