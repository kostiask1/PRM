import type { ImageAsset, ImageLocation } from "../api/imageApi.ts";

export interface ImageGalleryCategory {
	id: string;
	label: string;
	icon: string;
	subs?: string[];
}

export type ImageGalleryContentScope =
	| "local"
	| "source"
	| "all"
	| "databaseTokens";

export interface UseImageGalleryOptions {
	isOpen: boolean;
	initialSource?: string;
	initialCategory?: string;
	initialSubcategory?: string;
}

export interface GalleryImage extends ImageAsset {
	assetSource?: unknown;
	category?: string;
	subcategory?: string;
	locationLabel?: string;
	globalSearch?: boolean;
}

export interface GallerySubcategoryDetails {
	hasFiles: boolean;
}

export type GallerySubcategoryDetailsMap = Record<
	string,
	GallerySubcategoryDetails
>;

export interface GalleryDropTarget extends ImageLocation {
	readonly?: boolean;
}

export interface GalleryDragOverTarget {
	type: "source" | "cat" | "sub" | "breadcrumb";
	id: string;
}

export interface GalleryMoveGroup {
	src: ImageLocation;
	items: string[];
}

export type GalleryItemType = "image" | "sub";
