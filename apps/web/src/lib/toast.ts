export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

const TOAST_EVENT = "ce_toast_event";

class ToastManager {
  private notify(item: Omit<ToastItem, "id">) {
    if (typeof window === "undefined") return;
    const toast: ToastItem = {
      ...item,
      id: "toast_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
      duration: item.duration ?? 4000,
    };
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: toast }));
  }

  success(message: string, options?: { title?: string; duration?: number; action?: ToastItem["action"] }) {
    this.notify({ type: "success", message, ...options });
  }

  error(message: string, options?: { title?: string; duration?: number; action?: ToastItem["action"] }) {
    this.notify({ type: "error", message, ...options });
  }

  warning(message: string, options?: { title?: string; duration?: number; action?: ToastItem["action"] }) {
    this.notify({ type: "warning", message, ...options });
  }

  info(message: string, options?: { title?: string; duration?: number; action?: ToastItem["action"] }) {
    this.notify({ type: "info", message, ...options });
  }
}

export const toast = new ToastManager();
export { TOAST_EVENT };
