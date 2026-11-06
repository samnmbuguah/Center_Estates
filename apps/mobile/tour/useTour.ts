import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { COW_MOBILE_TOUR, MOBILE_TOUR, type TourStep } from "./tourSteps";

const STORAGE_KEY = "mobile_tour_completed";

const ROLE_TOURS: Record<string, TourStep[]> = {
  clerk_of_works: COW_MOBILE_TOUR,
  project_manager: MOBILE_TOUR,
  qs: MOBILE_TOUR,
  financier: MOBILE_TOUR,
  admin: MOBILE_TOUR,
  engineer: MOBILE_TOUR,
  contractor: MOBILE_TOUR,
};

function getStepsForRole(role?: string): TourStep[] {
  if (!role) return MOBILE_TOUR;
  return ROLE_TOURS[role] || MOBILE_TOUR;
}

export interface TourState {
  active: boolean;
  currentStep: number;
  steps: TourStep[];
}

export function useTour(role?: string) {
  const steps = getStepsForRole(role);
  const [state, setState] = useState<TourState>({
    active: false,
    currentStep: 0,
    steps,
  });

  const [completed, setCompleted] = useState(true);

  // Check if tour was completed on mount
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((val) => setCompleted(val === "true"))
      .catch(() => setCompleted(false));
  }, []);

  const markCompleted = useCallback(async () => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, "true");
      setCompleted(true);
    } catch {}
  }, []);

  const resetCompleted = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      setCompleted(false);
    } catch {}
  }, []);

  const start = useCallback(() => {
    setState({ active: true, currentStep: 0, steps });
  }, [steps]);

  const stop = useCallback(() => {
    setState({ active: false, currentStep: 0, steps });
    markCompleted();
  }, [steps, markCompleted]);

  const goNext = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep >= prev.steps.length - 1) {
        markCompleted();
        return { ...prev, active: false, currentStep: 0 };
      }
      return { ...prev, currentStep: prev.currentStep + 1 };
    });
  }, [markCompleted]);

  const goPrev = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }));
  }, []);

  const goToStep = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(index, prev.steps.length - 1),
    }));
  }, []);

  return {
    isActive: state.active,
    currentStep: state.currentStep,
    steps: state.steps,
    step: state.steps[state.currentStep] || null,
    totalSteps: state.steps.length,
    completed,
    start,
    stop,
    goNext,
    goPrev,
    goToStep,
    resetCompleted,
  };
}
