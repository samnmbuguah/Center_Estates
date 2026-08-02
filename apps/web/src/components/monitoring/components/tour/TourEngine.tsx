"use client";

import type { TourState } from "./useTour";

interface TourEngineProps {
  state: TourState;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
}

export function TourEngine({ state }: TourEngineProps) {
  if (!state?.active || state.steps.length === 0) return null;
  return null;
}
