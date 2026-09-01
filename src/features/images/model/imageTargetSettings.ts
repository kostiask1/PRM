export interface ImageTargetValue {
	source: string;
	category: string;
	subcategory: string;
}

export interface ImageTargetSourceOption {
	id: string;
	label: string;
	icon?: IconName;
}

export function normalizeImageTargetPath(path: unknown): string {
	return String(path || "")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\/{2,}/g, "/");
}

export function getImageTargetPathParts(path: unknown): string[] {
	return normalizeImageTargetPath(path).split("/").filter(Boolean);
}

export function enterImageTargetSubfolder(
	currentPath: unknown,
	segment: unknown,
): string {
	return normalizeImageTargetPath(
		[currentPath, segment].map(normalizeImageTargetPath).filter(Boolean).join("/"),
	);
}

export function navigateImageTargetPath(
	currentPath: unknown,
	partIndex: number,
): string {
	if (partIndex < 0) return "";
	return getImageTargetPathParts(currentPath)
		.slice(0, partIndex + 1)
		.join("/");
}

export function getImageTargetParentPath(currentPath: unknown): string {
	return getImageTargetPathParts(currentPath).slice(0, -1).join("/");
}

export function normalizeSubcategoryNames(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is string => typeof item === "string" && item.length > 0,
	);
}
import type { IconName } from "../../../shared/ui/index.js";
