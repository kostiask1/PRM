import type { CampaignRecord } from "../../../entities/campaign/index.js";
import type { ImageAsset } from "../api/imageApi.ts";
import type { ImageTargetSourceOption } from "./imageTargetSettings.ts";

export interface ImageFileNameParts {
	baseName: string;
	extension: string;
}

export function splitImageFileName(fileName: string): ImageFileNameParts {
	const lastDotIndex = fileName.lastIndexOf(".");
	if (lastDotIndex <= 0) return { baseName: fileName, extension: "" };
	return {
		baseName: fileName.slice(0, lastDotIndex),
		extension: fileName.slice(lastDotIndex),
	};
}

export function resolveImageUploadSource(
	initialSource?: string | null,
	campaignSlug?: string | null,
): string {
	return initialSource || campaignSlug || "general";
}

export function getImageUploadFileName(
	originalName: string,
	requestedBaseName: string,
): string {
	const { baseName, extension } = splitImageFileName(originalName);
	return `${requestedBaseName.trim() || baseName}${extension}`;
}

export function normalizeImageCampaigns(value: unknown): CampaignRecord[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(campaign): campaign is CampaignRecord =>
			Boolean(
				campaign &&
					typeof campaign === "object" &&
					typeof campaign.slug === "string" &&
					typeof campaign.name === "string",
			),
	);
}

export function getImageUploadSourceOptions(
	campaigns: CampaignRecord[],
	generalLabel: string,
): ImageTargetSourceOption[] {
	return [
		{ id: "general", label: generalLabel, icon: "database" },
		...campaigns.map((campaign) => ({
			id: campaign.slug,
			label: campaign.name,
			icon: "map" as const,
		})),
	];
}

export function requireUploadedImage(value: ImageAsset | null): ImageAsset {
	if (!value?.url) throw new Error("Image upload returned no result.");
	return value;
}

export function getImageUploadErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error || "Unknown error");
}
