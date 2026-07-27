import React from "react";

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(value, searchQuery = "") {
	if (value === undefined || value === null) return value;

	const text = String(value);
	const query = String(searchQuery || "").trim();
	if (!query) return text;

	const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
	const parts = text.split(regex);
	if (parts.length === 1) return text;

	const normalizedQuery = query.toLowerCase();
	return parts.map((part, index) => {
		if (part.toLowerCase() !== normalizedQuery) {
			return <React.Fragment key={index}>{part}</React.Fragment>;
		}

		return (
			<mark key={index} className="SearchHighlight">
				{part}
			</mark>
		);
	});
}
