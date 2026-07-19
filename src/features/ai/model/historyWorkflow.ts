import type {
	AiGenerationResult,
	AiGenerationPayload,
	AiHistoryId,
	AiHistoryEntry,
	AiHistoryResource,
} from "../api/aiApi.ts";
import type { AiGeneratedContent } from "./operationContracts.ts";

type GeneratedContent = AiGeneratedContent | null | undefined;

export interface AiHistoryRetryPlan {
	entryId: AiHistoryId;
	retryPayload: AiGenerationPayload;
	requestType: string | null;
	shouldParseResponse: boolean;
	deleteFailedEntry: {
		campaign: string;
		id: AiHistoryId;
	} | null;
}

export type AiHistoryRetryOutcome =
	| { status: "succeeded"; data: AiGenerationResult | null }
	| { status: "cancelled" }
	| { status: "failed"; error: unknown };

export interface ExecuteAiHistoryRetryOptions {
	plan: AiHistoryRetryPlan;
	signal: AbortSignal;
	deleteAiResponse(
		campaign: string,
		id: AiHistoryId,
	): Promise<AiHistoryEntry[] | null>;
	generateAi(
		payload: AiGenerationPayload,
		options: { signal: AbortSignal },
	): Promise<AiGenerationResult | null>;
	onFailedEntryDeleted?(responses: AiHistoryEntry[]): void;
	onSucceeded?(data: AiGenerationResult | null): void;
	onCancelled?(): void;
	onFailed?(error: unknown): void;
}

export interface AiHistoryRetryFailure {
	historyEntry: AiHistoryEntry | null;
	message: string;
	status: string | number | null;
	alertMessage: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

function getRecordField(
	record: Record<string, unknown> | null,
	key: string,
): Record<string, unknown> | null {
	return record ? asRecord(record[key]) : null;
}

function getRetryFailureHistoryEntry(
	record: Record<string, unknown> | null,
): AiHistoryEntry | null {
	const data = getRecordField(record, "data");
	const entry = getRecordField(data, "aiResponse");
	return entry && entry.id !== undefined ? (entry as AiHistoryEntry) : null;
}

function getStringField(
	record: Record<string, unknown> | null,
	key: string,
): string {
	const value = record ? record[key] : undefined;
	return typeof value === "string" ? value : "";
}

function getRetryFailureStatus(
	record: Record<string, unknown> | null,
): string | number | null {
	const status = record ? record.status : undefined;
	return typeof status === "string" || typeof status === "number"
		? status
		: null;
}

function formatRetryFailureAlert(
	status: string | number | null,
	statusLabel: string,
	message: string,
): string {
	return status === null ? message : `[${statusLabel}: ${status}] ${message}`;
}

export function getAiHistoryRetryFailure(
	error: unknown,
	statusLabel: string,
): AiHistoryRetryFailure {
	const record = asRecord(error);
	const message = getStringField(record, "message");
	const status = getRetryFailureStatus(record);
	return {
		historyEntry: getRetryFailureHistoryEntry(record),
		message,
		status,
		alertMessage: formatRetryFailureAlert(status, statusLabel, message),
	};
}

export function getHistoryChangeResources(
	entry: AiHistoryEntry | null | undefined,
): AiHistoryResource[] {
	return Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
}

export function getHistoryChangedEntityTypes(
	entry: AiHistoryEntry | null | undefined,
): string[] {
	return [
		...new Set(
			getHistoryChangeResources(entry)
				.filter((resource) => resource.kind === "entity" && resource.type)
				.map((resource) => resource.type as string),
		),
	];
}

export function getGeneratedEntityTypes(
	generated: GeneratedContent,
	historyEntry: AiHistoryEntry | null = null,
): string[] {
	const types: string[] = [];
	if (Array.isArray(generated?.characters)) types.push("characters");
	if (Array.isArray(generated?.npcs)) types.push("npc");
	if (Array.isArray(generated?.locations)) types.push("locations");
	return types.length > 0 ? types : getHistoryChangedEntityTypes(historyEntry);
}

export function hasGeneratedCampaignChanges(
	generated: GeneratedContent,
	historyEntry: AiHistoryEntry | null = null,
): boolean {
	const operations = generated?.operations || [];
	if (
		operations.some(
			(operation) =>
				operation.entity === "campaign" ||
				operation.scope === "campaign" ||
				(operation.op === "moveScope" &&
					(operation.to === "campaign" || operation.from === "campaign")),
		)
	) {
		return true;
	}
	return getHistoryChangeResources(historyEntry).some(
		(resource) => resource.kind === "campaign",
	);
}

export function hasHistoryChanges(entry: AiHistoryEntry | null | undefined) {
	return getHistoryChangeResources(entry).length > 0;
}

export function isFailedHistoryEntry(entry: AiHistoryEntry | null | undefined) {
	return entry?.status === "failed";
}

export function isNonParsedHistoryEntry(entry: AiHistoryEntry | null | undefined) {
	return entry?.request?.options?.responseParsing === false;
}

const firstTruthy = (...values: unknown[]): unknown =>
	values.find((value) => Boolean(value));

function buildNonParsedRetryPayload(
	entry: AiHistoryEntry,
	getRequestText: (entry: AiHistoryEntry) => string,
): AiGenerationPayload | null {
	const options = Object.assign({}, entry.request?.options);
	const path = Object.assign({}, entry.path);
	if (!path.campaign) return null;
	return {
		type: firstTruthy(entry.type, options.mode) ?? null,
		modelName: firstTruthy(entry.modelName, options.modelName),
		userInstructions: getRequestText(entry),
		path,
		sceneId: firstTruthy(options.sceneId),
		imageTarget: firstTruthy(options.imageTarget),
		parseAIResponse: false,
		generateCharacters: Boolean(options.characterGeneration),
		generateNpcs: Boolean(options.npcGeneration),
		generateLocations: Boolean(options.locationGeneration),
		generateEncounters: false,
		generateCustomMonsters: false,
		contextConfig: null,
		language: firstTruthy(entry.language),
	};
}

export function buildRetryPayloadFromHistoryEntry(
	entry: AiHistoryEntry | null | undefined,
	getRequestText: (entry: AiHistoryEntry) => string,
): AiGenerationPayload | null {
	if (entry?.retryPayload && typeof entry.retryPayload === "object") {
		return entry.retryPayload;
	}
	if (!entry || !isNonParsedHistoryEntry(entry)) return null;
	return buildNonParsedRetryPayload(entry, getRequestText);
}

export function createAiHistoryWorkflow(
	getRequestText: (entry: AiHistoryEntry) => string,
) {
	if (typeof getRequestText !== "function") {
		throw new TypeError("getRequestText must be a function");
	}
	const buildRetryPayload = (entry: AiHistoryEntry) =>
		buildRetryPayloadFromHistoryEntry(entry, getRequestText);
	const canRetryHistoryEntry = (entry: AiHistoryEntry) => {
		if (isFailedHistoryEntry(entry)) return Boolean(entry.retryPayload);
		if (isNonParsedHistoryEntry(entry)) return Boolean(buildRetryPayload(entry));
		return false;
	};
	return {
		buildRetryPayloadFromHistoryEntry: buildRetryPayload,
		canRetryHistoryEntry,
		buildRetryPlan(
			entry: AiHistoryEntry,
			{
				isLoading = false,
				isBestiary = false,
				historyCampaign = "",
			}: {
				isLoading?: boolean;
				isBestiary?: boolean;
				historyCampaign?: string;
			} = {},
		): AiHistoryRetryPlan | null {
			if (isLoading || !canRetryHistoryEntry(entry)) return null;
			const retryPayload = buildRetryPayload(entry);
			return retryPayload
				? buildAiHistoryRetryPlan(entry, retryPayload, {
						isBestiary,
						historyCampaign,
					})
				: null;
		},
	};
}

function getRetryPayloadType(payload: AiGenerationPayload): string | null {
	return typeof payload.type === "string" ? payload.type : null;
}

function getRetryRequestType(
	payloadType: string | null,
	isBestiary: boolean,
): string | null {
	if (payloadType) return payloadType;
	return isBestiary ? "custom-monster" : null;
}

export function buildAiHistoryRetryPlan(
	entry: AiHistoryEntry,
	retryPayload: AiGenerationPayload,
	{
		isBestiary = false,
		historyCampaign = "",
	}: { isBestiary?: boolean; historyCampaign?: string } = {},
): AiHistoryRetryPlan {
	const payloadType = getRetryPayloadType(retryPayload);
	return {
		entryId: entry.id,
		retryPayload,
		requestType: getRetryRequestType(payloadType, isBestiary),
		shouldParseResponse:
			payloadType === "image" ? false : Boolean(retryPayload.parseAIResponse),
		deleteFailedEntry: isFailedHistoryEntry(entry)
			? {
					campaign: entry.path?.campaign || historyCampaign,
					id: entry.id,
				}
			: null,
	};
}

function isAbortError(error: unknown): boolean {
	return Boolean(
		error &&
			typeof error === "object" &&
			(error as { name?: unknown }).name === "AbortError",
	);
}

export async function executeAiHistoryRetry({
	plan,
	signal,
	deleteAiResponse,
	generateAi,
	onFailedEntryDeleted,
	onSucceeded,
	onCancelled,
	onFailed,
}: ExecuteAiHistoryRetryOptions): Promise<AiHistoryRetryOutcome> {
	try {
		if (plan.deleteFailedEntry) {
			const responses = await deleteAiResponse(
				plan.deleteFailedEntry.campaign,
				plan.deleteFailedEntry.id,
			);
			onFailedEntryDeleted?.(Array.isArray(responses) ? responses : []);
		}
		const data = await generateAi(plan.retryPayload, { signal });
		onSucceeded?.(data);
		return { status: "succeeded", data };
	} catch (error) {
		if (isAbortError(error)) {
			onCancelled?.();
			return { status: "cancelled" };
		}
		onFailed?.(error);
		return { status: "failed", error };
	}
}
