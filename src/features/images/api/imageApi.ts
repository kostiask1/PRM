import { request } from "../../../shared/api/index.ts";

export interface ImageLocation {
	slug: string;
	category: string;
	subcategory?: string;
}

export interface ImageAsset extends Record<string, unknown> {
	name: string;
	displayName?: string;
	url: string;
	path?: string;
	sizeBytes?: number;
	readonly?: boolean;
	source?: string;
}

export interface ImageGalleryFilters {
	source?: string;
	category?: string;
	subcategory?: string;
	categories?: string[];
	ignoreSourcesList?: string[];
}

export interface ImageSearchFilters extends ImageGalleryFilters {
	search?: string;
}

export interface BestiaryTokenOptions {
	recursive?: boolean;
}

export interface BestiaryTokenResult {
	images: ImageAsset[];
	subcategories?: string[];
}

export interface ImageGalleryStats {
	totalBytes: number;
	sourceBytes: number;
	categoryBytes: number;
	subcategoryBytes: number;
	sourceSizes: Record<string, number>;
	categorySizes: Record<string, number>;
}

export interface ImageMovePayload {
	items: string[];
	src: ImageLocation;
	dest: ImageLocation;
}

export interface ImageMoveResult {
	oldUrl: string;
	newUrl: string;
}

export interface ImageDeletePayload {
	items: string[];
	src: ImageLocation;
	options?: { extractFolderContents?: boolean };
}

export interface SubcategoryMetadata {
	name: string;
	hasFiles: boolean;
}

export interface SubcategoryListOptions {
	includeMeta?: boolean;
}

function appendImageGalleryQuery(
	query: URLSearchParams,
	{
		source = "",
		category = "",
		subcategory = "",
		categories = [],
		ignoreSourcesList = [],
	}: ImageGalleryFilters = {},
) {
	if (source) query.set("source", source);
	if (category) query.set("category", category);
	if (subcategory) query.set("subcategory", subcategory);
	if (categories.length > 0) query.set("categories", categories.join(","));
	if (ignoreSourcesList.length > 0) {
		query.set("ignoreSources", ignoreSourcesList.join(","));
	}
}

export const imageApi = {
	uploadImage: (
		slug: string,
		category: string,
		subcategory: string | undefined,
		file: Blob,
	) => {
		const formData = new FormData();
		if (subcategory) formData.append("subcategory", subcategory);
		formData.append("image", file);
		return request<ImageAsset>(
			`/campaigns/${encodeURIComponent(slug)}/images/${encodeURIComponent(category)}`,
			{ method: "POST", body: formData },
		);
	},
	getImages: (slug: string, category: string, subcategory?: string) =>
		request<ImageAsset[]>(
			`/campaigns/${encodeURIComponent(slug)}/images/${encodeURIComponent(category)}${subcategory ? `?subcategory=${encodeURIComponent(subcategory)}` : ""}`,
		),
	getBestiaryTokenAssets: (
		subcategory = "",
		search = "",
		ignoreSourcesList: string[] = [],
		options: BestiaryTokenOptions = {},
	) => {
		const query = new URLSearchParams();
		if (subcategory) query.set("subcategory", subcategory);
		if (search) query.set("search", search);
		if (ignoreSourcesList.length > 0) {
			query.set("ignoreSources", ignoreSourcesList.join(","));
		}
		if (options.recursive) query.set("recursive", "1");
		return request<BestiaryTokenResult>(
			`/images/bestiary-tokens?${query.toString()}`,
		);
	},
	searchImageGallery: ({ search = "", ...filters }: ImageSearchFilters = {}) => {
		const query = new URLSearchParams();
		if (search) query.set("search", search);
		appendImageGalleryQuery(query, filters);
		return request<{ images: ImageAsset[] }>(
			`/images/search?${query.toString()}`,
		);
	},
	getImageGalleryStats: (
		slug: string,
		category?: string,
		subcategory?: string,
		categories: string[] = [],
	) => {
		const query = new URLSearchParams();
		appendImageGalleryQuery(query, {
			source: slug,
			category,
			subcategory,
			categories,
		});
		return request<ImageGalleryStats>(`/images/stats?${query.toString()}`);
	},
	moveImages: (payload: ImageMovePayload) =>
		request<ImageMoveResult[]>("/images/move", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
	createSubcategory: (slug: string, category: string, name: string) =>
		request<{ ok: true }>(
			`/campaigns/${encodeURIComponent(slug)}/images/${encodeURIComponent(category)}/subcategories`,
			{ method: "POST", body: JSON.stringify({ name }) },
		),
	getSubcategories: (
		slug: string,
		category: string,
		subcategory = "",
		options: SubcategoryListOptions = {},
	) => {
		const params = new URLSearchParams();
		if (subcategory) params.set("subcategory", subcategory);
		if (options.includeMeta) params.set("includeMeta", "1");
		const query = params.toString();
		return request<string[] | SubcategoryMetadata[]>(
			`/campaigns/${encodeURIComponent(slug)}/images/${encodeURIComponent(category)}/subcategories${query ? `?${query}` : ""}`,
		);
	},
	renameSubcategory: (
		slug: string,
		category: string,
		oldName: string,
		newName: string,
	) =>
		request<{ ok: true }>(
			`/campaigns/${encodeURIComponent(slug)}/images/${encodeURIComponent(category)}/subcategories/${encodeURIComponent(oldName)}`,
			{ method: "PATCH", body: JSON.stringify({ newName }) },
		),
	renameImage: (
		slug: string,
		category: string,
		subcategory: string | undefined,
		oldName: string,
		newName: string,
	) =>
		request<ImageMoveResult>(
			`/campaigns/${encodeURIComponent(slug)}/images/${encodeURIComponent(category)}/rename`,
			{
				method: "PATCH",
				body: JSON.stringify({ subcategory, oldName, newName }),
			},
		),
	deleteImages: (payload: ImageDeletePayload) =>
		request<{ ok: true }>("/images/delete", {
			method: "POST",
			body: JSON.stringify(payload),
		}),
};
