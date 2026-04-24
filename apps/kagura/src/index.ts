#!/usr/bin/env node
import { startApp } from './start-app.js';

startApp().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
});
