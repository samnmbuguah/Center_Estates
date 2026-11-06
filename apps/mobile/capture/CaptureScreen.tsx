import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
// Legacy module keeps readAsStringAsync/EncodingType — the root module
// deprecated them in SDK 56 (the new File API throws on the old calls).
import * as FileSystem from "expo-file-system/legacy";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { MEDIA_TYPE, classifyGeofence } from "@monitoring/shared-types";
import { uploadProofPhoto } from "../api/client";
import { useHaptics } from "../hooks/useHaptics";
import { addEvidence } from "../milestone/repository";
import type { RootStackParamList } from "../navigation/types";
import { buildEvidenceDraft } from "./buildEvidence";

type Props = NativeStackScreenProps<RootStackParamList, "Capture">;

/**
 * Evidence capture (SRS-MOB-EVID). Camera-only — there is intentionally no
 * gallery picker, so evidence must be taken live on site. Each shot is tagged
 * with a GPS fix and checked against the project geofence before it is saved
 * offline (expo-sqlite + TinyBase); the background uploader + sync push it later.
 */
export function CaptureScreen({ navigation, route }: Props) {
  const { project, milestoneEntryId } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<Location.LocationObjectCoords | null>(null);
  const haptics = useHaptics();
  const cameraRef = useRef<CameraView>(null);

  // Ask for location ONCE when the screen opens (not per-photo). The OS
  // remembers the grant, so a re-prompt only happens if it was never decided.
  useEffect(() => {
    let active = true;
    (async () => {
      let status = await Location.getForegroundPermissionsAsync();
      if (!status.granted && status.canAskAgain) {
        status = await Location.requestForegroundPermissionsAsync();
      }
      if (active) {
        setLocationGranted(status.granted);
        if (status.granted) {
          try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (active) setCurrentCoords(loc.coords);
          } catch {}
        }
      }
    })();
    return () => { active = false; };
  }, []);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>Camera access is required to capture evidence.</Text>
        <Button title="Grant camera access" onPress={requestPermission} />
      </View>
    );
  }

  async function capture() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ skipProcessing: true });
      if (!photo?.uri) throw new Error("capture failed");

      // Best-effort GPS fix (offline-tolerant). Uses the permission decided once
      // on mount — a denied permission doesn't block capture; the photo just
      // syncs as geofence 'unknown' and is flagged for office review (the
      // location banner already tells the Clerk this, so no per-photo prompt).
      let coords: Location.LocationObjectCoords | null = null;
      if (locationGranted) {
        try {
          coords = (await Location.getCurrentPositionAsync({})).coords;
        } catch {
          // GPS read failed (no fix yet) — fall through as 'location unknown'.
        }
      }

      // Provisional content hash; the uploader replaces it with the server's.
      const b64 = await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, b64);

      const { draft, warning } = buildEvidenceDraft(
        {
          milestoneEntryId,
          localUri: photo.uri,
          hash,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          capturedAt: new Date().getTime(),
        },
        project,
      );

      addEvidence(draft);

      setCount((c) => c + 1);
      haptics.light();
      if (warning) Alert.alert("Location check", warning);
    } catch (e) {
      Alert.alert("Capture error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startVideoRecording() {
    if (!cameraRef.current || recording) return;
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync();
      if (result?.uri) {
        setVideoUri(result.uri);
        haptics.light();
      }
    } catch (e) {
      Alert.alert("Recording error", (e as Error).message);
      setRecording(false);
    }
  }

  async function stopVideoRecording() {
    if (!cameraRef.current || !recording) return;
    try {
      await cameraRef.current.stopRecording();
    } catch {
      // stopRecording resolves once recordAsync settles
    }
    setRecording(false);
  }

  async function submitVideo() {
    if (!videoUri || busy) return;
    setBusy(true);
    try {
      const remoteUrl = await uploadProofPhoto(videoUri, "video/mp4");

      let coords: Location.LocationObjectCoords | null = null;
      if (locationGranted) {
        try {
          coords = (await Location.getCurrentPositionAsync({})).coords;
        } catch {
          // no fix
        }
      }

      const b64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, b64);

      const { draft, warning } = buildEvidenceDraft(
        {
          milestoneEntryId,
          mediaType: MEDIA_TYPE.VIDEO,
          localUri: videoUri,
          hash,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          capturedAt: new Date().getTime(),
        },
        project,
      );

      addEvidence(draft);
      setCount((c) => c + 1);
      setVideoUri(null);
      haptics.light();
      if (warning) Alert.alert("Location check", warning);
    } catch (e) {
      Alert.alert("Upload error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function discardVideo() {
    setVideoUri(null);
  }

  const geofence = (() => {
    if (!currentCoords || project.site_latitude == null || project.site_longitude == null) {
      return null;
    }
    return classifyGeofence(
      { latitude: currentCoords.latitude, longitude: currentCoords.longitude },
      { latitude: project.site_latitude, longitude: project.site_longitude, radiusM: project.geofence_radius_m },
    );
  })();

  return (
    <View style={styles.fill}>
      <CameraView ref={cameraRef} style={styles.fill} facing="back" />

      {/* Geofence Live Proximity Pill */}
      {geofence && (
        <View style={[styles.geofencePill, geofence.status === "verified" ? styles.geofenceVerified : styles.geofenceFlagged]}>
          <Text style={styles.geofenceText}>
            {geofence.status === "verified"
              ? `\u25CF On-Site Verified (${Math.round(geofence.distanceM)}m to center)`
              : `\u26A0 Outside Site Geofence (${Math.round(geofence.distanceM)}m away)`}
          </Text>
        </View>
      )}

      {/* Audit Watermark HUD Banner */}
      <View style={styles.watermarkHud}>
        <Text style={styles.watermarkProject}>
          {project.code ? `[${project.code}] ` : ""}{project.name}
        </Text>
        <Text style={styles.watermarkMeta}>
          {currentCoords
            ? `GPS: ${currentCoords.latitude.toFixed(5)}°, ${currentCoords.longitude.toFixed(5)}°`
            : "GPS: Acquiring fix…"}
          {" · "}
          {new Date().toISOString().replace("T", " ").slice(0, 16)} UTC
        </Text>
      </View>

      {/* Target Viewfinder Overlay */}
      <View pointerEvents="none" style={styles.viewfinder}>
        <View style={styles.viewfinderBox} />
        <Text style={styles.viewfinderText}>Frame physical milestone work clearly</Text>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "photo" && styles.modeBtnActive]}
          onPress={() => { setMode("photo"); setVideoUri(null); }}
          accessibilityRole="button"
          accessibilityLabel="Photo mode"
        >
          <Text style={[styles.modeBtnText, mode === "photo" && styles.modeBtnTextActive]}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "video" && styles.modeBtnActive]}
          onPress={() => setMode("video")}
          accessibilityRole="button"
          accessibilityLabel="Video mode"
        >
          <Text style={[styles.modeBtnText, mode === "video" && styles.modeBtnTextActive]}>Video</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        {locationGranted === false && (
          <Text style={styles.warn}>
            Location off — media will sync as "location unknown". Enable location in Settings to geotag.
          </Text>
        )}

        {mode === "photo" ? (
          <>
            <Text style={styles.count}>{count} photo(s) captured</Text>
            <Button title={busy ? "Saving\u2026" : "Capture evidence"} onPress={capture} disabled={busy} />
          </>
        ) : videoUri ? (
          <>
            <Text style={styles.count}>{count} video(s) captured</Text>
            <View style={styles.videoPreview}>
              <Text style={styles.videoPreviewText}>Video: {videoUri.split("/").pop()}</Text>
            </View>
            <View style={styles.videoActions}>
              <Button title="Submit video" onPress={submitVideo} disabled={busy} />
              <Button title="Discard" onPress={discardVideo} disabled={busy} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.count}>{count} video(s) captured</Text>
            {recording ? (
              <Button title="Stop recording" onPress={stopVideoRecording} />
            ) : (
              <Button title="Start recording" onPress={startVideoRecording} disabled={busy} />
            )}
          </>
        )}

        <Button title="Done" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  modeToggle: {
    position: "absolute", top: 60, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 8,
    zIndex: 10,
  },
  modeBtn: {
    backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "transparent",
  },
  modeBtnActive: { backgroundColor: "#d92d2d", borderColor: "#fff" },
  modeBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  modeBtnTextActive: { fontWeight: "700" },
  controls: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center", gap: 8 },
  count: { color: "#fff", fontWeight: "600" },
  videoPreview: {
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8,
  },
  videoPreviewText: { color: "#fff", fontSize: 13 },
  videoActions: { flexDirection: "row", gap: 8 },
  warn: {
    color: "#fff", backgroundColor: "rgba(180,83,9,0.9)", fontSize: 12, fontWeight: "600",
    textAlign: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginHorizontal: 16,
  },
  geofencePill: {
    position: "absolute", top: 110, left: 20, right: 20,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16,
    alignItems: "center", zIndex: 10,
  },
  geofenceVerified: { backgroundColor: "rgba(22,163,74,0.85)" },
  geofenceFlagged: { backgroundColor: "rgba(220,38,38,0.85)" },
  geofenceText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  watermarkHud: {
    position: "absolute",
    top: 55,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#22c55e",
    zIndex: 10,
  },
  watermarkProject: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  watermarkMeta: {
    color: "#a3e635",
    fontSize: 11,
    marginTop: 2,
    fontFamily: "monospace",
  },
  viewfinder: {
    position: "absolute", top: "25%", left: "10%", right: "10%",
    height: "40%", alignItems: "center", justifyContent: "center",
  },
  viewfinderBox: {
    width: "100%", height: "100%",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.4)", borderRadius: 12,
    borderStyle: "dashed",
  },
  viewfinderText: {
    color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", marginTop: 8,
    backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
});

