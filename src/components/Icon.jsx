const icons = {
	plus: <path d="M12 5v14M5 12h14" />,
	trash: (
		<>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
			<line x1="10" y1="11" x2="10" y2="17" />
			<line x1="14" y1="11" x2="14" y2="17" />
		</>
	),
	edit: (
		<>
			<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
			<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
		</>
	),
	export: (
		<>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</>
	),
	import: (
		<>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</>
	),
	restore: (
		<>
			<path d="M3 2v6h6" />
			<path d="M3.06 13a9 9 0 1 0 .49-4.08" />
		</>
	),
	back: (
		<>
			<line x1="19" y1="12" x2="5" y2="12" />
			<polyline points="12 19 5 12 12 5" />
		</>
	),
	check: <polyline points="20 6 9 17 4 12" />,
	x: (
		<>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</>
	),
	chevron: <polyline points="6 9 12 15 18 9" />,
	dice: (
		<>
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
			<path d="M7.5 7.5h.01" strokeWidth="4" />
			<path d="M16.5 16.5h.01" strokeWidth="4" />
			<path d="M7.5 16.5h.01" strokeWidth="4" />
			<path d="M16.5 7.5h.01" strokeWidth="4" />
			<path d="M12 12h.01" strokeWidth="4" />
		</>
	),
	swords: (
		<>
			<path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
			<path d="m13 19 6-6" />
			<path d="m16 16 4 4" />
			<path d="m19 21 2-2" />
			<path d="M14.5 6.5 21 3v3l-11.5 11.5" />
			<path d="m5 13 6 6" />
			<path d="m8 16-4 4" />
			<path d="m3 21 2-2" />
		</>
	),
	undo: (
		<>
			<path d="M3 7v6h6" />
			<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
		</>
	),
	redo: (
		<>
			<path d="M21 7v6h-6" />
			<path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
		</>
	),
	"sort-none": <path d="M7 15l5 5 5-5M7 9l5-5 5 5" strokeOpacity="0.5" />,
	"sort-asc": (
		<>
			<path d="M7 9l5-5 5 5" />
			<path d="M12 4v16" strokeDasharray="2 2" strokeOpacity="0.3" />
		</>
	),
	"sort-desc": (
		<>
			<path d="M7 15l5 5 5-5" />
			<path d="M12 4v16" strokeDasharray="2 2" strokeOpacity="0.3" />
		</>
	),
	database: (
		<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
	),
	book: (
		<>
			<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
			<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
		</>
	),
	user: (
		<>
			<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
			<circle cx="12" cy="7" r="4" />
		</>
	),
	layers: (
		<>
			<polygon points="12 2 2 7 12 12 22 7 12 2" />
			<polyline points="2 17 12 22 22 17" />
			<polyline points="2 12 12 17 22 12" />
		</>
	),
	monitor: (
		<>
			<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
			<line x1="8" y1="21" x2="16" y2="21" />
			<line x1="12" y1="17" x2="12" y2="21" />
		</>
	),
	map: (
		<>
			<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
			<line x1="8" y1="2" x2="8" y2="18" />
			<line x1="16" y1="6" x2="16" y2="22" />
		</>
	),
	wand: (
		<>
			<path d="M15 4V2" />
			<path d="M15 16v-2" />
			<path d="M8 9h2" />
			<path d="M20 9h2" />
			<path d="M17.8 11.8L19 13" />
			<path d="M15 9l2.8-2.8" />
			<path d="M7.18 14.82L3 19v2h2l4.18-4.18z" />
			<path d="m9.01 10.58 5.41 5.41" />
		</>
	),
	zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
	users: (
		<>
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</>
	),
	image: (
		<>
			<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
			<circle cx="8.5" cy="8.5" r="1.5" />
			<polyline points="21 15 16 10 5 21" />
		</>
	),
	copy: (
		<>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</>
	),
	list: (
		<>
			<line x1="8" y1="6" x2="21" y2="6" />
			<line x1="8" y1="12" x2="21" y2="12" />
			<line x1="8" y1="18" x2="21" y2="18" />
			<line x1="3" y1="6" x2="3.01" y2="6" />
			<line x1="3" y1="12" x2="3.01" y2="12" />
			<line x1="3" y1="18" x2="3.01" y2="18" />
		</>
	),
	history: (
		<>
			<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
			<path d="M3 3v5h5" />
			<polyline points="12 7 12 12 16 14" />
		</>
	),
	magic: (
		<>
			<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
			<path d="m5 3 2 2" />
			<path d="m19 21-2-2" />
		</>
	),
	moon: (
		<>
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
		</>
	),
	sun: (
		<>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2" />
			<path d="M12 20v2" />
			<path d="M4.93 4.93l1.41 1.41" />
			<path d="M17.66 17.66l1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="M4.93 19.07l1.41-1.41" />
			<path d="M17.66 6.34l1.41-1.41" />
		</>
	),
	skull: (
		<>
			<path d="M12 2C8.13 2 5 5.13 5 9v3c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c0-3.87-3.13-7-7-7Z" />
			<path d="M8 14v4c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2v-4" />
			<path d="M9 10h.01" strokeWidth="4" />
			<path d="M15 10h.01" strokeWidth="4" />
			<path d="m10 14 2-2 2 2" />
			<path d="M10 17v3" />
			<path d="M12 17v3" />
			<path d="M14 17v3" />
		</>
	),
};

export default function Icon({
	name,
	size = 18,
	strokeWidth = 2,
	className = "",
}) {
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
			className={`Icon Icon--${name} ${className}`}>
			{content}
		</svg>
	);
}
