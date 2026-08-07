"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

type OtpBoxesProps = {
  value: string;
  onChange: (otp: string) => void;
  disabled?: boolean;
  length?: number;
  hasError?: boolean;
};

export function OtpBoxes({
  value,
  onChange,
  disabled = false,
  length = 6,
  hasError = false,
}: OtpBoxesProps) {
  const id = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    refs.current = refs.current.slice(0, length);
  }, [length]);

  const focusAt = useCallback((index: number) => {
    const el = refs.current[index];
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = useCallback(
    (next: string[]) => {
      onChange(next.join("").slice(0, length));
    },
    [length, onChange],
  );

  const handleChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      commit(next);
      return;
    }

    const chars = cleaned.split("");
    const next = [...digits];
    let cursor = index;
    for (const ch of chars) {
      if (cursor >= length) break;
      next[cursor] = ch;
      cursor += 1;
    }
    commit(next);
    focusAt(Math.min(cursor, length - 1));
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        commit(next);
        return;
      }
      if (index > 0) {
        e.preventDefault();
        const next = [...digits];
        next[index - 1] = "";
        commit(next);
        focusAt(index - 1);
      }
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    const next = Array.from({ length }, (_, i) => pasted[i] ?? "");
    commit(next);
    focusAt(Math.min(pasted.length, length) - 1);
  };

  return (
    <div
      className={`auth-otp${hasError ? " is-invalid" : ""}`}
      role="group"
      aria-label="Code OTP à 6 chiffres"
    >
      {digits.map((digit, index) => (
        <input
          key={`${id}-${index}`}
          ref={(el) => {
            refs.current[index] = el;
          }}
          id={index === 0 ? "otp" : undefined}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          className="auth-otp__cell"
          value={digit}
          disabled={disabled}
          aria-label={`Chiffre ${index + 1}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
