import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { authHeaders, apiUrl } from "../sync/api";

// expo-notifications is NOT available in Expo Go SDK 57+
// (it was removed after SDK 53). We lazy-load it so the app doesn't
// crash on startup when the native module is absent.
let Notifications: typeof import("expo-notifications") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require("expo-notifications");
  if (Notifications && typeof Notifications.setNotificationHandler === "function") {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch {
  // Not available in this Expo Go version — skip push notifications.
  Notifications = null;
}

async function registerForPushNotificationsAsync() {
  if (!Notifications) return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    if (Platform.OS === "android" && typeof Notifications.setNotificationChannelAsync === "function") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return token;
  } catch {
    return null;
  }
}

async function sendTokenToServer(token: string) {
  try {
    await fetch(apiUrl("/push-tokens"), {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  } catch {
    // Silently fail — push registration is best-effort.
  }
}

function useNotifications() {
  const responseListener = useRef<any>();

  useEffect(() => {
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) await sendTokenToServer(token);
      } catch {
        // Notifications registration is best-effort — don't crash the app.
      }
    })();

    try {
      if (Notifications && typeof Notifications.addNotificationResponseReceivedListener === "function") {
        responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
          // Future: navigate to a specific screen based on notification data.
        });
      }
    } catch {
      // Ignore in Expo Go
    }

    return () => {
      responseListener.current?.remove();
    };
  }, []);
}

export default useNotifications;
