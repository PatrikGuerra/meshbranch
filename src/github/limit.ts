import { MIN_REMAINING } from '../branches/newer';
import type { RateLimit } from './client';

export type RateNotice = { level: 'out' | 'low'; text: string } | null;
const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Banner text for the GitHub API limit: used up, or low enough that branch checks pause.
export function rateNotice(rate: RateLimit | null, now = Date.now()): RateNotice {
  if (!rate || rate.reset.getTime() <= now) return null; // the window has reset since the last answer
  if (rate.remaining <= 0) return { level: 'out', text: `GitHub's limit of ${rate.limit} requests per hour is used up until ${time(rate.reset)}. Files you already opened still open from this browser's cache.` };
  if (rate.remaining < MIN_REMAINING) return { level: 'low', text: `Only ${rate.remaining} GitHub requests left until ${time(rate.reset)}. Branch checks are paused; use “Check” in the branch menu for one branch.` };
  return null;
}
