import type { KeyboardEvent } from 'react';

// Up/Down/Home/End move focus between the rows of a tree, like a file explorer.
export function treeKeys(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"][tabindex="0"]')];
  if (!rows.length) return;
  e.preventDefault();
  const i = rows.indexOf(document.activeElement as HTMLElement);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1
    : Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
  rows[next].focus();
  rows[next].scrollIntoView({ block: 'nearest' });
}
