import { describe, expect, it } from 'vitest';
import { pts, wave } from '../fmt';

describe('wave', () => {
  it('shows one decimal, always, so a column lines up', () => {
    expect(wave(17.64705882)).toBe('17.6');
    expect(wave(22)).toBe('22.0');
    expect(wave(8.681818182)).toBe('8.7');
  });
  it('shows a dash for no WAVE rather than a misleading zero', () => {
    expect(wave(null)).toBe('—');
    expect(wave(undefined)).toBe('—');
    expect(wave(0)).toBe('0.0');
  });
});

describe('pts', () => {
  it('drops trailing zeros and keeps real decimals', () => {
    expect(pts(11)).toBe('11');
    expect(pts(2.25)).toBe('2.25');
    expect(pts(0.5)).toBe('0.5');
  });
  it('rounds a repeating split to three places, matching the stored total', () => {
    expect(pts(11.666666666666668)).toBe('11.667');
    expect(pts(9.666666666666666)).toBe('9.667');
  });
  it('treats nothing as zero points', () => {
    expect(pts(null)).toBe('0');
    expect(pts(0)).toBe('0');
  });
});
