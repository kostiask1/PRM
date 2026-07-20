import type {
	ImageDeletePayload,
	ImageLocation,
	ImageMovePayload,
} from "../api/imageApi.ts";
import type {
	GalleryDragOverTarget,
	GalleryDropTarget,
	GalleryImage,
	GalleryItemType,
	GalleryMoveGroup,
} from "./contracts.ts";

export interface GalleryFolderDragOverPlan {
	preventDefault: boolean;
	target: GalleryDragOverTarget | null;
}

export type GalleryKeyboardPlan =
	| { action: "none"; preventDefault: boolean }
	| { action: "delete-selection"; preventDefault: false }
	| {
			action: "navigate-parent";
			preventDefault: true;
			subcategory: string;
	  };

export interface GallerySubcategoryRenamePlan {
	newPath: string;
	oldPath: string;
	selectedSubcategory: string | null;
}

export interface GalleryBulkDeleteSummary {
	hasFolders: boolean;
	total: number;
}

export interface GalleryBulkDeleteConfirmation {
	confirmed: true;
	extractFolderContents: boolean;
}

export interface GalleryBulkDeleteConfirmationPlan {
	count: number;
	showExtractFolderContents: boolean;
}

const GALLERY_KEYBOARD_NONE_PLAN: GalleryKeyboardPlan = Object.freeze({
	action: "none",
	preventDefault: false,
});

function isGalleryKeyboardBlocked(
	isOpen: boolean,
	targetTagName: string | null | undefined,
): boolean {
	return !isOpen || targetTagName === "INPUT" || targetTagName === "TEXTAREA";
}

function getGalleryParentSubcategory(selectedSub: string): string {
	const parts = selectedSub.split("/").filter(Boolean);
	parts.pop();
	return parts.join("/");
}

function getGalleryNestedSubcategoryPath(
	selectedSub: string,
	name: string,
): string {
	return selectedSub ? `${selectedSub}/${name}` : name;
}

export function getGallerySubcategoryRenamePlan({
	newName,
	oldName,
	selectedSub,
}: {
	newName: string;
	oldName: string;
	selectedSub: string;
}): GallerySubcategoryRenamePlan | null {
	if (!newName.trim() || oldName === newName) return null;
	return {
		newPath: getGalleryNestedSubcategoryPath(selectedSub, newName),
		oldPath: getGalleryNestedSubcategoryPath(selectedSub, oldName),
		selectedSubcategory: selectedSub === oldName ? newName : null,
	};
}

function getOpenGalleryKeyboardPlan(
	key: string,
	selectedSub: string,
): GalleryKeyboardPlan {
	switch (key) {
		case "Delete":
			return { action: "delete-selection", preventDefault: false };
		case "Backspace":
			return selectedSub
				? {
						action: "navigate-parent",
						preventDefault: true,
						subcategory: getGalleryParentSubcategory(selectedSub),
					}
				: { action: "none", preventDefault: true };
		default:
			return GALLERY_KEYBOARD_NONE_PLAN;
	}
}

export function getGalleryKeyboardPlan({
	isOpen,
	key,
	selectedSub,
	targetTagName,
}: {
	isOpen: boolean;
	key: string;
	selectedSub: string;
	targetTagName?: string | null;
}): GalleryKeyboardPlan {
	return isGalleryKeyboardBlocked(isOpen, targetTagName)
		? GALLERY_KEYBOARD_NONE_PLAN
		: getOpenGalleryKeyboardPlan(key, selectedSub);
}

export function getGalleryFolderDragOverPlan({
	currentTargetId,
	isReadonly,
	sub,
}: {
	currentTargetId?: string;
	isReadonly: boolean;
	sub: string;
}): GalleryFolderDragOverPlan {
	if (isReadonly) return { preventDefault: false, target: null };
	return {
		preventDefault: true,
		target: currentTargetId === sub ? null : { type: "sub", id: sub },
	};
}

export function getGalleryFolderDropTarget({
	category,
	isReadonly,
	slug,
	subcategory,
}: {
	category: string;
	isReadonly: boolean;
	slug: string;
	subcategory: string;
}): GalleryDropTarget {
	return { slug, category, subcategory, readonly: isReadonly };
}

export function getGalleryFolderRenameName(value: unknown): string | null {
	return typeof value === "string" && value ? value : null;
}

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

export function getGalleryBulkDeleteSummary({
	safeFilenames,
	safeSubs,
}: {
	safeFilenames: string[];
	safeSubs: string[];
}): GalleryBulkDeleteSummary | null {
	const total = safeFilenames.length + safeSubs.length;
	return total > 0 ? { hasFolders: safeSubs.length > 0, total } : null;
}

export function getGalleryBulkDeleteConfirmationPlan({
	hasNonEmptySelectedFolders,
	total,
}: {
	hasNonEmptySelectedFolders: boolean;
	total: number;
}): GalleryBulkDeleteConfirmationPlan {
	return {
		count: total,
		showExtractFolderContents: hasNonEmptySelectedFolders,
	};
}

export function createGalleryBulkDeleteConfirmation(
	extractFolderContents: unknown,
): GalleryBulkDeleteConfirmation {
	return {
		confirmed: true,
		extractFolderContents: Boolean(extractFolderContents),
	};
}

export function normalizeGalleryBulkDeleteConfirmation(
	value: unknown,
): GalleryBulkDeleteConfirmation | null {
	if (!isRecord(value) || !value.confirmed) return null;
	return createGalleryBulkDeleteConfirmation(value.extractFolderContents);
}

function getGalleryFolderDeletePayload({
	extractFolderContents,
	hasNonEmptySelectedFolders,
	safeSubs,
	src,
}: {
	extractFolderContents: boolean;
	hasNonEmptySelectedFolders: boolean;
	safeSubs: string[];
	src: ImageLocation;
}): ImageDeletePayload | null {
	if (safeSubs.length === 0) return null;
	return {
		items: safeSubs,
		src,
		options: {
			extractFolderContents:
				hasNonEmptySelectedFolders && extractFolderContents,
		},
	};
}

export function buildGalleryBulkDeletePayloads({
	extractFolderContents,
	hasNonEmptySelectedFolders,
	imageGroups,
	safeSubs,
	src,
}: {
	extractFolderContents: boolean;
	hasNonEmptySelectedFolders: boolean;
	imageGroups: GalleryMoveGroup[];
	safeSubs: string[];
	src: ImageLocation;
}): ImageDeletePayload[] {
	const payloads = imageGroups.map((group) => ({
		items: group.items,
		src: group.src,
	}));
	const folderPayload = getGalleryFolderDeletePayload({
		extractFolderContents,
		hasNonEmptySelectedFolders,
		safeSubs,
		src,
	});
	if (folderPayload) payloads.push(folderPayload);
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

interface GallerySelectionItem {
	name: string;
	type: GalleryItemType;
}

function getOrderedGallerySelectionItems(
	options: Pick<GallerySelectionOptions, "allSubs" | "images">,
): GallerySelectionItem[] {
	return [
		...options.allSubs.map((name) => ({ name, type: "sub" as const })),
		...options.images.map((image) => ({
			name: image.name,
			type: "image" as const,
		})),
	];
}

function getGallerySelectionRange(
	index: number,
	lastIndex: number | null,
): { start: number; end: number } {
	const anchor = lastIndex ?? index;
	return {
		start: Math.min(index, anchor),
		end: Math.max(index, anchor),
	};
}

function createGalleryRangeSelectionSeed(
	options: Pick<
		GallerySelectionOptions,
		"filenames" | "isAdditive" | "subfolders"
	>,
): Pick<GallerySelectionState, "filenames" | "subfolders"> {
	return {
		filenames: new Set(options.isAdditive ? options.filenames : []),
		subfolders: new Set(options.isAdditive ? options.subfolders : []),
	};
}

function addGalleryRangeSelectionItem(
	item: GallerySelectionItem,
	selection: Pick<GallerySelectionState, "filenames" | "subfolders">,
	options: Pick<
		GallerySelectionOptions,
		"images" | "isReadonlyImage" | "isReadonlySub"
	>,
): void {
	if (isGallerySelectionItemReadonly(item.name, item.type, options)) return;
	const target = item.type === "sub" ? selection.subfolders : selection.filenames;
	target.add(item.name);
}

function buildGalleryRangeSelection(
	options: GallerySelectionOptions,
): GallerySelectionState {
	const range = getGallerySelectionRange(options.index, options.lastIndex);
	const selection = createGalleryRangeSelectionSeed(options);
	const items = getOrderedGallerySelectionItems(options);
	for (const item of items.slice(range.start, range.end + 1)) {
		addGalleryRangeSelectionItem(item, selection, options);
	}
	return { ...selection, lastIndex: options.lastIndex };
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

type GallerySingleSelectionAction = "clear" | "ignore" | "select";

function isGallerySelectionItemSelected(
	options: Pick<
		GallerySelectionOptions,
		"filenames" | "name" | "subfolders" | "type"
	>,
): boolean {
	const selectedItems =
		options.type === "image" ? options.filenames : options.subfolders;
	return selectedItems.has(options.name);
}

function isOnlyGallerySelectionItemSelected(
	options: Pick<
		GallerySelectionOptions,
		"filenames" | "name" | "subfolders" | "type"
	>,
): boolean {
	return (
		isGallerySelectionItemSelected(options) &&
		options.filenames.size + options.subfolders.size === 1
	);
}

function getGallerySingleSelectionAction(
	options: GallerySelectionOptions,
): GallerySingleSelectionAction {
	if (isGallerySelectionItemReadonly(options.name, options.type, options)) {
		return "ignore";
	}
	return isOnlyGallerySelectionItemSelected(options) ? "clear" : "select";
}

function createClearedGallerySelection(): GallerySelectionState {
	return { filenames: new Set(), subfolders: new Set(), lastIndex: null };
}

function createGallerySelectedItemSets(
	name: string,
	type: GalleryItemType,
): Pick<GallerySelectionState, "filenames" | "subfolders"> {
	switch (type) {
		case "image":
			return { filenames: new Set([name]), subfolders: new Set() };
		case "sub":
			return { filenames: new Set(), subfolders: new Set([name]) };
	}
}

function createGallerySingleItemSelection(
	options: Pick<GallerySelectionOptions, "index" | "name" | "type">,
): GallerySelectionState {
	return {
		...createGallerySelectedItemSets(options.name, options.type),
		lastIndex: options.index,
	};
}

function buildGallerySingleSelection(
	options: GallerySelectionOptions,
): GallerySelectionState | null {
	switch (getGallerySingleSelectionAction(options)) {
		case "ignore":
			return null;
		case "clear":
			return createClearedGallerySelection();
		case "select":
			return createGallerySingleItemSelection(options);
	}
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
