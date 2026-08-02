import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}

export function FormField({ label, required, error, hint, children, style }: FormFieldProps) {
  return (
    <div className="field" style={style}>
      <label>
        {label}
        {required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span>}
      {error && <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

interface SubmitButtonProps {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function SubmitButton({ loading, disabled, children, onClick, style, className = "btn" }: SubmitButtonProps) {
  return (
    <button className={className} onClick={onClick} disabled={disabled || loading} style={style}>
      {loading && <span style={{ display: "inline-block", animation: "spin 0.6s linear infinite" }}>⟳</span>}
      {children}
    </button>
  );
}
