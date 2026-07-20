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

export type ImageAssetFieldContentState = "valid" | "missing" | "empty";

export interface ImageAssetFieldPresentation {
	contentState: ImageAssetFieldContentState;
	resolvedImageUrl: string;
	showPreview: boolean;
}

export interface ImageAssetFieldEventPlan {
	preventDefault: boolean;
	stopPropagation: boolean;
	action: "open-gallery" | "none";
}

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

function getImagePathParts(imageUrl: string, baseOrigin?: string): string[] {
	return resolveImagePathname(imageUrl, baseOrigin).split("/").filter(Boolean);
}

function hasImageGalleryApiPrefix(parts: readonly string[]): boolean {
	return parts.length >= 5 && parts[0] === "api" && parts[1] === "images";
}

function getImageGallerySubcategory(parts: readonly string[]): string {
	return parts
		.slice(4, -1)
		.map(decodeImagePathSegment)
		.filter(Boolean)
		.join("/");
}

function projectImageGalleryLocation(
	parts: readonly string[],
): ImageAssetGalleryLocation | null {
	const source = decodeImagePathSegment(parts[2]);
	if (!source) return null;
	const category = decodeImagePathSegment(parts[3]);
	if (!category) return null;
	return {
		source,
		category,
		subcategory: getImageGallerySubcategory(parts),
	};
}

export function parseGalleryLocationFromImageUrl(
	imageUrl: string | null | undefined,
	baseOrigin?: string,
): ImageAssetGalleryLocation | null {
	if (!imageUrl) return null;
	const parts = getImagePathParts(imageUrl, baseOrigin);
	return hasImageGalleryApiPrefix(parts)
		? projectImageGalleryLocation(parts)
		: null;
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

function getImageAssetFieldContentState(
	imageUrl: string | null | undefined,
	hasImageError: boolean,
): ImageAssetFieldContentState {
	if (!imageUrl) return "empty";
	return hasImageError ? "missing" : "valid";
}

export function getImageAssetFieldPresentation({
	imageUrl,
	hasImageError,
	isImagePreviewOpen,
}: {
	imageUrl?: string | null;
	hasImageError: boolean;
	isImagePreviewOpen: boolean;
}): ImageAssetFieldPresentation {
	const contentState = getImageAssetFieldContentState(imageUrl, hasImageError);
	return {
		contentState,
		resolvedImageUrl: imageUrl || "",
		showPreview: isImagePreviewOpen && contentState === "valid",
	};
}

export function getImageAssetFieldContextMenuPlan(
	enableContextReplace: boolean,
): ImageAssetFieldEventPlan {
	return enableContextReplace
		? {
				preventDefault: true,
				stopPropagation: true,
				action: "open-gallery",
			}
		: {
				preventDefault: false,
				stopPropagation: false,
				action: "none",
			};
}

export function getImageAssetFieldSelectionUrl(
	asset: { url?: string | null } | null | undefined,
): string | null {
	return asset?.url || null;
}
