/**
 * BullMQ worker entrypoint (email, media, subscriptions, payments).
 * Wired in a later iteration — keeps the Docker `worker` service ready.
 */
async function bootstrap() {
  // eslint-disable-next-line no-console
  console.log('OPT1MUM worker started (queues not yet registered)');
  // Keep process alive
  setInterval(() => undefined, 60_000);
}

bootstrap();
