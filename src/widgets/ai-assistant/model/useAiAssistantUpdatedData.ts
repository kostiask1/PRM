import { useCallback } from "react";
import {
	buildAiUpdatedDataPlan,
	executeAiUpdatedDataPlan,
	type AiHistoryEntry,
	type BuildAiUpdatedDataPlanOptions,
} from "../../../features/ai/index.js";

export interface ApplyUpdatedAiDataOptions {
	entityTypes?: unknown;
	generated?: BuildAiUpdatedDataPlanOptions["generated"];
	historyEntry?: AiHistoryEntry | null;
	trackUndo?: boolean;
}

interface UseAiAssistantUpdatedDataOptions {
	activeCampaign: unknown;
	campaignSlug: string;
	encounterId?: string | number | null;
	fallbackSessionFileName?: string;
	isBestiary: boolean;
	isCampaign: boolean;
	isEncounter: boolean;
	publishSyncEvent(event: Record<string, unknown>): void;
	refreshEntities(): void;
	requestCampaignReload(): void;
	setActiveCampaign(campaign: unknown): void;
	setActiveEncounter(encounter: unknown): void;
	setActiveSession(session: unknown): void;
	sessionFileName?: string | null;
}

export function useAiAssistantUpdatedData({
	activeCampaign,
	campaignSlug,
	encounterId,
	fallbackSessionFileName,
	isBestiary,
	isCampaign,
	isEncounter,
	publishSyncEvent,
	refreshEntities,
	requestCampaignReload,
	setActiveCampaign,
	setActiveEncounter,
	setActiveSession,
	sessionFileName,
}: UseAiAssistantUpdatedDataOptions) {
	const publishAiSyncEvent = useCallback(
		(extra: Record<string, unknown> = {}) => {
			publishSyncEvent({
				resource: "ai",
				campaignSlug:
					campaignSlug && campaignSlug !== "bestiary"
						? campaignSlug
						: undefined,
				sessionFileName: sessionFileName || undefined,
				...extra,
			});
		},
		[campaignSlug, publishSyncEvent, sessionFileName],
	);

	const applyUpdatedAiData = useCallback(
		(updated: unknown, options: ApplyUpdatedAiDataOptions = {}) => {
			const plan = buildAiUpdatedDataPlan({
				updated,
				entityTypes: options.entityTypes,
				generated: options.generated,
				historyEntry: options.historyEntry,
				activeCampaign,
				isBestiary,
				isCampaign,
				isEncounter,
				encounterId,
				fallbackSessionFileName,
			});
			if (!plan) return false;
			return executeAiUpdatedDataPlan({
				plan,
				onSetActiveCampaign: setActiveCampaign,
				onSetActiveSession: setActiveSession,
				onSetActiveEncounter: setActiveEncounter,
				onRequestCampaignReload: requestCampaignReload,
				onPublishSyncEvent: publishAiSyncEvent,
				onRefreshEntities: refreshEntities,
			});
		},
		[
			activeCampaign,
			encounterId,
			fallbackSessionFileName,
			isBestiary,
			isCampaign,
			isEncounter,
			publishAiSyncEvent,
			refreshEntities,
			requestCampaignReload,
			setActiveCampaign,
			setActiveEncounter,
			setActiveSession,
		],
	);

	return { applyUpdatedAiData };
}
