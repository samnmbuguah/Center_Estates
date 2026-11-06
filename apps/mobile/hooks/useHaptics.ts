/**
 * Haptic feedback hook for critical user actions.
 * Uses expo-haptics for physical feedback on submit, capture, sign, and errors.
 * Falls back silently if haptics are unavailable.
 */
import * as Haptics from "expo-haptics";
import { useCallback } from "react";

export function useHaptics() {
  const light = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }, []);

  const medium = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  }, []);

  const heavy = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  }, []);

  const success = useCallback(() => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  }, []);

  const error = useCallback(() => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
  }, []);

  const warning = useCallback(() => {
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
  }, []);

  const selection = useCallback(() => {
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  return { light, medium, heavy, success, error, warning, selection };
}
