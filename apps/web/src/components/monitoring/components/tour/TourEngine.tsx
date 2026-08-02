import { useCallback, useMemo, useEffect, useState } from "react";
import { useNavigate, useLocation } from "@/components/monitoring/react-router-shim";
import { Joyride } from "react-joyride";
import type { EventHandler, Step } from "react-joyride";
import type { TourState } from "./useTour";
import { resolveTourTargetSelector } from "./tourTargeting";

interface TourEngineProps {
  state: TourState;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
}

export function TourEngine({ state, onNext, onPrev, onStop }: TourEngineProps) {
  const navigate = useNavigate();
  const loc = useLocation();
  const [ready, setReady] = useState(false);

  // Navigate to the first step's route when the tour starts, then wait for
  // the matching target to become available before enabling the overlay.
  useEffect(() => {
    if (!state.active || state.steps.length === 0) {
      setReady(false);
      return;
    }

    setReady(false);
    const step = state.steps[state.currentStep];
    const targetSelector = resolveTourTargetSelector(step?.target, step?.targetFallback);

    const stepRoute = step?.route === "/app" ? "/app/command-center" : step?.route;
    if (stepRoute && loc.pathname !== stepRoute) {
      navigate(stepRoute);
    }

    const waitForTarget = () => {
      let attempts = 0;
      let timer: number | undefined;

      const poll = () => {
        const target = targetSelector ? document.querySelector(targetSelector) : null;
        if (targetSelector && targetSelector !== "body" && !target) {
          attempts += 1;
          if (attempts >= 24) {
            setReady(true);
            return;
          }
          timer = window.setTimeout(poll, 120);
          return;
        }

        setReady(true);
      };

      timer = window.setTimeout(poll, 150);
      return () => window.clearTimeout(timer);
    };

    const fallbackTimer = window.setTimeout(() => setReady(true), 2500);
    const cleanup = waitForTarget();

    return () => {
      cleanup?.();
      window.clearTimeout(fallbackTimer);
    };
  }, [state.active, state.currentStep, state.steps, navigate, loc.pathname]);

  const joyrideSteps: Step[] = useMemo(() =>
    state.steps.map(s => {
      const sel = resolveTourTargetSelector(s.target, s.targetFallback);
      const el = sel ? document.querySelector(sel) : null;
      return {
        target: el ? sel! : "body",
        content: s.content,
        title: s.title,
        placement: el ? s.placement : "center",
        disableBeacon: true,
        spotlightPadding: s.highlightPadding ?? 6,
      };
    }),
  [state.steps]);

  const handleCallback: EventHandler = useCallback((data) => {
    const { action, index, type } = data;
    if (type !== "step:after" && type !== "tour:end") return;

    if (type === "tour:end") {
      onStop();
      return;
    }

    if (action === "next" || action === "close") {
      const nextStep = state.steps[index + 1];
      const nextRoute = nextStep?.route === "/app" ? "/app/command-center" : nextStep?.route;
      if (nextRoute && window.location.pathname !== nextRoute) {
        navigate(nextRoute);
      }
      if (action === "next") onNext();
      else onStop();
    } else if (action === "prev") {
      const prevStep = state.steps[index - 1];
      const prevRoute = prevStep?.route === "/app" ? "/app/command-center" : prevStep?.route;
      if (prevRoute && window.location.pathname !== prevRoute) {
        navigate(prevRoute);
      }
      onPrev();
    }
  }, [state.steps, onNext, onPrev, onStop, navigate]);

  if (!state.active || state.steps.length === 0) return null;

  return (
    <Joyride
      key={`${state.active ? "tour" : "idle"}-${state.currentStep}-${loc.pathname}`}
      steps={joyrideSteps}
      run={ready && state.active}
      stepIndex={state.currentStep}
      onEvent={handleCallback}
      continuous
      scrollToFirstStep
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
      styles={{
        tooltip: {
          borderRadius: 12,
          padding: "16px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          zIndex: 99999,
          background: "#1e293b",
          color: "#f8fafc",
          border: "1px solid #334155",
        },
        tooltipContainer: {
          padding: 0,
          textAlign: "left",
          zIndex: 99999,
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.4,
          marginBottom: 8,
          color: "#ffffff",
        },
        tooltipContent: {
          fontSize: 13,
          lineHeight: 1.6,
          color: "#cbd5e1",
        },
        buttonPrimary: {
          background: "#d92d2d",
          border: "none",
          color: "#ffffff",
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 14px",
          borderRadius: 8,
        },
        buttonBack: {
          background: "transparent",
          border: "1px solid #475569",
          color: "#e2e8f0",
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 14px",
          borderRadius: 8,
          marginRight: 8,
        },
        buttonSkip: {
          color: "#94a3b8",
          fontSize: 13,
          padding: "6px 8px",
          borderRadius: 6,
        },
      }}
    />
  );
}
