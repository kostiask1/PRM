export interface ImageAssetGalleryLocation {
	source: string;
	category: string;
	subcategory: string;
}

export type ImageAssetTarget =
	| "character"
	| "npc"
	| "location"
	| "scene"
	| "attachment";

const TARGET_PRESETS: Readonly<
	Record<
		ImageAssetTarget,
		Pick<ImageAssetGalleryLocation, "category" | "subcategory">
	>
> = Object.freeze({
	character: { category: "characters", subcategory: "players" },
	npc: { category: "characters", subcategory: "npc" },
	location: { category: "scenes", subcategory: "" },
	scene: { category: "scenes", subcategory: "" },
	attachment: { category: "attachments", subcategory: "" },
});

function decodeImagePathSegment(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function resolveImagePathname(imageUrl: string, baseOrigin?: string): string {
	try {
		return baseOrigin ? new URL(imageUrl, baseOrigin).pathname : imageUrl;
	} catch {
		return imageUrl;
	}
}

export function parseGalleryLocationFromImageUrl(
	imageUrl: string | null | undefined,
	baseOrigin?: string,
): ImageAssetGalleryLocation | null {
	if (!imageUrl) return null;
	const parts = resolveImagePathname(imageUrl, baseOrigin)
		.split("/")
		.filter(Boolean);
	if (parts.length < 5 || parts[0] !== "api" || parts[1] !== "images") {
		return null;
	}
	const source = decodeImagePathSegment(parts[2]);
	const category = decodeImagePathSegment(parts[3]);
	const tail = parts.slice(4);
	if (!source || !category || tail.length === 0) return null;
	return {
		source,
		category,
		subcategory: tail
			.slice(0, -1)
			.map(decodeImagePathSegment)
			.filter(Boolean)
			.join("/"),
	};
}

export function getImageAssetPreset(
	target: ImageAssetTarget = "character",
	campaignSlug?: string | null,
): ImageAssetGalleryLocation {
	const preset = TARGET_PRESETS[target] ?? TARGET_PRESETS.character;
	return {
		source: campaignSlug || "general",
		category: preset.category,
		subcategory: preset.subcategory,
	};
}

export function resolveImageAssetLocation({
	baseOrigin,
	campaignSlug,
	imageUrl,
	target,
}: {
	baseOrigin?: string;
	campaignSlug?: string | null;
	imageUrl?: string | null;
	target?: ImageAssetTarget;
}): ImageAssetGalleryLocation {
	return (
		parseGalleryLocationFromImageUrl(imageUrl, baseOrigin) ??
		getImageAssetPreset(target, campaignSlug)
	);
}
