/**
 * Captcha Turnstile activé si NEXT_PUBLIC_CAPTCHA=true|1|yes|on
 * et qu'une site key est définie.
 */
function flagOn(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase() ?? "";
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export function isCaptchaEnabled(): boolean {
  return flagOn(process.env.NEXT_PUBLIC_CAPTCHA);
}

export function isTurnstileRequired(): boolean {
  return (
    isCaptchaEnabled() &&
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())
  );
}
