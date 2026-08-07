const ADMIN_EMAIL_KEY = "opt1mum-admin-email";

/** Hint local : prouve qu’un opérateur s’est déjà connecté sur cet appareil. */
export function getAdminEmailHint(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const email = window.localStorage.getItem(ADMIN_EMAIL_KEY)?.trim();
    return email || null;
  } catch {
    return null;
  }
}

export function setAdminEmailHint(email: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export function clearAdminEmailHint() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ADMIN_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
