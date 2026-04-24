#!/usr/bin/env node
import { runCli } from '@kagura/cli';

runCli(process.argv).then(
  (code) => process.exit(code),
  (err) => {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(message);
    process.exit(1);
  },
);
