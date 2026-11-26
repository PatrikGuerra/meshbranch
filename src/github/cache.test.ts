import { describe, expect, it } from 'vitest';
import { pickEvictions } from './blobCache';
import { rateNotice } from './limit';

describe('pickEvictions', () => {
  const items = [{ sha: 'new', size: 40, at: 3 }, { sha: 'old', size: 50, at: 1 }, { sha: 'mid', size: 30, at: 2 }];
  it('drops the oldest files until the total fits', () => {
    expect(pickEvictions(items, 70)).toEqual(['old']);
    expect(pickEvictions(items, 40)).toEqual(['old', 'mid']);
  });
  it('keeps everything under the limit', () => {
    expect(pickEvictions(items, 120)).toEqual([]);
  });
});

describe('rateNotice', () => {
  const reset = new Date(10_000_000);
  it('warns when the limit is used up or low', () => {
    expect(rateNotice({ remaining: 0, limit: 60, reset }, 0)?.level).toBe('out');
    expect(rateNotice({ remaining: 5, limit: 60, reset }, 0)?.level).toBe('low');
  });
  it('stays quiet with enough requests or after the reset time', () => {
    expect(rateNotice({ remaining: 30, limit: 60, reset }, 0)).toBeNull();
    expect(rateNotice({ remaining: 0, limit: 60, reset }, 10_000_001)).toBeNull();
    expect(rateNotice(null)).toBeNull();
  });
});
