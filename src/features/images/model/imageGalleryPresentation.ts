import type { GalleryImage } from "./contracts.ts";

export interface GalleryPath {
	source: string;
	category: string;
	subcategory: string;
}

export interface GalleryPathEntry extends GalleryPath {
	pathKey: string;
}

export interface GalleryNavigationState {
	entries: GalleryPathEntry[];
	index: number;
}

export interface GalleryPendingSelection {
	name: string;
	pathKey: string;
}

export interface GalleryDisplayImage extends GalleryImage {
	galleryKey: string;
}

export type GalleryPresentationItem =
	| { type: "sub"; sub: string; key: string }
	| { type: "image"; image: GalleryDisplayImage; key: string };

export type GalleryHistoryDirection = -1 | 1;

const GALLERY_HISTORY_SHORTCUTS: Readonly<
	Record<string, GalleryHistoryDirection>
> = Object.freeze({
	"0000:Backspace": -1,
	"1000:ArrowLeft": -1,
	"1000:ArrowRight": 1,
});

export function getGalleryPathKey(
	source: string | null | undefined,
	category: string | null | undefined,
	subcategory = "",
): string {
	return `${source || ""}\u0000${category || ""}\u0000${subcategory || ""}`;
}

export function getGalleryPathEntry(
	source: string | null | undefined,
	category: string | null | undefined,
	subcategory = "",
): GalleryPathEntry {
	const path = {
		source: source || "general",
		category: category || "",
		subcategory: subcategory || "",
	};
	return { ...path, pathKey: getGalleryPathKey(path.source, path.category, path.subcategory) };
}

export function galleryPathEntriesEqual(
	left: GalleryPathEntry | null | undefined,
	right: GalleryPathEntry | null | undefined,
): boolean {
	return Boolean(left && right && left.pathKey === right.pathKey);
}

function getGalleryImagePath(
	image: GalleryImage,
	fallbackPath: GalleryPath,
): GalleryPath {
	return {
		source: image.source || fallbackPath.source || "general",
		category: image.category || fallbackPath.category || "",
		subcategory: image.subcategory ?? fallbackPath.subcategory ?? "",
	};
}

export function getGalleryImageKey(
	image: GalleryImage,
	fallbackPath: GalleryPath,
): string {
	const path = getGalleryImagePath(image, fallbackPath);
	return [
		path.source,
		path.category,
		path.subcategory,
		image.path || "",
		image.url || "",
		image.name.toLowerCase(),
	].join("\u0000");
}

export function deduplicateGalleryImages(
	images: GalleryImage[],
	fallbackPath: GalleryPath,
): GalleryDisplayImage[] {
	const seen = new Set<string>();
	return images.reduce<GalleryDisplayImage[]>((items, image) => {
		const galleryKey = getGalleryImageKey(image, fallbackPath);
		if (seen.has(galleryKey)) return items;
		seen.add(galleryKey);
		items.push({ ...image, galleryKey });
		return items;
	}, []);
}

export function buildGalleryPresentationItems(
	subfolders: string[],
	images: GalleryDisplayImage[],
): GalleryPresentationItem[] {
	return [
		...subfolders.map((sub) => ({ type: "sub" as const, sub, key: `sub:${sub}` })),
		...images.map((image) => ({
			type: "image" as const,
			image,
			key: `image:${image.galleryKey}`,
		})),
	];
}

export function recordGalleryNavigation(
	state: GalleryNavigationState,
	entry: GalleryPathEntry,
): GalleryNavigationState {
	if (!entry.category || galleryPathEntriesEqual(state.entries[state.index], entry)) {
		return state;
	}
	const entries = state.entries.slice(0, state.index + 1).concat(entry);
	return { entries, index: entries.length - 1 };
}

export function getGalleryNavigationEntry(
	state: GalleryNavigationState,
	direction: GalleryHistoryDirection,
): { entry: GalleryPathEntry; index: number } | null {
	const index = state.index + direction;
	const entry = state.entries[index];
	return entry ? { entry, index } : null;
}

export function getGalleryHistoryKeyDirection({
	altKey,
	ctrlKey,
	key,
	metaKey,
	shiftKey,
}: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">):
	| GalleryHistoryDirection
	| null {
	const shortcutKey = `${Number(altKey)}${Number(ctrlKey)}${Number(metaKey)}${Number(shiftKey)}:${key}`;
	return GALLERY_HISTORY_SHORTCUTS[shortcutKey] ?? null;
}

export function findPendingGalleryImage({
	pendingSelection,
	currentPathKey,
	images,
}: {
	pendingSelection: GalleryPendingSelection | null;
	currentPathKey: string;
	images: GalleryImage[];
}): GalleryImage | null {
	if (!pendingSelection || pendingSelection.pathKey !== currentPathKey) return null;
	return (
		images.find(
			(image) => image.name === pendingSelection.name && !image.globalSearch,
		) ?? null
	);
}
