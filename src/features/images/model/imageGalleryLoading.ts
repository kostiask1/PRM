import {
	imageApi,
	type BestiaryTokenResult,
	type SubcategoryMetadata,
} from "../api/imageApi.ts";
import type {
	GalleryImage,
	GallerySubcategoryDetailsMap,
	ImageGalleryContentScope,
} from "./contracts.ts";
import { getGalleryFolderSubcategory } from "./imageGalleryPresentation.ts";

type GalleryLoadingApi = Pick<
	typeof imageApi,
	| "getBestiaryTokenAssets"
	| "getImages"
	| "getSubcategories"
	| "searchImageGallery"
>;

export interface GallerySubcategoryLoadResult {
	dynamicSubs: string[];
	officialRootSubs: Set<string>;
	officialSubs: Set<string>;
	subDetails: GallerySubcategoryDetailsMap;
}

function normalizeSubcategoryEntries(value: unknown): {
	names: string[];
	details: GallerySubcategoryDetailsMap;
} {
	if (!Array.isArray(value)) return { names: [], details: {} };
	const details: GallerySubcategoryDetailsMap = {};
	const names = value
		.map((entry) => {
			if (entry && typeof entry === "object") {
				const metadata = entry as SubcategoryMetadata;
				const name = String(metadata.name || "").trim();
				if (name) details[name] = { hasFiles: Boolean(metadata.hasFiles) };
				return name;
			}
			return String(entry || "").trim();
		})
		.filter(Boolean);
	return { names, details };
}

function getOfficialSubcategories(
	result: BestiaryTokenResult | null,
): string[] {
	return Array.isArray(result?.subcategories) ? result.subcategories : [];
}

export async function loadGallerySubcategoryData({
	activeSearchQuery,
	api,
	category,
	ignoreSourcesList,
	isGeneralTokens,
	selectedSub,
	selectedSource,
}: {
	activeSearchQuery: string;
	api: GalleryLoadingApi;
	category: string;
	ignoreSourcesList: string[];
	isGeneralTokens: boolean;
	selectedSub: string;
	selectedSource: string;
}): Promise<GallerySubcategoryLoadResult> {
	const officialAssetsPromise = isGeneralTokens
		? api.getBestiaryTokenAssets(
				selectedSub,
				activeSearchQuery,
				ignoreSourcesList,
			)
		: Promise.resolve(null);
	const officialRootAssetsPromise = isGeneralTokens
		? api.getBestiaryTokenAssets("", "", ignoreSourcesList)
		: Promise.resolve(null);
	const [subcategories, officialAssets, officialRootAssets] = await Promise.all([
		api.getSubcategories(selectedSource, category, selectedSub, {
			includeMeta: true,
		}),
		officialAssetsPromise,
		officialRootAssetsPromise,
	]);
	const normalized = normalizeSubcategoryEntries(subcategories);
	const officialNames = getOfficialSubcategories(officialAssets);
	const officialRootNames = getOfficialSubcategories(officialRootAssets);
	return {
		dynamicSubs: [...normalized.names, ...officialNames],
		officialRootSubs: new Set(
			officialRootNames.length > 0 ? officialRootNames : officialNames,
		),
		officialSubs: new Set(officialNames),
		subDetails: normalized.details,
	};
}

function mapDatabaseTokenImage(image: GalleryImage): GalleryImage {
	const pathParts = String(image.path || "")
		.split(/[\\/]+/)
		.filter(Boolean)
		.slice(2, -1);
	return {
		...image,
		assetSource: image.source,
		source: "general",
		category: "tokens",
		subcategory: pathParts.join("/"),
		locationLabel: ["database", "tokens", ...pathParts].join(" / "),
		globalSearch: true,
	};
}

async function loadDatabaseTokenImages(
	api: GalleryLoadingApi,
	search: string,
	ignoreSourcesList: string[],
): Promise<GalleryImage[]> {
	const result = await api.getBestiaryTokenAssets(
		"",
		search,
		ignoreSourcesList,
		{ recursive: true },
	);
	return Array.isArray(result?.images)
		? result.images.map(mapDatabaseTokenImage)
		: [];
}

type GalleryFolderInspectionApi = Pick<
	GalleryLoadingApi,
	"getImages" | "getSubcategories"
>;

function hasGalleryFolderContents(
	images: unknown,
	subcategories: unknown,
): boolean {
	return (
		(Array.isArray(images) ? images.length : 0) > 0 ||
		(Array.isArray(subcategories) ? subcategories.length : 0) > 0
	);
}

async function inspectGalleryFolderContents({
	api,
	category,
	folderName,
	selectedSource,
	selectedSub,
}: {
	api: GalleryFolderInspectionApi;
	category: string;
	folderName: string;
	selectedSource: string;
	selectedSub: string;
}): Promise<boolean> {
	const folderPath = getGalleryFolderSubcategory(selectedSub, folderName);
	const [images, subcategories] = await Promise.all([
		api.getImages(selectedSource, category, folderPath),
		api.getSubcategories(selectedSource, category, folderPath),
	]);
	return hasGalleryFolderContents(images, subcategories);
}

export async function hasNonEmptyGalleryFolders({
	api,
	category,
	folderNames,
	selectedSource,
	selectedSub,
}: {
	api: GalleryFolderInspectionApi;
	category: string;
	folderNames: string[];
	selectedSource: string;
	selectedSub: string;
}): Promise<boolean> {
	if (folderNames.length === 0) return false;
	const inspections = await Promise.all(
		folderNames.map((folderName) =>
			inspectGalleryFolderContents({
				api,
				category,
				folderName,
				selectedSource,
				selectedSub,
			}),
		),
	);
	return inspections.some(Boolean);
}

type ScopedGallerySearchOptions = Pick<
	GalleryImageLoadOptions,
	| "categories"
	| "category"
	| "contentScope"
	| "ignoreSourcesList"
	| "search"
	| "selectedSub"
	| "selectedSource"
>;

interface ScopedGallerySearchQuery {
	search: string;
	source: string;
	category: string;
	subcategory: string;
	categories: string[];
	ignoreSourcesList: string[];
}

function getScopedGallerySearchPath({
	category,
	contentScope,
	selectedSub,
	selectedSource,
}: ScopedGallerySearchOptions): Pick<
	ScopedGallerySearchQuery,
	"source" | "category" | "subcategory"
> {
	switch (contentScope) {
		case "all":
			return { source: "", category: "", subcategory: "" };
		case "source":
			return { source: selectedSource, category: "", subcategory: "" };
		default:
			return { source: selectedSource, category, subcategory: selectedSub };
	}
}

export function getScopedGallerySearchQuery(
	options: ScopedGallerySearchOptions,
): ScopedGallerySearchQuery {
	return {
		search: options.search,
		...getScopedGallerySearchPath(options),
		categories: options.categories,
		ignoreSourcesList: options.ignoreSourcesList,
	};
}

function normalizeScopedGalleryImages(
	result: { images?: GalleryImage[] | null } | null | undefined,
): GalleryImage[] {
	return Array.isArray(result?.images) ? result.images : [];
}

async function loadScopedGalleryImages(
	options: GalleryImageLoadOptions,
): Promise<GalleryImage[]> {
	const result = await options.api.searchImageGallery(
		getScopedGallerySearchQuery(options),
	);
	return normalizeScopedGalleryImages(result);
}

async function loadLocalGalleryImages({
	activeSearchQuery,
	api,
	category,
	ignoreSourcesList,
	isGeneralTokens,
	normalizedSearchQuery,
	selectedSub,
	selectedSource,
}: GalleryImageLoadOptions): Promise<GalleryImage[]> {
	const officialPromise = isGeneralTokens
		? api.getBestiaryTokenAssets(
				selectedSub,
				activeSearchQuery,
				ignoreSourcesList,
			)
		: Promise.resolve(null);
	const [userResult, officialResult] = await Promise.all([
		api.getImages(selectedSource, category, selectedSub),
		officialPromise,
	]);
	const userImages = (Array.isArray(userResult) ? userResult : []).filter(
		(image) =>
			!normalizedSearchQuery ||
			image.name.toLowerCase().includes(normalizedSearchQuery),
	);
	const officialImages = Array.isArray(officialResult?.images)
		? officialResult.images
		: [];
	return [...userImages, ...officialImages];
}

export interface GalleryImageLoadOptions {
	activeSearchQuery: string;
	api: GalleryLoadingApi;
	categories: string[];
	category: string;
	contentScope: ImageGalleryContentScope;
	ignoreSourcesList: string[];
	isGeneralTokens: boolean;
	isScopedContent: boolean;
	normalizedSearchQuery: string;
	search: string;
	selectedSub: string;
	selectedSource: string;
}

export async function loadGalleryImages(
	options: GalleryImageLoadOptions,
): Promise<GalleryImage[]> {
	const requiresSearch = Boolean(
		options.normalizedSearchQuery || options.isScopedContent,
	);
	if (!requiresSearch) return loadLocalGalleryImages(options);
	if (options.contentScope === "databaseTokens") {
		return loadDatabaseTokenImages(
			options.api,
			options.search,
			options.ignoreSourcesList,
		);
	}
	return loadScopedGalleryImages(options);
}
