import { useEffect } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";

export function useKeyboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.contentEditable === "true") return;

      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>("input[type=search], input[placeholder*=search i], input[placeholder*=Search i]");
        search?.focus();
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        alert("Keyboard Shortcuts:\n\nn  — Create new item\n/  — Search\n?  — This help");
      }
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        const btn = document.querySelector<HTMLButtonElement>("button.btn:not(.ghost):not(.icon-btn)");
        btn?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}
