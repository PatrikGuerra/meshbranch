import type { RateLimit } from './client';

export type RateNotice = { level: 'out' | 'low'; text: string } | null;
const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const MIN_REMAINING = 10;

// Banner text for the GitHub API limit: used up, or nearly used up.
export function rateNotice(rate: RateLimit | null, now = Date.now()): RateNotice {
  if (!rate || rate.reset.getTime() <= now) return null; // the window has reset since the last answer
  if (rate.remaining <= 0) return { level: 'out', text: `GitHub's limit of ${rate.limit} requests per hour is used up until ${time(rate.reset)}. Files you already opened still open from this browser's cache.` };
  if (rate.remaining < MIN_REMAINING) return { level: 'low', text: `Only ${rate.remaining} GitHub requests left until ${time(rate.reset)}.` };
  return null;
}
