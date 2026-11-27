const paths = {
  logo: <><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 22V12M21 7l-9 5-9-5" /></>,
  repo: <><path d="M4 5a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2z" /><path d="M4 20a2 2 0 0 0 2 1h12v-3" /></>,
  branch: <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="7" r="2" /><path d="M6 7v10M18 9c0 5-7 4-11 8" /></>,
  moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  link: <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
  chev: <path d="M9 6l6 6-6 6" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  warn: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  parts: <><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M3 7l9 5 9-5M12 12v10" /></>,
  lock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />,
  part: <rect x="4" y="4" width="16" height="16" rx="2" />,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  // Viewer toolbar (mock/toolbar.html)
  persp: <><path d="M3 7l18-3v16L3 17z" /><path d="M3 12h18M9 6v12M15 5v14" opacity=".45" /></>,
  ortho: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 12h18M9 5v14M15 5v14" opacity=".45" /></>,
  fit: <><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  viewIso: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  viewTop: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" opacity=".35" /><path d="M4 7.5L12 3l8 4.5L12 12z" fill="currentColor" fillOpacity=".25" /></>,
  viewFront: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" opacity=".35" /><path d="M4 7.5l8 4.5v9l-8-4.5z" fill="currentColor" fillOpacity=".25" /></>,
  viewRight: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" opacity=".35" /><path d="M20 7.5L12 12v9l8-4.5z" fill="currentColor" fillOpacity=".25" /></>,
  solid: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" fill="currentColor" fillOpacity=".35" stroke="none" />,
  edges: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" fill="currentColor" fillOpacity=".25" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  wire: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9M4 16.5l8-4.5 8 4.5M12 3v9" strokeDasharray="2 2" /></>,
  grid: <><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /><rect x="3" y="3" width="18" height="18" rx="2" /></>,
  ruler: <><path d="M3 17L17 3l4 4L7 21z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /></>,
};
export type IconName = keyof typeof paths;

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>{paths[name]}</svg>;
}
