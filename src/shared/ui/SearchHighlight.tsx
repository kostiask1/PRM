import { Fragment } from "react";
import type { ReactNode } from "react";
import {
	splitSearchHighlight,
	type SearchHighlightPart,
} from "./searchHighlightModel.ts";

function renderHighlightPart(
	part: SearchHighlightPart,
	index: number,
): ReactNode {
	if (!part.highlighted) {
		return <Fragment key={index}>{part.text}</Fragment>;
	}

	return (
		<mark key={index} className="SearchHighlight">
			{part.text}
		</mark>
	);
}

export function highlightText(
	value: unknown,
	searchQuery: unknown = "",
): ReactNode {
	const parts = splitSearchHighlight(value, searchQuery);
	return Array.isArray(parts) ? parts.map(renderHighlightPart) : parts;
}
