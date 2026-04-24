import { describe, expect, it } from 'vitest';

import { buildManifest } from '../src/slack/manifest-template.js';
import { buildPrefillUrl } from '../src/slack/prefill-url.js';

describe('buildPrefillUrl', () => {
  it('encodes manifest into new_app URL when under 8KB', () => {
    const m = buildManifest({ appName: 'Kagura', botDisplayName: 'kagura' });
    const res = buildPrefillUrl(m);
    expect(res.kind).toBe('url');
    if (res.kind === 'url') {
      expect(res.url.startsWith('https://api.slack.com/apps?new_app=1&manifest_json=')).toBe(true);
      const encoded = res.url.split('manifest_json=')[1]!;
      const decoded = JSON.parse(decodeURIComponent(encoded));
      expect(decoded.display_information.name).toBe('Kagura');
    }
  });

  it('returns too-long fallback above 8KB', () => {
    const m = buildManifest({ appName: 'X'.repeat(9000), botDisplayName: 'x' });
    const res = buildPrefillUrl(m);
    expect(res.kind).toBe('too-long');
  });
});
