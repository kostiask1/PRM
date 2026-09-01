import type {
	AiHistoryEntry,
	AiHistoryId,
	AiHistoryRestoreResult,
} from "../api/aiApi.ts";
import { getHistoryChangedEntityTypes } from "./historyWorkflow.ts";

export type AiHistoryRestoreOperation = "apply" | "undo";

export interface AiHistoryRestoreMode {
	isUndo: boolean;
	isPartial: boolean;
	operation: AiHistoryRestoreOperation;
}

export interface AiRouteLocation {
	campaign?: string | null;
	session?: string | null;
	encounter?: AiHistoryId | null;
}

export type AiRestoredDataKind =
	| "invalid"
	| "bestiary"
	| "campaign"
	| "session";

export type AiRestoreRouteKind =
	| "bestiary"
	| "campaign"
	| "encounter"
	| "session";

interface AiRestoreCompatibilityContext {
	dataKind: AiRestoredDataKind;
	entryPath: NonNullable<AiHistoryEntry["path"]>;
	currentRoute: AiRouteLocation;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasIdentity = (value: unknown): boolean =>
	value !== null && value !== undefined && value !== "";

const identitiesMatch = (left: unknown, right: unknown): boolean =>
	hasIdentity(left) && hasIdentity(right) && String(left) === String(right);

function hasMatchingCampaign(
	context: AiRestoreCompatibilityContext,
): boolean {
	return identitiesMatch(
		context.entryPath.campaign,
		context.currentRoute.campaign,
	);
}

function hasMatchingSession(context: AiRestoreCompatibilityContext): boolean {
	return (
		hasMatchingCampaign(context) &&
		identitiesMatch(context.entryPath.session, context.currentRoute.session)
	);
}

function hasCompatibleEncounter(
	context: AiRestoreCompatibilityContext,
): boolean {
	return (
		!hasIdentity(context.entryPath.encounter) ||
		identitiesMatch(
			context.entryPath.encounter,
			context.currentRoute.encounter,
		)
	);
}

const RESTORE_COMPATIBILITY_POLICIES: Record<
	AiRestoreRouteKind,
	(context: AiRestoreCompatibilityContext) => boolean
> = {
	bestiary: (context) =>
		context.dataKind === "bestiary" && hasMatchingCampaign(context),
	campaign: (context) =>
		context.dataKind === "campaign" &&
		hasMatchingCampaign(context) &&
		!hasIdentity(context.entryPath.session),
	session: (context) =>
		context.dataKind === "session" &&
		hasMatchingSession(context) &&
		!hasIdentity(context.entryPath.encounter),
	encounter: (context) =>
		context.dataKind === "session" &&
		hasMatchingSession(context) &&
		hasCompatibleEncounter(context),
};

const RESTORED_DATA_KIND_POLICIES: ReadonlyArray<{
	kind: Exclude<AiRestoredDataKind, "campaign">;
	matches: (updated: Record<string, unknown>) => boolean;
}> = [
	{
		kind: "bestiary",
		matches: (updated) => Array.isArray(updated.monsters),
	},
	{
		kind: "invalid",
		matches: (updated) => updated.monsters !== undefined,
	},
	{
		kind: "session",
		matches: (updated) => isRecord(updated.data),
	},
	{
		kind: "invalid",
		matches: (updated) => updated.data !== undefined && updated.data !== null,
	},
];

export function getAiRestoredDataKind(updated: unknown): AiRestoredDataKind {
	if (!isRecord(updated)) return "invalid";
	return (
		RESTORED_DATA_KIND_POLICIES.find((policy) => policy.matches(updated))
			?.kind || "campaign"
	);
}

export function getAiRestoreRouteKind({
	isBestiary = false,
	isCampaign = false,
	currentRoute = {},
}: {
	isBestiary?: boolean;
	isCampaign?: boolean;
	currentRoute?: AiRouteLocation;
}): AiRestoreRouteKind {
	if (isBestiary) return "bestiary";
	if (isCampaign) return "campaign";
	return hasIdentity(currentRoute.encounter) ? "encounter" : "session";
}

export function upsertAiHistoryEntry(
	history: AiHistoryEntry[] | null | undefined,
	entry: AiHistoryEntry | null | undefined,
): AiHistoryEntry[] {
	if (!entry?.id) return Array.isArray(history) ? history : [];
	return [
		entry,
		...(Array.isArray(history) ? history : []).filter(
			(item) => item?.id !== entry.id,
		),
	];
}

export function getAiHistoryCampaign(
	entry: AiHistoryEntry | null | undefined,
	fallbackCampaign: string,
): string {
	return entry?.path?.campaign || fallbackCampaign;
}

export function getAiHistoryRestoreMode(
	mode: string,
	resourceIds?: string[],
): AiHistoryRestoreMode {
	const isUndo = mode === "undo";
	return {
		isUndo,
		isPartial: Array.isArray(resourceIds) && resourceIds.length > 0,
		operation: isUndo ? "undo" : "apply",
	};
}

export function canApplyRestoredAiDataDirectly({
	updated,
	entryPath = {},
	currentRoute = {},
	isBestiary = false,
	isCampaign = false,
}: {
	updated?: Record<string, unknown>;
	entryPath?: AiHistoryEntry["path"];
	currentRoute?: AiRouteLocation;
	isBestiary?: boolean;
	isCampaign?: boolean;
}): boolean {
	const dataKind = getAiRestoredDataKind(updated);
	if (dataKind === "invalid") return false;
	const routeKind = getAiRestoreRouteKind({
		isBestiary,
		isCampaign,
		currentRoute,
	});
	return RESTORE_COMPATIBILITY_POLICIES[routeKind]({
		dataKind,
		entryPath: entryPath || {},
		currentRoute,
	});
}

export function buildAiHistoryRestorePlan({
	result,
	fallbackEntry,
	selectedResponseId,
	currentRoute,
	isBestiary,
	isCampaign,
}: {
	result: AiHistoryRestoreResult;
	fallbackEntry: AiHistoryEntry;
	selectedResponseId?: AiHistoryId | null;
	currentRoute?: AiRouteLocation;
	isBestiary?: boolean;
	isCampaign?: boolean;
}) {
	const nextEntry = result.response || fallbackEntry;
	const historyUpdate = Array.isArray(result.responses)
		? { type: "replace" as const, responses: result.responses }
		: result.response
			? { type: "upsert" as const, entry: result.response }
			: null;
	const updated = result.updated;
	const applyDirectly = canApplyRestoredAiDataDirectly({
		updated,
		entryPath: nextEntry.path,
		currentRoute,
		isBestiary,
		isCampaign,
	});

	return {
		nextEntry,
		historyUpdate,
		updateSelection: Boolean(
			nextEntry.id && nextEntry.id === selectedResponseId,
		),
		updated,
		applyDirectly,
		entityTypes: getHistoryChangedEntityTypes(nextEntry),
		requestReload: !applyDirectly,
	};
}
