"use client";

import { useState, useCallback, useEffect, ReactNode } from "react";
import {
  TextField, Box, Typography, InputAdornment, IconButton,
  Collapse, Alert, Chip, Tooltip, CircularProgress, InputLabel
} from "@mui/material";
import { Check, X, Eye, EyeOff, Info, AlertCircle } from "lucide-react";

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
  severity?: "error" | "warning" | "info";
}

export interface EnhancedFormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  validationRules?: ValidationRule[];
  showStrengthMeter?: boolean;
  strengthMeterType?: "password" | "general";
  placeholder?: string;
  tooltip?: string;
  progressiveDisclosure?: {
    triggerValue: string;
    additionalFields: ReactNode;
  };
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  type?: "text" | "password" | "email" | "number" | "tel";
  fullWidth?: boolean;
  multiline?: boolean;
  rows?: number;
  sx?: object;
}

export function EnhancedFormField({
  label,
  value,
  onChange,
  validationRules = [],
  showStrengthMeter = false,
  strengthMeterType = "general",
  placeholder,
  tooltip,
  progressiveDisclosure,
  autoComplete = "off",
  disabled = false,
  required = false,
  type = "text",
  fullWidth = true,
  multiline = false,
  rows,
  sx
}: EnhancedFormFieldProps) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Array<{ message: string; severity: string }>>([]);
  const [strength, setStrength] = useState(0);

  // Validate field value
  const validate = useCallback((val: string) => {
    const newErrors: Array<{ message: string; severity: string }> = [];
    
    validationRules.forEach(rule => {
      if (!rule.validate(val)) {
        newErrors.push({
          message: rule.message,
          severity: rule.severity || "error"
        });
      }
    });

    setErrors(newErrors);
    
    // Calculate strength for password fields
    if (showStrengthMeter && strengthMeterType === "password") {
      let score = 0;
      if (val.length >= 8) score += 1;
      if (val.length >= 12) score += 1;
      if (/[A-Z]/.test(val)) score += 1;
      if (/[a-z]/.test(val)) score += 1;
      if (/[0-9]/.test(val)) score += 1;
      if (/[^A-Za-z0-9]/.test(val)) score += 1;
      setStrength(Math.min(score, 5));
    } else if (showStrengthMeter && strengthMeterType === "general") {
      const score = Math.min(val.length / 10, 1);
      setStrength(score);
    }

    return newErrors.length === 0;
  }, [validationRules, showStrengthMeter, strengthMeterType]);

  // Validate on value change and on blur
  useEffect(() => {
    if (touched) {
      validate(value);
    }
  }, [value, validate, touched]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    setFocused(false);
    setTouched(true);
    validate(value);
  };

  const handleFocus = () => {
    setFocused(true);
  };

  const hasErrors = errors.length > 0;
  const hasProgressiveDisclosure = progressiveDisclosure ? value === progressiveDisclosure.triggerValue : false;

  const getStrengthColor = () => {
    if (strength <= 1) return "var(--color-danger)";
    if (strength <= 2) return "var(--color-amber)";
    if (strength <= 3) return "#eab308";
    if (strength <= 4) return "var(--color-green)";
    return "var(--color-success)";
  };

  const getStrengthLabel = () => {
    if (strength <= 1) return "Weak";
    if (strength <= 2) return "Fair";
    if (strength <= 3) return "Good";
    if (strength <= 4) return "Strong";
    return "Very Strong";
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
        <InputLabel sx={{ fontWeight: 600, color: "text.secondary" }}>
          {label}
        </InputLabel>
        {tooltip && (
          <Tooltip title={tooltip} arrow>
            <IconButton size="small" sx={{ p: 0.2 }}>
              <Info size={14} style={{ color: "var(--text-faint)" }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <TextField
        fullWidth={fullWidth}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete={autoComplete}
        error={hasErrors && touched}
        type={showPassword ? "text" : type}
        disabled={disabled}
        required={required}
        multiline={multiline}
        rows={rows}
        slotProps={{
          input: {
            endAdornment: (
              <>
                {type === "password" && (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                )}
                {touched && !hasErrors && value && (
                  <InputAdornment position="end">
                    <Check size={18} style={{ color: "var(--color-green)" }} />
                  </InputAdornment>
                )}
                {touched && hasErrors && (
                  <InputAdornment position="end">
                    <X size={18} style={{ color: "var(--color-danger)" }} />
                  </InputAdornment>
                )}
              </>
            ),
          }
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            "&:hover fieldset": {
              borderColor: focused ? "var(--color-indigo)" : "inherit",
            },
            "&.Mui-focused fieldset": {
              borderColor: hasErrors ? "var(--color-danger)" : "var(--color-indigo)",
            },
          },
          ...sx,
        }}
      />

      {/* Strength Meter */}
      {showStrengthMeter && value && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <Box 
              sx={{ 
                flex: 1, 
                height: 4, 
                borderRadius: 2, 
                bgcolor: "var(--color-slate-200)",
                overflow: "hidden"
              }}
            >
              <Box 
                sx={{ 
                  width: `${strength * 20}%`, 
                  height: "100%", 
                  bgcolor: getStrengthColor(),
                  transition: "all 0.3s ease"
                }} 
              />
            </Box>
            <Typography variant="caption" sx={{ fontSize: 10, color: getStrengthColor(), fontWeight: 600 }}>
              {getStrengthLabel()}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Validation Errors */}
      <Collapse in={hasErrors && touched}>
        <Box sx={{ mt: 1 }}>
          {errors.map((error, index) => (
            <Alert 
              key={index}
              severity={error.severity as any}
              icon={<AlertCircle size={16} />}
              sx={{ 
                py: 0.5, 
                px: 1, 
                fontSize: 12,
                "& .MuiAlert-message": { px: 0 }
              }}
            >
              {error.message}
            </Alert>
          ))}
        </Box>
      </Collapse>

      {/* Progressive Disclosure */}
      <Collapse in={hasProgressiveDisclosure}>
        <Box sx={{ mt: 2, p: 2, bgcolor: "rgba(79, 70, 229, 0.05)", borderRadius: 1.5, border: "1px solid rgba(79, 70, 229, 0.2)" }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--color-indigo)", display: "block", mb: 1 }}>
            Additional Options
          </Typography>
          {progressiveDisclosure?.additionalFields}
        </Box>
      </Collapse>
    </Box>
  );
}

// Common validation rules
export const commonValidationRules = {
  required: (message = "This field is required"): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message,
    severity: "error" as const
  }),
  
  email: (message = "Please enter a valid email address"): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
    severity: "error" as const
  }),
  
  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
    severity: "error" as const
  }),
  
  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value) => value.length <= max,
    message: message || `Must not exceed ${max} characters`,
    severity: "error" as const
  }),
  
  phone: (message = "Please enter a valid phone number"): ValidationRule => ({
    validate: (value) => /^[\d\s\+\-\(\)]{10,}$/.test(value.replace(/\s/g, "")),
    message,
    severity: "error" as const
  }),
  
  password: (message = "Password must include uppercase, lowercase, number, and special character"): ValidationRule => ({
    validate: (value) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(value),
    message,
    severity: "error" as const
  }),
  
  numeric: (message = "Please enter a valid number"): ValidationRule => ({
    validate: (value) => /^\d*\.?\d+$/.test(value) || value === "",
    message,
    severity: "error" as const
  }),
  
  positiveNumber: (message = "Please enter a positive number"): ValidationRule => ({
    validate: (value) => parseFloat(value) > 0 || value === "",
    message,
    severity: "error" as const
  }),
  
  url: (message = "Please enter a valid URL"): ValidationRule => ({
    validate: (value) => /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(value) || value === "",
    message,
    severity: "error" as const
  })
};