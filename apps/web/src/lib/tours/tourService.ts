/**
 * Dual-Purpose Interactive Tour Engine
 * -----------------------------------------------------------------------------
 * Wraps Driver.js for:
 *  1) In-app guided demos / walkthroughs (auto-fills inputs, submits forms,
 *     navigates views — demonstrating real user stories).
 *  2) A single source of truth for the matching Playwright E2E specs.
 *
 * All steps use explicit `data-testid` selectors so the in-app tour and the
 * automated suite stay in lock-step (no fragile CSS paths).
 */
"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

export type TourAction =
  | { type: "fill"; testid: string; value: string }
  | { type: "select"; testid: string; value: string }
  | { type: "click"; testid: string }
  | { type: "navigate"; path: string };

export type TourStep = {
  testid: string;
  title: string;
  description: string;
  /** Actions executed when the popover renders for this step. */
  actions?: TourAction[];
  /** Optional callback invoked when the user clicks Next on this step. */
  onNext?: () => void | Promise<void>;
};

export type TourDefinition = {
  id: string;
  label: string;
  steps: TourStep[];
};

/**
 * Programmatically set a field value and dispatch native `input` + `change`
 * events so framework state (React) updates synchronously.
 */
export function setFieldValue(testid: string, value: string) {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[data-testid="${testid}"]`,
  );
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
    "value",
  )?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function clickTestId(testid: string) {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  if (el) el.click();
  return !!el;
}

/**
 * Build a Driver.js instance for a tour definition. Returns a control object
 * so callers can `start()` / `destroy()` and react to completion.
 */
export function createTour(def: TourDefinition) {
  let currentIndex = 0;

  const steps: DriveStep[] = def.steps.map((step) => ({
    element: `[data-testid="${step.testid}"]`,
    popover: {
      title: step.title,
      description: step.description,
      side: "bottom",
      align: "start",
    },
  }));

  function currentStep() {
    return def.steps[currentIndex];
  }

  const driverInstance = driver({
    showProgress: true,
    animate: true,
    allowClose: false,
    onHighlightStarted: (el?: Element) => {
      if (!el) return;
      const step = currentStep();
      if (step?.actions) {
        for (const action of step.actions) {
          if (action.type === "fill" || action.type === "select") setFieldValue(action.testid, action.value);
          if (action.type === "click") clickTestId(action.testid);
          if (action.type === "navigate" && typeof window !== "undefined") {
            window.location.href = action.path;
          }
        }
      }
    },
    onNextClick: async () => {
      const step = currentStep();
      if (step?.onNext) {
        await step.onNext();
      }
      driverInstance.moveNext();
    },
    onDestroyed: () => {
      window.dispatchEvent(new CustomEvent("tour:ended", { detail: { tourId: def.id } }));
    },
  });

  return {
    id: def.id,
    start() {
      currentIndex = 0;
      driverInstance.setSteps(steps);
      driverInstance.drive(0);
      return this;
    },
    next() {
      driverInstance.moveNext();
      return this;
    },
    prev() {
      driverInstance.movePrevious();
      return this;
    },
    destroy() {
      driverInstance.destroy();
    },
    isActive() {
      return driverInstance.isActive();
    },
  };
}

const TOUR_REGISTRY = new Map<string, TourDefinition>();

export function registerTour(def: TourDefinition) {
  TOUR_REGISTRY.set(def.id, def);
  return def;
}

export function listTours() {
  return [...TOUR_REGISTRY.values()];
}

export function getTour(id: string) {
  return TOUR_REGISTRY.get(id);
}
