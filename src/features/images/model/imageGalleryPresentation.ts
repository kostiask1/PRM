import type {
	GalleryImage,
	ImageGalleryCategory,
	ImageGalleryContentScope,
} from "./contracts.ts";

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

export interface GlobalGalleryResultNavigationPlan {
	category: ImageGalleryCategory;
	contentScope: "local";
	path: GalleryPath;
	pendingSelection: GalleryPendingSelection;
	searchQuery: "";
}

export interface GalleryDisplayImage extends GalleryImage {
	galleryKey: string;
}

export type GalleryPresentationItem =
	| { type: "sub"; sub: string; key: string }
	| { type: "image"; image: GalleryDisplayImage; key: string };

export type GalleryHistoryDirection = -1 | 1;

export type GalleryHistoryKeyboardPlan =
	| { action: "none"; preventDefault: false }
	| {
			action: "navigate";
			direction: GalleryHistoryDirection;
			preventDefault: true;
	  };

export interface GalleryFolderPresentation {
	canInteract: boolean;
	checkboxIcon: "check" | "plus";
	folderIcon: "folder" | "folder-bestiary" | "folder-npc" | "folder-players";
	hasFiles: boolean;
	isBestiaryFolder: boolean;
	isDragOver: boolean;
	isReadonly: boolean;
	isSelected: boolean;
	subcategory: string;
}

type GallerySearchScope = Exclude<ImageGalleryContentScope, "local">;

export interface GallerySearchScopeControl {
	icon: "book" | "layers" | "map";
	isActive: boolean;
	nextScope: ImageGalleryContentScope;
	scope: GallerySearchScope;
	titleKey:
		| "Show all campaign content"
		| "Show all database tokens"
		| "Show all gallery content"
		| "Show all general content";
}

export interface GallerySearchPresentation {
	clearSearchQuery: "";
	clearTitleKey: "Clear search";
	placeholderKey: "Search images...";
	scopeControls: GallerySearchScopeControl[];
	showClearButton: boolean;
}

const GALLERY_HISTORY_SHORTCUTS: Readonly<
	Record<string, GalleryHistoryDirection>
> = Object.freeze({
	"0000:Backspace": -1,
	"1000:ArrowLeft": -1,
	"1000:ArrowRight": 1,
});

const GALLERY_HISTORY_KEYBOARD_NONE_PLAN: GalleryHistoryKeyboardPlan =
	Object.freeze({ action: "none", preventDefault: false });

const GALLERY_FOLDER_ICON_NAMES = Object.freeze({
	npc: "folder-npc",
	players: "folder-players",
} as const);

function getGallerySourceScopeTitleKey(
	selectedSource: string,
): GallerySearchScopeControl["titleKey"] {
	return selectedSource === "general"
		? "Show all general content"
		: "Show all campaign content";
}

function createGallerySearchScopeControl({
	contentScope,
	icon,
	scope,
	titleKey,
}: {
	contentScope: ImageGalleryContentScope;
	icon: GallerySearchScopeControl["icon"];
	scope: GallerySearchScope;
	titleKey: GallerySearchScopeControl["titleKey"];
}): GallerySearchScopeControl {
	const isActive = contentScope === scope;
	return {
		icon,
		isActive,
		nextScope: isActive ? "local" : scope,
		scope,
		titleKey,
	};
}

function getGallerySearchScopeControls({
	canShowDatabaseTokens,
	contentScope,
	selectedSource,
}: {
	canShowDatabaseTokens: boolean;
	contentScope: ImageGalleryContentScope;
	selectedSource: string;
}): GallerySearchScopeControl[] {
	const controls = [
		createGallerySearchScopeControl({
			contentScope,
			icon: "map",
			scope: "source",
			titleKey: getGallerySourceScopeTitleKey(selectedSource),
		}),
	];
	if (canShowDatabaseTokens) {
		controls.push(
			createGallerySearchScopeControl({
				contentScope,
				icon: "book",
				scope: "databaseTokens",
				titleKey: "Show all database tokens",
			}),
		);
	}
	controls.push(
		createGallerySearchScopeControl({
			contentScope,
			icon: "layers",
			scope: "all",
			titleKey: "Show all gallery content",
		}),
	);
	return controls;
}

export function getGallerySearchPresentation({
	canShowDatabaseTokens,
	contentScope,
	searchQuery,
	selectedSource,
}: {
	canShowDatabaseTokens: boolean;
	contentScope: ImageGalleryContentScope;
	searchQuery: string;
	selectedSource: string;
}): GallerySearchPresentation {
	return {
		clearSearchQuery: "",
		clearTitleKey: "Clear search",
		placeholderKey: "Search images...",
		scopeControls: getGallerySearchScopeControls({
			canShowDatabaseTokens,
			contentScope,
			selectedSource,
		}),
		showClearButton: Boolean(searchQuery),
	};
}

export function getGalleryFolderSubcategory(
	selectedSub: string,
	sub: string,
): string {
	return selectedSub ? `${selectedSub}/${sub}` : sub;
}

function getGalleryFolderIcon(
	sub: string,
	isBestiaryFolder: boolean,
): GalleryFolderPresentation["folderIcon"] {
	if (isBestiaryFolder) return "folder-bestiary";
	return GALLERY_FOLDER_ICON_NAMES[
		sub as keyof typeof GALLERY_FOLDER_ICON_NAMES
	] ?? "folder";
}

function getGalleryFolderCheckboxIcon(
	isSelected: boolean,
): GalleryFolderPresentation["checkboxIcon"] {
	return isSelected ? "check" : "plus";
}

export function getGalleryFolderPresentation({
	dragOverTargetId,
	hasFiles,
	isBestiaryFolder,
	isReadonly,
	isSelected,
	selectedSub,
	sub,
}: {
	dragOverTargetId?: string;
	hasFiles: boolean;
	isBestiaryFolder: boolean;
	isReadonly: boolean;
	isSelected: boolean;
	selectedSub: string;
	sub: string;
}): GalleryFolderPresentation {
	return {
		canInteract: !isReadonly,
		checkboxIcon: getGalleryFolderCheckboxIcon(isSelected),
		folderIcon: getGalleryFolderIcon(sub, isBestiaryFolder),
		hasFiles,
		isBestiaryFolder,
		isDragOver: dragOverTargetId === sub,
		isReadonly,
		isSelected,
		subcategory: getGalleryFolderSubcategory(selectedSub, sub),
	};
}

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

function isGlobalGalleryResult(
	image: GalleryImage | null | undefined,
	isSelectionMode: boolean,
): image is GalleryImage {
	if (isSelectionMode || !image) return false;
	return Boolean(image.globalSearch);
}

function findGalleryResultCategory(
	categories: readonly ImageGalleryCategory[],
	categoryId: string | undefined,
): ImageGalleryCategory | null {
	return categories.find((candidate) => candidate.id === categoryId) ?? null;
}

function getGlobalGalleryResultPath(image: GalleryImage): GalleryPathEntry {
	return getGalleryPathEntry(
		image.source,
		image.category,
		image.subcategory || "",
	);
}

function createGlobalGalleryResultNavigationPlan(
	category: ImageGalleryCategory,
	image: GalleryImage,
): GlobalGalleryResultNavigationPlan {
	const { pathKey, ...path } = getGlobalGalleryResultPath(image);
	return {
		category,
		contentScope: "local",
		path,
		pendingSelection: { name: image.name, pathKey },
		searchQuery: "",
	};
}

export function getGlobalGalleryResultNavigationPlan({
	categories,
	image,
	isSelectionMode,
}: {
	categories: readonly ImageGalleryCategory[];
	image: GalleryImage | null | undefined;
	isSelectionMode: boolean;
}): GlobalGalleryResultNavigationPlan | null {
	if (!isGlobalGalleryResult(image, isSelectionMode)) return null;
	const category = findGalleryResultCategory(categories, image.category);
	if (!category) return null;
	return createGlobalGalleryResultNavigationPlan(category, image);
}

export function galleryPathEntriesEqual(
	left: GalleryPathEntry | null | undefined,
	right: GalleryPathEntry | null | undefined,
): boolean {
	return Boolean(left && right && left.pathKey === right.pathKey);
}

function resolveGalleryImagePathSegment(
	value: string | undefined,
	fallback: string,
	defaultValue: string,
): string {
	return value || fallback || defaultValue;
}

function resolveGalleryImageSubcategory(
	value: string | null | undefined,
	fallback: string | null | undefined,
): string {
	return value ?? fallback ?? "";
}

function getGalleryImagePath(
	image: GalleryImage,
	fallbackPath: GalleryPath,
): GalleryPath {
	return {
		source: resolveGalleryImagePathSegment(
			image.source,
			fallbackPath.source,
			"general",
		),
		category: resolveGalleryImagePathSegment(
			image.category,
			fallbackPath.category,
			"",
		),
		subcategory: resolveGalleryImageSubcategory(
			image.subcategory,
			fallbackPath.subcategory,
		),
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

function canNavigateGalleryHistory(
	direction: GalleryHistoryDirection,
	canNavigateBack: boolean,
	canNavigateForward: boolean,
): boolean {
	return direction === -1 ? canNavigateBack : canNavigateForward;
}

export function getGalleryHistoryKeyboardPlan({
	canNavigateBack,
	canNavigateForward,
	isEditableTarget,
	isOpen,
	...keyboard
}: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"> & {
	canNavigateBack: boolean;
	canNavigateForward: boolean;
	isEditableTarget: boolean;
	isOpen: boolean;
}): GalleryHistoryKeyboardPlan {
	if (!isOpen || isEditableTarget) return GALLERY_HISTORY_KEYBOARD_NONE_PLAN;
	const direction = getGalleryHistoryKeyDirection(keyboard);
	if (
		!direction ||
		!canNavigateGalleryHistory(
			direction,
			canNavigateBack,
			canNavigateForward,
		)
	) {
		return GALLERY_HISTORY_KEYBOARD_NONE_PLAN;
	}
	return { action: "navigate", direction, preventDefault: true };
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
