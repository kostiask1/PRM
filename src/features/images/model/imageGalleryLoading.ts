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

async function loadScopedGalleryImages({
	api,
	categories,
	category,
	contentScope,
	ignoreSourcesList,
	search,
	selectedSub,
	selectedSource,
}: GalleryImageLoadOptions): Promise<GalleryImage[]> {
	const searchAll = contentScope === "all";
	const searchSource = contentScope === "source";
	const result = await api.searchImageGallery({
		search,
		source: searchAll ? "" : selectedSource,
		category: searchAll || searchSource ? "" : category,
		subcategory: searchAll || searchSource ? "" : selectedSub,
		categories,
		ignoreSourcesList,
	});
	return Array.isArray(result?.images) ? result.images : [];
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
