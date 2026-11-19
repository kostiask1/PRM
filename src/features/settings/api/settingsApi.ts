import { request } from "../../../shared/api/index.ts";

export type SettingsPayload = Record<string, unknown>;

export interface StorageHistoryMetric {
	bytes: number;
	entryCount: number;
}

export interface ProjectAiHistoryMetric extends StorageHistoryMetric {
	campaignsBytes: number;
	campaignsEntryCount: number;
	bestiaryBytes: number;
	bestiaryEntryCount: number;
}

export interface ProjectUndoRedoMetric extends StorageHistoryMetric {
	applicationBytes: number;
	applicationEntryCount: number;
	tombstonesBytes: number;
	campaignsBytes: number;
	campaignsEntryCount: number;
}

export interface CampaignStorageBreakdown {
	slug: string;
	name: string;
	contentBytes: number;
	imagesBytes: number;
	aiHistory: StorageHistoryMetric;
	undoRedo: StorageHistoryMetric;
	totalBytes: number;
}

export interface ProjectStorageBreakdown {
	contentBytes: number;
	imagesBytes: number;
	generalImagesBytes: number;
	appDataBytes: number;
	aiHistory: ProjectAiHistoryMetric;
	undoRedo: ProjectUndoRedoMetric;
	totalBytes: number;
}

export interface SettingsStorageOverview {
	project: ProjectStorageBreakdown;
	campaigns: CampaignStorageBreakdown[];
}

export type AiHistoryClearScope = "all" | "bestiary" | "campaign";

export interface ClearAiHistoryResponse {
	cleared: boolean;
	scope: AiHistoryClearScope;
	campaignSlug: string | null;
	storage: SettingsStorageOverview;
}

export const settingsApi = {
	getSettings: (): Promise<SettingsPayload | null> => request("/settings"),
	updateSettings: (
		payload: SettingsPayload,
	): Promise<SettingsPayload | null> =>
		request("/settings", {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	getStorageOverview: (): Promise<SettingsStorageOverview | null> =>
		request("/settings/storage"),
	clearAiHistory: ({
		scope,
		campaignSlug,
	}: {
		scope: AiHistoryClearScope;
		campaignSlug?: string | null;
	}): Promise<ClearAiHistoryResponse | null> => {
		const params = new URLSearchParams({ scope });
		if (scope === "campaign" && campaignSlug) {
			params.set("campaign", campaignSlug);
		}
		return request(`/settings/storage/ai-history?${params.toString()}`, {
			method: "DELETE",
		});
	},
};
