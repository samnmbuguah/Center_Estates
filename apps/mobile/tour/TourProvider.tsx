import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { TourOverlay } from "./TourOverlay";
import { useTour } from "./useTour";
import type { TourStep } from "./tourSteps";

interface TourContextValue {
  completed: boolean;
  startTour: () => void;
  resetTour: () => void;
}

const TourCtx = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, me } = useAuth();
  const role = me?.roles?.[0];
  const tour = useTour(role);

  return (
    <TourCtx.Provider
      value={{
        completed: tour.completed,
        startTour: tour.start,
        resetTour: tour.resetCompleted,
      }}
    >
      {children}
      {tour.isActive && (
        <TourNavigator
          step={tour.step}
          currentStep={tour.currentStep}
          totalSteps={tour.totalSteps}
          onNext={tour.goNext}
          onPrev={tour.goPrev}
          onStop={tour.stop}
        />
      )}
    </TourCtx.Provider>
  );
}

function TourNavigator({
  step,
  currentStep,
  totalSteps,
  isActive,
  onNext,
  onPrev,
  onStop,
}: {
  step: TourStep | null;
  currentStep: number;
  totalSteps: number;
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
}) {
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (!step) return;
    try {
      navigation.navigate(step.screen, step.params ?? {});
    } catch {}
  }, [step?.id]);

  return (
    <TourOverlay
      step={step}
      currentStep={currentStep}
      totalSteps={totalSteps}
      onNext={onNext}
      onPrev={onPrev}
      onStop={onStop}
    />
  );
}

export function useTourContext(): TourContextValue {
  const ctx = useContext(TourCtx);
  if (!ctx) throw new Error("useTourContext must be used within TourProvider");
  return ctx;
}
