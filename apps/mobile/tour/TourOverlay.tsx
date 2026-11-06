import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, typography } from "../theme/theme";
import type { TourStep } from "./tourSteps";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TourOverlayProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
}

export function TourOverlay({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onStop,
}: TourOverlayProps) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the spotlight ring
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  // Tooltip positioned from bottom with vertical offset based on step
  const tooltipBottom = Math.max(
    insets.bottom + 20,
    step.verticalPosition < 0.5 ? 120 : 60,
  );

  return (
    <Modal transparent visible animationType="fade">
      {/* Semi-transparent backdrop */}
      <View style={styles.backdrop}>
        {/* Tooltip card */}
        <View
          style={[
            styles.tooltip,
            { bottom: tooltipBottom, marginHorizontal: spacing.md },
          ]}
        >
          {/* Step header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>
                Step {currentStep + 1} of {totalSteps}
              </Text>
              <Text style={styles.title}>{step.title}</Text>
            </View>
            <Pressable
              onPress={onStop}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityLabel="Close tour"
            >
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>

          {/* Content */}
          <Text style={styles.content}>{step.content}</Text>

          {/* Progress bar */}
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable onPress={onStop} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip tour</Text>
            </Pressable>
            <View style={styles.navButtons}>
              {!isFirst && (
                <Pressable onPress={onPrev} style={styles.navBtn}>
                  <Text style={styles.navText}>← Back</Text>
                </Pressable>
              )}
              <Pressable onPress={onNext} style={styles.nextBtn}>
                <Text style={styles.nextText}>
                  {isLast ? "Done" : "Next →"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Spotlight ring */}
        <Animated.View
          style={[
            styles.spotlight,
            {
              top: SCREEN_WIDTH * 0.15,
              alignSelf: "center",
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Screen name indicator */}
        <View style={styles.screenIndicator}>
          <Text style={styles.screenIndicatorText}>{step.screen}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  tooltip: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    flexShrink: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  closeX: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "700",
  },
  content: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  progressBg: {
    height: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 2,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  skipText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  navButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  navBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  navText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
  nextBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  nextText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryText,
  },
  spotlight: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.primary,
    opacity: 0.6,
  },
  screenIndicator: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  screenIndicatorText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 1,
  },
});
