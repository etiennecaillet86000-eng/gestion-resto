import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type React from "react";

/** Validates that a string is a valid number (digits + one decimal . or ,). Empty string is valid (= 0). */
export function validateNumber(val: string): boolean {
  if (!val || val.trim() === "") return true;
  // Allow comma or dot as decimal separator, digits only
  const normalized = val.replace(",", ".");
  return /^\d*\.?\d*$/.test(normalized) && normalized !== ".";
}

/** Parse a numeric string (accepts comma) to a float. Returns 0 for empty/invalid. */
export function parseNumber(val: string): number {
  if (!val || val.trim() === "") return 0;
  const normalized = val.replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
}

interface NumericInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "type" | "value"
  > {
  value: string;
  onChange: (val: string) => void;
}

/**
 * A text input that only accepts numeric values (digits + one decimal separator . or ,).
 * Shows a red border and error message when the value is invalid.
 */
export function NumericInput({
  value,
  onChange,
  className,
  ...props
}: NumericInputProps) {
  const showError = !validateNumber(value) && value !== "";

  return (
    <div className="space-y-1">
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          className,
          showError && "border-red-500 focus-visible:ring-red-500",
        )}
        {...props}
      />
      {showError && (
        <p className="text-xs text-red-500">
          Format invalide. Utilisez uniquement des chiffres
        </p>
      )}
    </div>
  );
}
