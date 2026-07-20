import type {
	AiGenerationResult,
	AiHistoryEntry,
} from "../api/aiApi.ts";
import type { AiGeneratedContent } from "./operationContracts.ts";
import {
	getGeneratedEntityTypes,
	hasGeneratedCampaignChanges,
} from "./historyWorkflow.ts";

export type AiGenerationNotification =
	| "draft-created"
	| "custom-creatures-saved"
	| "changes-applied";

export interface BuildAiGeneratedResultPlanOptions {
	data: AiGenerationResult | null | undefined;
	requestType: string | null;
	shouldParseResponse: boolean;
	isBestiary: boolean;
	isCampaign: boolean;
	isEncounter: boolean;
	clearPromptOnApplied?: boolean;
	createPromptHistoryEntry?: (prompt: string) => AiHistoryEntry;
}

export type AiGeneratedResultPlan =
	| { kind: "none" }
	| { kind: "prompt"; historyEntry: AiHistoryEntry }
	| {
			kind: "draft";
			historyEntry: AiHistoryEntry;
			notification: "draft-created";
			closeAuxiliaryDialogs: boolean;
	  }
	| {
			kind: "updated";
			historyEntry: AiHistoryEntry | null;
			updated: Record<string, unknown>;
			generated: AiGeneratedContent | null;
			entityTypes: string[];
			applyDirectly: boolean;
			requestCampaignReload: boolean;
			clearPrompt: boolean;
			refreshEntities: boolean;
			closeAssistantDialogs: boolean;
			notification: "custom-creatures-saved" | "changes-applied";
	  };

type UpdatedResultPlan = Extract<AiGeneratedResultPlan, { kind: "updated" }>;

interface UpdatedPlanAnalysis {
	historyEntry: AiHistoryEntry | null;
	generated: AiGeneratedContent | null;
	updatedIsSessionLike: boolean;
	applyDirectly: boolean;
	entityTypes: string[];
	hasCampaignChanges: boolean;
}

export interface ExecuteAiGeneratedResultPlanOptions {
	plan: AiGeneratedResultPlan;
	onHistoryEntry(entry: AiHistoryEntry): void;
	onShowPrompt(entry: AiHistoryEntry): void;
	onNotification(notification: AiGenerationNotification): void;
	onApplyUpdated(plan: UpdatedResultPlan): void;
	onCampaignReload(): void;
	onClearPrompt(): void;
	onRefreshEntities(): void;
	onCloseAuxiliaryDialogs(): void;
	onCloseAssistantDialogs(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function createTransientAiHistoryEntry(
	prompt: string,
	now: () => number = Date.now,
	random: () => number = Math.random,
): AiHistoryEntry {
	const timestamp = now();
	return {
		id: `${timestamp}-${random().toString(36).slice(2)}`,
		text: prompt,
		createdAt: new Date(timestamp).toISOString(),
	};
}

function isSessionLike(updated: Record<string, unknown>): boolean {
	return isRecord(updated.data);
}

function canApplyUpdatedDataDirectly(
	isBestiary: boolean,
	isCampaign: boolean,
	updatedIsSessionLike: boolean,
): boolean {
	return (
		isBestiary ||
		(isCampaign && !updatedIsSessionLike) ||
		(!isCampaign && updatedIsSessionLike)
	);
}

function shouldCloseDialogs(
	shouldParseResponse: boolean,
	isEncounter: boolean,
	isBestiary: boolean,
): boolean {
	if (shouldParseResponse) return true;
	if (isEncounter) return true;
	return isBestiary;
}

function buildPromptPlan(
	data: AiGenerationResult,
	createPromptHistoryEntry: (prompt: string) => AiHistoryEntry,
): Extract<AiGeneratedResultPlan, { kind: "prompt" }> | null {
	if (!data.prompt) return null;
	return {
		kind: "prompt",
		historyEntry: data.aiResponse || createPromptHistoryEntry(data.prompt),
	};
}

function buildDraftPlan(
	data: AiGenerationResult,
	closeAuxiliaryDialogs: boolean,
): Extract<AiGeneratedResultPlan, { kind: "draft" }> | null {
	if (!data.draft || !data.aiResponse) return null;
	return {
		kind: "draft",
		historyEntry: data.aiResponse,
		notification: "draft-created",
		closeAuxiliaryDialogs,
	};
}

function shouldRequestCampaignReload(
	applyDirectly: boolean,
	updatedIsSessionLike: boolean,
	hasCampaignChanges: boolean,
): boolean {
	if (!applyDirectly) return true;
	return updatedIsSessionLike && hasCampaignChanges;
}

function getUpdatedPlanGeneratedContent(
	data: AiGenerationResult,
): AiGeneratedContent | null {
	return isRecord(data.generated)
		? (data.generated as AiGeneratedContent)
		: null;
}

function analyzeUpdatedPlan(
	data: AiGenerationResult & { updated: Record<string, unknown> },
	options: Pick<
		BuildAiGeneratedResultPlanOptions,
		"isBestiary" | "isCampaign"
	>,
): UpdatedPlanAnalysis {
	const historyEntry = data.aiResponse || null;
	const generated = getUpdatedPlanGeneratedContent(data);
	const updatedIsSessionLike = isSessionLike(data.updated);
	const applyDirectly = canApplyUpdatedDataDirectly(
		options.isBestiary,
		options.isCampaign,
		updatedIsSessionLike,
	);
	return {
		historyEntry,
		generated,
		updatedIsSessionLike,
		applyDirectly,
		entityTypes: getGeneratedEntityTypes(generated, historyEntry),
		hasCampaignChanges: hasGeneratedCampaignChanges(generated, historyEntry),
	};
}

function shouldClearAppliedPrompt(value: boolean | undefined): boolean {
	return value ?? true;
}

function shouldRefreshUpdatedEntities(
	applyDirectly: boolean,
	entityTypes: string[],
): boolean {
	return !applyDirectly && entityTypes.length > 0;
}

function getUpdatedNotification(
	requestType: string | null,
): UpdatedResultPlan["notification"] {
	return requestType === "custom-monster"
		? "custom-creatures-saved"
		: "changes-applied";
}

function buildUpdatedPlan(
	data: AiGenerationResult & { updated: Record<string, unknown> },
	options: Omit<
		BuildAiGeneratedResultPlanOptions,
		"data" | "createPromptHistoryEntry"
	>,
	closeAssistantDialogs: boolean,
): UpdatedResultPlan {
	const analysis = analyzeUpdatedPlan(data, options);

	return {
		kind: "updated",
		historyEntry: analysis.historyEntry,
		updated: data.updated,
		generated: analysis.generated,
		entityTypes: analysis.entityTypes,
		applyDirectly: analysis.applyDirectly,
		requestCampaignReload: shouldRequestCampaignReload(
			analysis.applyDirectly,
			analysis.updatedIsSessionLike,
			analysis.hasCampaignChanges,
		),
		clearPrompt: shouldClearAppliedPrompt(options.clearPromptOnApplied),
		refreshEntities: shouldRefreshUpdatedEntities(
			analysis.applyDirectly,
			analysis.entityTypes,
		),
		closeAssistantDialogs,
		notification: getUpdatedNotification(options.requestType),
	};
}

export function buildAiGeneratedResultPlan({
	data,
	requestType,
	shouldParseResponse,
	isBestiary,
	isCampaign,
	isEncounter,
	clearPromptOnApplied = true,
	createPromptHistoryEntry = createTransientAiHistoryEntry,
}: BuildAiGeneratedResultPlanOptions): AiGeneratedResultPlan {
	if (!data) return { kind: "none" };

	const promptPlan = buildPromptPlan(data, createPromptHistoryEntry);
	if (promptPlan) return promptPlan;

	const closeDialogs = shouldCloseDialogs(
		shouldParseResponse,
		isEncounter,
		isBestiary,
	);
	const draftPlan = buildDraftPlan(data, closeDialogs);
	if (draftPlan) return draftPlan;

	if (!isRecord(data.updated)) return { kind: "none" };
	return buildUpdatedPlan(
		{ ...data, updated: data.updated },
		{
			requestType,
			shouldParseResponse,
			isBestiary,
			isCampaign,
			isEncounter,
			clearPromptOnApplied,
		},
		closeDialogs,
	);
}

function executeUpdatedPersistenceEffects(
	plan: UpdatedResultPlan,
	actions: ExecuteAiGeneratedResultPlanOptions,
): void {
	if (plan.historyEntry) actions.onHistoryEntry(plan.historyEntry);
	if (plan.applyDirectly) actions.onApplyUpdated(plan);
	if (plan.requestCampaignReload) actions.onCampaignReload();
}

function executeUpdatedPresentationEffects(
	plan: UpdatedResultPlan,
	actions: ExecuteAiGeneratedResultPlanOptions,
): void {
	if (plan.clearPrompt) actions.onClearPrompt();
	actions.onNotification(plan.notification);
	if (plan.refreshEntities) actions.onRefreshEntities();
	if (plan.closeAssistantDialogs) actions.onCloseAssistantDialogs();
}

function executeUpdatedPlan(
	plan: UpdatedResultPlan,
	actions: ExecuteAiGeneratedResultPlanOptions,
): void {
	executeUpdatedPersistenceEffects(plan, actions);
	executeUpdatedPresentationEffects(plan, actions);
}

export function executeAiGeneratedResultPlan(
	options: ExecuteAiGeneratedResultPlanOptions,
): void {
	const { plan } = options;
	if (plan.kind === "none") return;
	if (plan.kind === "prompt") {
		options.onHistoryEntry(plan.historyEntry);
		options.onShowPrompt(plan.historyEntry);
		return;
	}
	if (plan.kind === "draft") {
		options.onHistoryEntry(plan.historyEntry);
		options.onShowPrompt(plan.historyEntry);
		options.onNotification(plan.notification);
		if (plan.closeAuxiliaryDialogs) options.onCloseAuxiliaryDialogs();
		return;
	}
	executeUpdatedPlan(plan, options);
}
