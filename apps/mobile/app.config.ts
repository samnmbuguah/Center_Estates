import type { ExpoConfig } from "expo/config";

/**
 * Runs in STANDARD EXPO GO — no custom dev build required. The local database
 * is expo-sqlite (bundled into Expo Go) with TinyBase as the reactive layer, so
 * there are no custom native modules. Camera/location/biometrics/secure-store
 * are all part of the Expo SDK and available in Expo Go.
 */
const isEAS = Boolean(process.env.EAS_BUILD);

const config: ExpoConfig = {
  name: "Construction Management",
  slug: "monitoringerp",
  ...(isEAS ? { owner: "samnmbuguah" } : {}),
  scheme: "monitoringcow",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.center.monitoringcow",
    infoPlist: {
      NSCameraUsageDescription: "Capture site progress evidence photos.",
      NSLocationWhenInUseUsageDescription: "Tag evidence with the site location.",
      NSFaceIDUsageDescription: "Unlock the app and confirm submissions.",
    },
  },
  android: {
    package: "com.center.monitoringcow",
    permissions: ["CAMERA", "ACCESS_FINE_LOCATION", "USE_BIOMETRIC"],
  },
  plugins: [
    "expo-camera",
    "expo-location",
    "expo-local-authentication",
    "expo-secure-store",
    // Durable release signing for the bare `expo prebuild` + Gradle path.
    // No-op for Expo Go / EAS builds; only affects a generated android/ project.
    "./plugins/withReleaseSigning",
  ],
  ...(isEAS
    ? {
        extra: {
          eas: { projectId: "3833bc88-6a11-4de5-98c7-21702a9df397" },
        },
      }
    : {}),
};

export default config;
