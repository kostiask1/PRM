import { useState } from "react";
import type {
	aiApi,
	AiHistoryEntry,
	AiHistoryResource,
} from "../../../features/ai/index.js";
import {
	applyMonsterAiDraftSaveResult,
	getMonsterAiDraftSavePlan,
	getMonsterAiRestoreRequestPlan,
} from "../../../features/ai-edit-monster/index.js";
import {
	applyEncounterMonsterRestoreResult,
	executeEncounterAiRestoreRequest,
} from "./encounterPagePresentation.ts";
import type {
	EncounterViewParticipant,
	EncounterViewSession,
} from "./contracts.ts";

type AiHistoryApi = Pick<
	typeof aiApi,
	"applyAiResponse" | "undoAiResponse" | "updateAiResponse"
>;
type DraftMode = "local" | "global";
type RestoreMode = "apply" | "undo";
type RestoreOptions = { resourceIds?: string[] };

interface Options {
	api: AiHistoryApi;
	campaignSlug: string;
	targetInstanceId: string | null;
	onLocalUpdate(session: EncounterViewSession): void;
	onMonsterUpdate(
		instanceId: string,
		monster: EncounterViewParticipant,
	): void;
	onError(error: unknown): void;
}

export function useEncounterMonsterAiDraft(options: Options) {
	const [entry, setEntry] = useState<AiHistoryEntry | null>(null);
	const [mode, setMode] = useState<DraftMode>("global");
	const [isRestoring, setIsRestoring] = useState(false);

	const save = async (
		resources: Array<Pick<AiHistoryResource, "id" | "after">>,
	) => {
		const plan = getMonsterAiDraftSavePlan(
			entry?.id,
			mode,
			options.campaignSlug,
			resources,
		);
		if (!plan) return null;
		const updatedEntry = await options.api.updateAiResponse(
			plan.scope,
			plan.entryId,
			{ resources: plan.resources },
		);
		return applyMonsterAiDraftSaveResult(plan, updatedEntry, setEntry);
	};

	const restore = async (
		draftEntry: AiHistoryEntry | null = entry,
		restoreMode: RestoreMode = "apply",
		restoreOptions: RestoreOptions = {},
	) => {
		const plan = getMonsterAiRestoreRequestPlan(
			draftEntry?.id,
			isRestoring,
			mode,
			options.campaignSlug,
			restoreMode,
			restoreOptions.resourceIds,
		);
		if (!plan || !draftEntry) return;
		setIsRestoring(true);
		const restoreRequest = {
			apply: options.api.applyAiResponse,
			undo: options.api.undoAiResponse,
		}[plan.action];
		await executeEncounterAiRestoreRequest({
			request: () => restoreRequest(
				plan.scope,
				plan.entryId,
				{ resourceIds: plan.resourceIds },
			),
			onResult: (result) => applyEncounterMonsterRestoreResult(
				result,
				draftEntry,
				mode,
				plan.action,
				plan.resourceIds,
				options.targetInstanceId,
				{
					onEntry: setEntry,
					onLocalUpdate: options.onLocalUpdate,
					onMonsterUpdate: options.onMonsterUpdate,
				},
			),
			onError: options.onError,
			onComplete: () => setIsRestoring(false),
		});
	};

	const close = () => {
		if (isRestoring) return;
		setEntry(null);
		setMode("global");
	};

	return {
		entry,
		mode,
		isRestoring,
		setEntry,
		setMode,
		save,
		restore,
		close,
	};
}
