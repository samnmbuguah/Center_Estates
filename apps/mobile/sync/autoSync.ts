import { AppState, type AppStateStatus } from "react-native";

import { runSync } from "./sync";

/**
 * Background sync triggers (SRS-MOB-OFF: intermittent connectivity).
 * The Clerk shouldn't have to remember to sync — we retry:
 *   - whenever the app returns to the foreground, and
 *   - on a slow heartbeat while it's open.
 * Failures are silent (offline is normal on site); runSync is also still
 * called explicitly after submissions.
 */
const HEARTBEAT_MS = 60_000;

let running = false;

async function attempt(): Promise<void> {
  if (running) return; // never overlap two sync passes
  running = true;
  try {
    await runSync();
  } catch {
    // offline or server unreachable — next trigger retries
  } finally {
    running = false;
  }
}

/** Start the triggers; returns a stop function (call on sign-out). */
export function startAutoSync(): () => void {
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") void attempt();
  });
  const timer = setInterval(() => void attempt(), HEARTBEAT_MS);
  void attempt(); // catch up immediately on sign-in
  return () => {
    sub.remove();
    clearInterval(timer);
  };
}
