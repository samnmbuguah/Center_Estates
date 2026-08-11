"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/monitoring/hooks/useToast";

type SavedControl = { name: string; value?: string; checked?: boolean };
type SavedForm = { version: 1; savedAt: string; controls: SavedControl[] };
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const sensitiveName = /(password|passwd|secret|token|credential|card|cvv|pin_code)/i;

function eligible(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  return Boolean(
    control.name && !control.disabled && control.dataset.noDraft !== "true" &&
    !(control instanceof HTMLInputElement && ["password", "file"].includes(control.type)) &&
    !sensitiveName.test(control.name),
  );
}

function setNativeValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = control instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

export function FormRecoveryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const { toast } = useToast();
  const pendingForm = useRef<HTMLFormElement | null>(null);
  const scope = `${session?.activeOrganizationId || "anonymous"}:${session?.user.id || "anonymous"}`;

  useEffect(() => {
    if (pathname === "/login" || pathname === "/sign-up") return;
    const formKey = (form: HTMLFormElement) => {
      const forms = [...document.forms];
      const identity = form.dataset.draftKey || form.id || form.getAttribute("aria-labelledby") || `form-${forms.indexOf(form)}`;
      return `ce-native-form-draft:v1:${scope}:${pathname}:${identity}`;
    };
    const controls = (form: HTMLFormElement) => [...form.elements].filter(
      (item): item is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
        item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement,
    ).filter(eligible);
    const save = (form: HTMLFormElement) => {
      const payload: SavedForm = {
        version: 1,
        savedAt: new Date().toISOString(),
        controls: controls(form).map((control) => ({
          name: control.name,
          ...(control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)
            ? { checked: control.checked, value: control.value }
            : { value: control.value }),
        })),
      };
      try {
        if (payload.controls.some((control) => control.value || control.checked)) {
          localStorage.setItem(formKey(form), JSON.stringify(payload));
        }
      } catch { /* Storage unavailable; never interrupt form entry. */ }
    };
    const restore = (form: HTMLFormElement) => {
      const key = formKey(form);
      if (form.dataset.draftRestored === key) return;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const payload = JSON.parse(raw) as SavedForm;
        if (payload.version !== 1 || !payload.savedAt || Date.now() - new Date(payload.savedAt).getTime() > DRAFT_TTL_MS) {
          localStorage.removeItem(key);
          return;
        }
        for (const saved of payload.controls) {
          const matching = controls(form).filter((control) => control.name === saved.name);
          for (const control of matching) {
            if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) {
              control.checked = Boolean(saved.checked && (control.type !== "radio" || control.value === saved.value));
              control.dispatchEvent(new Event("change", { bubbles: true }));
            } else if (saved.value !== undefined) setNativeValue(control, saved.value);
          }
        }
        form.dataset.draftRestored = key;
        const hasFileInput = Boolean(form.querySelector('input[type="file"]'));
        toast.info(hasFileInput
          ? "Your unsaved form was restored. For security, please reselect any files."
          : "Your unsaved form was restored automatically.");
      } catch {
        localStorage.removeItem(key);
      }
    };
    const restoreAll = () => document.querySelectorAll("form").forEach((form) => restore(form));
    const onInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const form = target.closest("form");
        if (form) save(form);
      }
    };
    const onSubmit = (event: Event) => {
      if (event.target instanceof HTMLFormElement) {
        pendingForm.current = event.target;
        save(event.target);
      }
    };
    const onSaved = () => {
      if (!pendingForm.current) return;
      localStorage.removeItem(formKey(pendingForm.current));
      delete pendingForm.current.dataset.draftRestored;
      pendingForm.current = null;
    };
    const observer = new MutationObserver(() => window.setTimeout(restoreAll, 0));
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("ce:mutation-success", onSaved);
    observer.observe(document.body, { childList: true, subtree: true });
    restoreAll();
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("ce:mutation-success", onSaved);
      observer.disconnect();
    };
  }, [pathname, scope, toast]);

  return children;
}
