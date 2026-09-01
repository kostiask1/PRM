const DROPDOWN_OFFSET = 4;
const DROPDOWN_VIEWPORT_GAP = 8;
const DROPDOWN_OPEN_UP_THRESHOLD = 180;
const DROPDOWN_MIN_HEIGHT = 120;

export interface DropdownAnchorRect {
	left: number;
	top: number;
	bottom: number;
	width: number;
}

export interface DropdownViewport {
	width: number;
	height: number;
}

export type DropdownPortalStyle = {
	position: "fixed";
	left: number;
	width: number;
	maxHeight: number;
} & ({ top: number } | { bottom: number });

export interface DropdownPortalPositionOptions {
	rect: DropdownAnchorRect;
	viewport: DropdownViewport;
	minWidth: number;
	maxHeight: number;
}

export function calculateDropdownPortalStyle({
	rect,
	viewport,
	minWidth,
	maxHeight: requestedMaxHeight,
}: DropdownPortalPositionOptions): DropdownPortalStyle {
	const width = Math.min(
		Math.max(rect.width, minWidth),
		viewport.width - DROPDOWN_VIEWPORT_GAP * 2,
	);
	const left = Math.min(
		Math.max(DROPDOWN_VIEWPORT_GAP, rect.left),
		viewport.width - width - DROPDOWN_VIEWPORT_GAP,
	);

	const spaceBelow =
		viewport.height - rect.bottom - DROPDOWN_VIEWPORT_GAP;
	const spaceAbove = rect.top - DROPDOWN_VIEWPORT_GAP;
	const openUp =
		spaceBelow < DROPDOWN_OPEN_UP_THRESHOLD && spaceAbove > spaceBelow;
	const maxHeight = Math.max(
		DROPDOWN_MIN_HEIGHT,
		Math.min(requestedMaxHeight, openUp ? spaceAbove : spaceBelow),
	);
	const sharedStyle = {
		position: "fixed" as const,
		left,
		width,
		maxHeight,
	};

	if (openUp) {
		return {
			...sharedStyle,
			bottom: viewport.height - rect.top + DROPDOWN_OFFSET,
		};
	}

	return {
		...sharedStyle,
		top: rect.bottom + DROPDOWN_OFFSET,
	};
}
