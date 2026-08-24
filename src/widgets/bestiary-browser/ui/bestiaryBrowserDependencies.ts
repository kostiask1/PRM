import { campaignApi } from "../../../entities/campaign/index.js";
import { bestiaryApi } from "../../../entities/bestiary/index.js";
import {
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
	type AiHistoryEntry,
	type AiHistoryResource,
} from "../../../features/ai/index.js";
import { settingsApi } from "../../../features/settings/index.js";
import { lang } from "../../../shared/lib/index.js";

export const bestiaryBrowserApi = {
	...campaignApi,
	...bestiaryApi,
	...settingsApi,
};

export function translate(value: string): string {
	return lang.t(value);
}

export function getHistoryChangeSummary(
	entry: AiHistoryEntry | null | undefined,
): string {
	return getAiHistoryChangeSummary(entry, translate);
}

export function getDiffResourceState(resource: AiHistoryResource): string {
	return getLocalizedDiffResourceState(resource, translate);
}
