/** Event bus — rafraîchit le rail d’activités admin après une mutation. */

export const ADMIN_ACTIVITY_REFRESH = "opt1mum:admin-activity-refresh";

export function notifyAdminActivityRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_ACTIVITY_REFRESH));
}
