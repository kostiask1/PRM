function decodePathParts(parts = []) {
	return parts.map((part) => decodeURIComponent(part || ""));
}

export function resolveImageGalleryLocation(imageUrl, fallback = {}) {
	const fallbackLocation = {
		source: fallback.source || "general",
		category: fallback.category || "attachments",
		subcategory: fallback.subcategory || "",
	};

	if (!imageUrl) return fallbackLocation;

	try {
		const baseOrigin =
			typeof window !== "undefined" ? window.location.origin : "http://localhost";
		const parsed = new URL(imageUrl, baseOrigin);
		const marker = "/api/images/";
		const markerIndex = parsed.pathname.indexOf(marker);
		if (markerIndex === -1) return fallbackLocation;

		const relative = parsed.pathname
			.slice(markerIndex + marker.length)
			.split("/")
			.filter(Boolean);
		if (relative.length < 3) return fallbackLocation;

		const [sourceEncoded, categoryEncoded, ...rest] = decodePathParts(relative);
		if (!sourceEncoded || !categoryEncoded || rest.length === 0) {
			return fallbackLocation;
		}

		const subParts = rest
			.slice(0, -1)
			.flatMap((part) => String(part).split("/"))
			.filter(Boolean);

		return {
			source: sourceEncoded,
			category: categoryEncoded,
			subcategory: subParts.join("/"),
		};
	} catch {
		return fallbackLocation;
	}
}
