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

export interface GalleryGridDragOverPlan {
	nextDraggingOver: boolean | null;
	preventDefault: true;
}

export type GalleryEscapePlan =
	| { action: "clear-selection"; preventDefault: true; stopPropagation: true }
	| { action: "close-preview"; preventDefault: true; stopPropagation: true }
	| { action: "none"; preventDefault: false; stopPropagation: false };

export type GalleryPreviewDirection = -1 | 1;

export interface GalleryPreviewKeyboardPlan {
	action: "navigate-preview" | "none";
	direction?: GalleryPreviewDirection;
	preventDefault: boolean;
	stopPropagation: boolean;
}

export interface GalleryPreviewNavigationState {
	currentIndex: number;
	totalCount: number;
	canNavigatePrev: boolean;
	canNavigateNext: boolean;
	prevImage: GalleryImage | null;
	nextImage: GalleryImage | null;
}

export type GalleryGridDropPlan =
	| {
			action: "delegate";
			preventDefault: false;
			target: GalleryDropTarget;
	  }
	| {
			action: "reject-search";
			nextDraggingOver: false;
			preventDefault: true;
	  };

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

const GALLERY_ESCAPE_NONE_PLAN: GalleryEscapePlan = Object.freeze({
	action: "none",
	preventDefault: false,
	stopPropagation: false,
});

export function getGalleryEscapePlan({
	hasPreview,
	hasSelection,
	key,
}: {
	hasPreview: boolean;
	hasSelection: boolean;
	key: string;
}): GalleryEscapePlan {
	if (key !== "Escape") return GALLERY_ESCAPE_NONE_PLAN;
	if (hasPreview) {
		return {
			action: "close-preview",
			preventDefault: true,
			stopPropagation: true,
		};
	}
	if (hasSelection) {
		return {
			action: "clear-selection",
			preventDefault: true,
			stopPropagation: true,
		};
	}
	return GALLERY_ESCAPE_NONE_PLAN;
}

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

export function getGalleryGridDropTarget({
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

function isExactGalleryGridDragLocation(
	dragSource: ImageLocation | null,
	target: GalleryDropTarget,
): boolean {
	return Boolean(
		dragSource &&
			dragSource.slug === target.slug &&
			dragSource.category === target.category &&
			dragSource.subcategory === target.subcategory,
	);
}

export function getGalleryGridDragOverPlan({
	dragSource,
	isSearchResults,
	target,
}: {
	dragSource: ImageLocation | null;
	isSearchResults: boolean;
	target: GalleryDropTarget;
}): GalleryGridDragOverPlan {
	if (isSearchResults) {
		return { nextDraggingOver: false, preventDefault: true };
	}
	const canShowOverlay =
		!isExactGalleryGridDragLocation(dragSource, target) && !target.readonly;
	return {
		nextDraggingOver: canShowOverlay ? true : null,
		preventDefault: true,
	};
}

export function getGalleryGridDropPlan({
	isSearchResults,
	target,
}: {
	isSearchResults: boolean;
	target: GalleryDropTarget;
}): GalleryGridDropPlan {
	return isSearchResults
		? {
			action: "reject-search",
			nextDraggingOver: false,
			preventDefault: true,
		}
		: { action: "delegate", preventDefault: false, target };
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

export function getGalleryImageSelectionKey(image: GalleryImage): string {
	if (image.source === undefined && image.category === undefined && image.subcategory === undefined) return image.name;
	return JSON.stringify([image.source ?? "", image.category ?? "", image.subcategory ?? "", image.name]);
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
				options.images.find((image) => getGalleryImageSelectionKey(image) === name),
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
			name: getGalleryImageSelectionKey(image),
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
	const selected = selectionByType[type].has(image ? getGalleryImageSelectionKey(image) : name);
	const items = selected ? getMovableSelection() : [name];
	return items.length > 0 ? { items, src: location } : null;
}

export function findGalleryPreviewImageIndex(
	images: readonly GalleryImage[],
	target: GalleryImage | null,
): number {
	if (!target || !images.length) return -1;
	const refIndex = images.indexOf(target);
	if (refIndex !== -1) return refIndex;
	const targetKey = getGalleryImageSelectionKey(target);
	const keyIndex = images.findIndex(
		(image) => getGalleryImageSelectionKey(image) === targetKey,
	);
	if (keyIndex !== -1) return keyIndex;
	const urlIndex = images.findIndex(
		(image) => Boolean(image.url && target.url && image.url === target.url),
	);
	if (urlIndex !== -1) return urlIndex;
	return images.findIndex((image) => image.name === target.name);
}

export function getAdjacentGalleryPreviewImage({
	currentImage,
	direction,
	images,
}: {
	currentImage: GalleryImage | null;
	direction: GalleryPreviewDirection;
	images: readonly GalleryImage[];
}): GalleryImage | null {
	if (!currentImage || !images.length) return null;
	const currentIndex = findGalleryPreviewImageIndex(images, currentImage);
	if (currentIndex === -1) return null;
	const nextIndex = currentIndex + direction;
	if (nextIndex < 0 || nextIndex >= images.length) return null;
	return images[nextIndex] ?? null;
}

export function getGalleryPreviewNavigationState({
	currentImage,
	images,
}: {
	currentImage: GalleryImage | null;
	images: readonly GalleryImage[];
}): GalleryPreviewNavigationState {
	const totalCount = images.length;
	const currentIndex = findGalleryPreviewImageIndex(images, currentImage);
	if (currentIndex === -1) {
		return {
			currentIndex: -1,
			totalCount,
			canNavigatePrev: false,
			canNavigateNext: false,
			prevImage: null,
			nextImage: null,
		};
	}
	const canNavigatePrev = currentIndex > 0;
	const canNavigateNext = currentIndex < totalCount - 1;
	return {
		currentIndex,
		totalCount,
		canNavigatePrev,
		canNavigateNext,
		prevImage: canNavigatePrev ? images[currentIndex - 1] ?? null : null,
		nextImage: canNavigateNext ? images[currentIndex + 1] ?? null : null,
	};
}

export function getGalleryPreviewKeyboardPlan({
	altKey = false,
	ctrlKey = false,
	hasPreview,
	isEditableTarget = false,
	key,
	metaKey = false,
	shiftKey = false,
}: {
	altKey?: boolean;
	ctrlKey?: boolean;
	hasPreview: boolean;
	isEditableTarget?: boolean;
	key: string;
	metaKey?: boolean;
	shiftKey?: boolean;
}): GalleryPreviewKeyboardPlan {
	if (!hasPreview || isEditableTarget || altKey || ctrlKey || metaKey || shiftKey) {
		return {
			action: "none",
			preventDefault: false,
			stopPropagation: false,
		};
	}
	if (key === "ArrowLeft") {
		return {
			action: "navigate-preview",
			direction: -1,
			preventDefault: true,
			stopPropagation: true,
		};
	}
	if (key === "ArrowRight") {
		return {
			action: "navigate-preview",
			direction: 1,
			preventDefault: true,
			stopPropagation: true,
		};
	}
	return {
		action: "none",
		preventDefault: false,
		stopPropagation: false,
	};
}

export const GALLERY_DRAG_SCROLL_EDGE_MAX_PX = 96;
export const GALLERY_DRAG_SCROLL_EDGE_RATIO = 0.18;
export const GALLERY_DRAG_SCROLL_MIN_SPEED_PX_PER_SEC = 220;
export const GALLERY_DRAG_SCROLL_MAX_SPEED_PX_PER_SEC = 1100;
export const GALLERY_DRAG_SCROLL_STALE_MS = 650;

export interface GalleryGridDragAutoScrollInput {
	clientHeight: number;
	pointerY: number;
	scrollHeight: number;
	scrollTop: number;
	viewportBottom: number;
	viewportTop: number;
}

/** Compute signed vertical auto-scroll velocity (px/s) near top or bottom grid edges. */
export function getGalleryGridDragAutoScrollVelocity({
	clientHeight,
	pointerY,
	scrollHeight,
	scrollTop,
	viewportBottom,
	viewportTop,
}: GalleryGridDragAutoScrollInput): number {
	if (
		!Number.isFinite(clientHeight) ||
		!Number.isFinite(pointerY) ||
		!Number.isFinite(scrollHeight) ||
		!Number.isFinite(scrollTop) ||
		!Number.isFinite(viewportBottom) ||
		!Number.isFinite(viewportTop)
	) {
		return 0;
	}
	const viewportHeight = viewportBottom - viewportTop;
	const maxScrollTop = scrollHeight - clientHeight;
	if (
		viewportHeight <= 0 ||
		maxScrollTop <= 0 ||
		pointerY < viewportTop ||
		pointerY > viewportBottom
	) {
		return 0;
	}
	const edgeSize = Math.min(
		GALLERY_DRAG_SCROLL_EDGE_MAX_PX,
		viewportHeight * GALLERY_DRAG_SCROLL_EDGE_RATIO,
	);
	if (edgeSize <= 0) return 0;

	const speedSpan =
		GALLERY_DRAG_SCROLL_MAX_SPEED_PX_PER_SEC -
		GALLERY_DRAG_SCROLL_MIN_SPEED_PX_PER_SEC;
	const distanceFromTop = pointerY - viewportTop;
	if (distanceFromTop <= edgeSize && scrollTop > 0) {
		const intensity = Math.min(1, Math.max(0, 1 - distanceFromTop / edgeSize));
		return -(GALLERY_DRAG_SCROLL_MIN_SPEED_PX_PER_SEC + intensity * speedSpan);
	}
	const distanceFromBottom = viewportBottom - pointerY;
	if (distanceFromBottom <= edgeSize && scrollTop < maxScrollTop) {
		const intensity = Math.min(
			1,
			Math.max(0, 1 - distanceFromBottom / edgeSize),
		);
		return GALLERY_DRAG_SCROLL_MIN_SPEED_PX_PER_SEC + intensity * speedSpan;
	}
	return 0;
}
