import { useEffect, useRef } from "react";

/**
 * Attaches a native `beforeinput` listener to an <input type="date">
 * to intercept the 5th consecutive digit and inject a "-" separator.
 *
 * Without this, browsers that allow 6-digit years will swallow digits
 * into the year segment (e.g. "202501" instead of "2025-01").
 */
export function useDateAutoAdvance() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    if (!input) return;

    function onBeforeInput(e: InputEvent) {
      if (e.inputType !== "insertText") return;
      const digit = e.data;
      if (!digit || !/^\d$/.test(digit)) return;

      const v = input!.value;
      // Only intercept when the raw value is exactly a 4-digit year
      if (!/^\d{4}$/.test(v)) return;

      e.preventDefault();
      const corrected = v + "-" + digit;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, "value"
      )?.set;
      nativeSetter?.call(input, corrected);
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    }

    input.addEventListener("beforeinput", onBeforeInput);
    return () => input.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  return ref;
}


import React from "react";

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

/** <input type="date"> with auto-advance from year to month. */
export function DateField({ value, onChange, required }: DateFieldProps) {
  const ref = useDateAutoAdvance();
  return (
    <input
      ref={ref}
      type="date"
      className="input-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    />
  );
}
