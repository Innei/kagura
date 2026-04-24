import { describe, expect, it } from 'vitest';

import { redact, redactUnknown } from '~/logger/redact.js';

describe('redact', () => {
  it('redacts Slack token patterns even when the exact env value is not registered', () => {
    const text =
      'Authorization: Bearer xoxb-1234567890-abcdef token=xoxe.xoxp-1-secret refresh_token=xoxe-1-refresh';

    expect(redact(text)).toBe(
      'Authorization: [REDACTED] token=[REDACTED] refresh_token=[REDACTED]',
    );
  });

  it('redacts nested error objects before logging', () => {
    const error = {
      config: {
        headers: {
          Authorization: 'Bearer xoxb-1234567890-secret',
        },
      },
      message: 'token=xapp-1234567890-secret',
    };

    const output = redactUnknown(error);

    expect(output).not.toContain('xoxb-1234567890-secret');
    expect(output).not.toContain('xapp-1234567890-secret');
    expect(output).toContain('[REDACTED]');
  });
});
