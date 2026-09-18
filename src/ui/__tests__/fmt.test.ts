import { describe, expect, it } from 'vitest';
import { ordinal, pts, wave } from '../fmt';

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

describe('ordinal', () => {
  it('labels the four places of a race', () => {
    expect([1, 2, 3, 4].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th']);
  });
  it('gets the teens right, should a race ever need them', () => {
    expect([11, 12, 13, 21, 22, 23, 111].map(ordinal)).toEqual(['11th', '12th', '13th', '21st', '22nd', '23rd', '111th']);
  });
});
