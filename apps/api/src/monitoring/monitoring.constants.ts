/** Redis key written by the pages worker; read by admin monitoring. */
export const WORKER_HEARTBEAT_KEY = 'opt1mum:magazine-pages:worker:heartbeat';

/** Heartbeat TTL — worker refreshes more often than this. */
export const WORKER_HEARTBEAT_TTL_SEC = 90;

/** Cooldown between monitoring alert emails. */
export const MONITORING_ALERT_COOLDOWN_KEY =
  'opt1mum:monitoring:alert:cooldown';

export const MONITORING_ALERT_COOLDOWN_SEC = 60 * 60; // 1h
