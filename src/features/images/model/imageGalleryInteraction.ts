import type { ImageLocation, ImageMovePayload } from "../api/imageApi.ts";
import type {
	GalleryImage,
	GalleryItemType,
	GalleryMoveGroup,
} from "./contracts.ts";

export type GalleryDropPlan =
	| { kind: "ignore" }
	| { kind: "upload" }
	| { kind: "move"; payload: ImageMovePayload };

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseImageLocation(value: unknown): ImageLocation | null {
	if (!isRecord(value)) return null;
	if (typeof value.slug !== "string" || typeof value.category !== "string") {
		return null;
	}
	return {
		slug: value.slug,
		category: value.category,
		subcategory:
			typeof value.subcategory === "string" ? value.subcategory : "",
	};
}

function parseGalleryMoveTransfer(jsonData: string): {
	items: string[];
	src: ImageLocation;
} | null {
	try {
		const parsed: unknown = JSON.parse(jsonData);
		if (!isRecord(parsed) || !Array.isArray(parsed.items)) return null;
		const src = parseImageLocation(parsed.src);
		const items = parsed.items.filter(
			(item): item is string => typeof item === "string" && item.length > 0,
		);
		return src && items.length > 0 ? { items, src } : null;
	} catch {
		return null;
	}
}

export function imageLocationsEqual(
	left: ImageLocation,
	right: ImageLocation,
): boolean {
	return (
		left.slug === right.slug &&
		left.category === right.category &&
		(left.subcategory || "") === (right.subcategory || "")
	);
}

export function getGalleryDropPlan({
	dest,
	hasFiles,
	jsonData,
}: {
	dest: ImageLocation & { readonly?: boolean };
	hasFiles: boolean;
	jsonData: string;
}): GalleryDropPlan {
	if (dest.readonly) return { kind: "ignore" };
	if (!jsonData) return hasFiles ? { kind: "upload" } : { kind: "ignore" };
	const transfer = parseGalleryMoveTransfer(jsonData);
	if (!transfer || imageLocationsEqual(transfer.src, dest)) {
		return { kind: "ignore" };
	}
	return { kind: "move", payload: { ...transfer, dest } };
}

export function buildGalleryMovePayloads({
	dest,
	imageGroups,
	safeSubs,
	src,
}: {
	dest: ImageLocation;
	imageGroups: GalleryMoveGroup[];
	safeSubs: string[];
	src: ImageLocation;
}): ImageMovePayload[] {
	if (
		safeSubs.length > 0 &&
		imageGroups.length === 0 &&
		imageLocationsEqual(src, dest)
	) {
		return [];
	}
	const payloads = imageGroups
		.filter((group) => !imageLocationsEqual(group.src, dest))
		.map((group) => ({ items: group.items, src: group.src, dest }));
	if (safeSubs.length > 0) payloads.push({ items: safeSubs, src, dest });
	return payloads;
}

export interface GallerySelectionState {
	filenames: Set<string>;
	subfolders: Set<string>;
	lastIndex: number | null;
}

interface GallerySelectionOptions extends GallerySelectionState {
	allSubs: string[];
	images: GalleryImage[];
	index: number;
	isAdditive: boolean;
	isReadonlyImage: (image?: GalleryImage) => boolean;
	isReadonlySub: (name: string) => boolean;
	isShift: boolean;
	name: string;
	type: GalleryItemType;
}

function isGallerySelectionItemReadonly(
	name: string,
	type: GalleryItemType,
	options: Pick<
		GallerySelectionOptions,
		"images" | "isReadonlyImage" | "isReadonlySub"
	>,
): boolean {
	return type === "sub"
		? options.isReadonlySub(name)
		: options.isReadonlyImage(
				options.images.find((image) => image.name === name),
			);
}

function buildGalleryRangeSelection(
	options: GallerySelectionOptions,
): GallerySelectionState {
	const start = Math.min(options.index, options.lastIndex ?? options.index);
	const end = Math.max(options.index, options.lastIndex ?? options.index);
	const filenames = new Set(options.isAdditive ? options.filenames : []);
	const subfolders = new Set(options.isAdditive ? options.subfolders : []);
	const items: Array<{ name: string; type: GalleryItemType }> = [
		...options.allSubs.map((name) => ({ name, type: "sub" as const })),
		...options.images.map((image) => ({
			name: image.name,
			type: "image" as const,
		})),
	];
	for (const item of items.slice(start, end + 1)) {
		if (isGallerySelectionItemReadonly(item.name, item.type, options)) continue;
		if (item.type === "sub") subfolders.add(item.name);
		else filenames.add(item.name);
	}
	return { filenames, subfolders, lastIndex: options.lastIndex };
}

function buildGalleryModifiedSelection(
	options: GallerySelectionOptions,
): GallerySelectionState {
	const filenames = new Set(options.filenames);
	const subfolders = new Set(options.subfolders);
	if (!isGallerySelectionItemReadonly(options.name, options.type, options)) {
		const target = options.type === "image" ? filenames : subfolders;
		if (target.has(options.name)) target.delete(options.name);
		else target.add(options.name);
	}
	return { filenames, subfolders, lastIndex: options.index };
}

function buildGallerySingleSelection(
	options: GallerySelectionOptions,
): GallerySelectionState | null {
	if (isGallerySelectionItemReadonly(options.name, options.type, options)) {
		return null;
	}
	const isSelected =
		options.type === "image"
			? options.filenames.has(options.name)
			: options.subfolders.has(options.name);
	if (isSelected && options.filenames.size + options.subfolders.size === 1) {
		return { filenames: new Set(), subfolders: new Set(), lastIndex: null };
	}
	return {
		filenames:
			options.type === "image" ? new Set([options.name]) : new Set(),
		subfolders:
			options.type === "sub" ? new Set([options.name]) : new Set(),
		lastIndex: options.index,
	};
}

export function getGallerySelectionPlan(
	options: GallerySelectionOptions,
): GallerySelectionState | null {
	if (options.isShift && options.lastIndex !== null) {
		return buildGalleryRangeSelection(options);
	}
	if (options.isAdditive) return buildGalleryModifiedSelection(options);
	return buildGallerySingleSelection(options);
}

export interface GalleryDragPlan {
	items: string[];
	src: ImageLocation;
}

function getGalleryDragImage(item: GalleryImage | string): GalleryImage | undefined {
	return typeof item === "string" ? undefined : item;
}

function getGalleryDragName(
	item: GalleryImage | string,
	type: GalleryItemType,
): string {
	if (type === "sub") return String(item);
	return getGalleryDragImage(item)?.name ?? "";
}

function isGalleryDragItemReadonly({
	image,
	isReadonlyImage,
	isReadonlySub,
	name,
	type,
}: {
	image?: GalleryImage;
	isReadonlyImage: (image?: GalleryImage) => boolean;
	isReadonlySub: (name: string) => boolean;
	name: string;
	type: GalleryItemType;
}): boolean {
	return type === "sub" ? isReadonlySub(name) : isReadonlyImage(image);
}

export function getGalleryDragPlan({
	item,
	location,
	getMovableSelection,
	selectedFilenames,
	selectedSubs,
	type,
	isReadonlyImage,
	isReadonlySub,
}: {
	item: GalleryImage | string;
	location: ImageLocation;
	getMovableSelection: () => string[];
	selectedFilenames: Set<string>;
	selectedSubs: Set<string>;
	type: GalleryItemType;
	isReadonlyImage: (image?: GalleryImage) => boolean;
	isReadonlySub: (name: string) => boolean;
}): GalleryDragPlan | null {
	const image = getGalleryDragImage(item);
	const name = getGalleryDragName(item, type);
	if (!name) return null;
	if (
		isGalleryDragItemReadonly({
			image,
			isReadonlyImage,
			isReadonlySub,
			name,
			type,
		})
	) {
		return null;
	}
	const selectionByType = { image: selectedFilenames, sub: selectedSubs };
	const selected = selectionByType[type].has(name);
	const items = selected ? getMovableSelection() : [name];
	return items.length > 0 ? { items, src: location } : null;
}
