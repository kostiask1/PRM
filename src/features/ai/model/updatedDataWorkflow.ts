import type { AiHistoryEntry } from "../api/aiApi.ts";
import type { AiGeneratedContent } from "./operationContracts.ts";
import { getFirstChangedMonsterName } from "./aiResponseHelpers.ts";
import { getGeneratedEntityTypes } from "./historyWorkflow.ts";

export interface AiUpdatedDataSyncEvent extends Record<string, unknown> {
	resource?: "custom-bestiary";
	monsterName?: string;
	monsterSource?: "CUSTOM";
	sessionFileName?: string;
}

export interface AiUpdatedDataPlan {
	applied: boolean;
	activeCampaign: Record<string, unknown> | null;
	activeSession: Record<string, unknown> | null;
	activeEncounter: Record<string, unknown> | null;
	requestCampaignReload: boolean;
	syncEvent: AiUpdatedDataSyncEvent;
	refreshEntities: boolean;
}

export interface BuildAiUpdatedDataPlanOptions {
	updated: unknown;
	entityTypes?: unknown;
	generated?: AiGeneratedContent | null;
	historyEntry?: AiHistoryEntry | null;
	activeCampaign?: unknown;
	isBestiary: boolean;
	isCampaign: boolean;
	isEncounter: boolean;
	encounterId?: string | number | null;
	fallbackSessionFileName?: string;
}

export interface ExecuteAiUpdatedDataPlanOptions {
	plan: AiUpdatedDataPlan;
	onSetActiveCampaign(campaign: Record<string, unknown>): void;
	onSetActiveSession(session: Record<string, unknown>): void;
	onSetActiveEncounter(encounter: Record<string, unknown>): void;
	onRequestCampaignReload(): void;
	onPublishSyncEvent(event: AiUpdatedDataSyncEvent): void;
	onRefreshEntities(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

function resolveEntityTypes(
	entityTypes: unknown,
	generated: AiGeneratedContent | null | undefined,
	historyEntry: AiHistoryEntry | null | undefined,
): string[] {
	if (Array.isArray(entityTypes)) {
		return entityTypes.filter((type): type is string => typeof type === "string");
	}
	return getGeneratedEntityTypes(generated, historyEntry || null);
}

function getGeneratedMonsterName(
	generated: AiGeneratedContent | null | undefined,
): string | null {
	const monsters = generated?.monsters;
	if (!Array.isArray(monsters) || !isRecord(monsters[0])) return null;
	return typeof monsters[0].name === "string" ? monsters[0].name : null;
}

function buildBestiaryPlan(
	options: BuildAiUpdatedDataPlanOptions,
): AiUpdatedDataPlan {
	const monsterName =
		getFirstChangedMonsterName(options.historyEntry) ||
		getGeneratedMonsterName(options.generated);
	return {
		applied: true,
		activeCampaign: null,
		activeSession: null,
		activeEncounter: null,
		requestCampaignReload: false,
		syncEvent: {
			resource: "custom-bestiary",
			...(monsterName ? { monsterName } : {}),
			monsterSource: "CUSTOM",
		},
		refreshEntities: true,
	};
}

function findActiveEncounter(
	updated: Record<string, unknown>,
	isEncounter: boolean,
	encounterId: string | number | null | undefined,
): Record<string, unknown> | null {
	if (!isEncounter || !isRecord(updated.data)) return null;
	const encounters = updated.data.encounters;
	if (!Array.isArray(encounters)) return null;
	return (
		encounters.find(
			(encounter) =>
				isRecord(encounter) &&
				String(encounter.id) === String(encounterId),
		) || null
	);
}

function getSessionFileName(
	updated: Record<string, unknown>,
	fallback: string | undefined,
): string | undefined {
	if (typeof updated.fileName === "string" && updated.fileName) {
		return updated.fileName;
	}
	if (typeof updated.file_name === "string" && updated.file_name) {
		return updated.file_name;
	}
	return fallback;
}

function buildSessionPlan(
	updated: Record<string, unknown>,
	options: BuildAiUpdatedDataPlanOptions,
	refreshEntities: boolean,
): AiUpdatedDataPlan {
	const sessionFileName = getSessionFileName(
		updated,
		options.fallbackSessionFileName,
	);
	return {
		applied: true,
		activeCampaign: null,
		activeSession: updated,
		activeEncounter: findActiveEncounter(
			updated,
			options.isEncounter,
			options.encounterId,
		),
		requestCampaignReload: true,
		syncEvent: sessionFileName ? { sessionFileName } : {},
		refreshEntities,
	};
}

function buildCampaignPlan(
	updated: Record<string, unknown>,
	activeCampaign: unknown,
	refreshEntities: boolean,
): AiUpdatedDataPlan {
	return {
		applied: true,
		activeCampaign: {
			...(isRecord(activeCampaign) ? activeCampaign : {}),
			...updated,
		},
		activeSession: null,
		activeEncounter: null,
		requestCampaignReload: true,
		syncEvent: {},
		refreshEntities,
	};
}

function buildReloadPlan(refreshEntities: boolean): AiUpdatedDataPlan {
	return {
		applied: false,
		activeCampaign: null,
		activeSession: null,
		activeEncounter: null,
		requestCampaignReload: true,
		syncEvent: {},
		refreshEntities,
	};
}

export function buildAiUpdatedDataPlan(
	options: BuildAiUpdatedDataPlanOptions,
): AiUpdatedDataPlan | null {
	if (!isRecord(options.updated)) return null;
	const entityTypes = resolveEntityTypes(
		options.entityTypes,
		options.generated,
		options.historyEntry,
	);
	const refreshEntities = entityTypes.length > 0;
	if (options.isBestiary) return buildBestiaryPlan(options);
	if (isRecord(options.updated.data)) {
		return buildSessionPlan(options.updated, options, refreshEntities);
	}
	if (options.isCampaign) {
		return buildCampaignPlan(
			options.updated,
			options.activeCampaign,
			refreshEntities,
		);
	}
	return buildReloadPlan(refreshEntities);
}

export function executeAiUpdatedDataPlan({
	plan,
	onSetActiveCampaign,
	onSetActiveSession,
	onSetActiveEncounter,
	onRequestCampaignReload,
	onPublishSyncEvent,
	onRefreshEntities,
}: ExecuteAiUpdatedDataPlanOptions): boolean {
	if (plan.activeSession) onSetActiveSession(plan.activeSession);
	if (plan.activeEncounter) onSetActiveEncounter(plan.activeEncounter);
	if (plan.activeCampaign) onSetActiveCampaign(plan.activeCampaign);
	if (plan.requestCampaignReload) onRequestCampaignReload();
	onPublishSyncEvent(plan.syncEvent);
	if (plan.refreshEntities) onRefreshEntities();
	return plan.applied;
}
