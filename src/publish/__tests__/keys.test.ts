import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicUrl, randomKey } from '../keys';

describe('publicUrl', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names the deployment the app is running on', () => {
    vi.stubGlobal('location', { origin: 'https://publish.aok9.pages.dev' });
    expect(publicUrl('abcdefghij1234')).toBe('https://publish.aok9.pages.dev/r/abcdefghij1234');
  });

  it('falls back to the live site where there is no browser', () => {
    expect(typeof location).toBe('undefined');
    expect(publicUrl('abcdefghij1234')).toBe('https://aok9rms.gazehound.io/r/abcdefghij1234');
  });
});

describe('randomKey', () => {
  it('makes lower-case alphanumerics of the asked length', () => {
    for (const n of [14, 32]) {
      const k = randomKey(n);
      expect(k).toHaveLength(n);
      expect(k).toMatch(/^[a-z0-9]+$/);
    }
    expect(randomKey(14)).not.toBe(randomKey(14));
  });
});
