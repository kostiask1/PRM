import React from 'react';

const icons = {
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  export: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  import: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /></>,
  restore: <><path d="M3 2v6h6" /><path d="M3.06 13a9 9 0 1 0 .49-4.08" /></>,
  back: <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  chevron: <polyline points="6 9 12 15 18 9" />,
  dice: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M7.5 7.5h.01" strokeWidth="4" /><path d="M16.5 16.5h.01" strokeWidth="4" /><path d="M7.5 16.5h.01" strokeWidth="4" /><path d="M16.5 7.5h.01" strokeWidth="4" /><path d="M12 12h.01" strokeWidth="4" /></>,
  swords: <><path d="M14.5 17.5L3 6l3-3 11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M9.5 17.5L21 6l-3-3L6.5 14.5" /><path d="M11 19L5 13" /><path d="M8 16l-4 4" /></>,
  "sort-none": <path d="M7 15l5 5 5-5M7 9l5-5 5 5" strokeOpacity="0.5" />,
  "sort-asc": <><path d="M7 9l5-5 5 5" /><path d="M12 4v16" strokeDasharray="2 2" strokeOpacity="0.3" /></>,
  "sort-desc": <><path d="M7 15l5 5 5-5" /><path d="M12 4v16" strokeDasharray="2 2" strokeOpacity="0.3" /></>,
  bestiary: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
};

export default function Icon({ name, size = 18, strokeWidth = 2, className = "" }) {
  const content = icons[name];
  if (!content) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`Icon Icon--${name} ${className}`}
    >
      {content}
    </svg>
  );
}