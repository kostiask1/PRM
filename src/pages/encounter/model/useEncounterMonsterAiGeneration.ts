import type { MutableRefObject } from "react";
import type { aiApi, AiHistoryEntry } from "../../../features/ai/index.js";
import {
	buildMonsterAiRequestPayload,
	executeMonsterAiRequest,
	getMonsterAiGenerationPlan,
	type MonsterAiEditMode,
} from "../../../features/ai-edit-monster/index.js";
import { applyEncounterGeneratedMonsterResult } from "./encounterPagePresentation.ts";
import type { EncounterViewParticipant } from "./contracts.ts";

type AiGenerationApi = Pick<typeof aiApi, "generateAi">;

interface Options {
	api: AiGenerationApi;
	controllerRef: MutableRefObject<AbortController | null>;
	campaignSlug: string;
	sessionId: string;
	encounterId?: string | number;
	language: string;
	targetInstanceId: string | null;
	monster: EncounterViewParticipant | null;
	mode: MonsterAiEditMode;
	instructions: string;
	selectedModel: string;
	translate(value: string): string;
	onDraftMode(mode: "local" | "global"): void;
	onDraftEntry(entry: AiHistoryEntry | null): void;
	onMonsterUpdate(instanceId: string, monster: EncounterViewParticipant): void;
	onError(message: string): void;
	onStart(): void;
	onSuccess(): void;
	onComplete(): void;
}

export function useEncounterMonsterAiGeneration(options: Options) {
	const cancel = () => {
		options.controllerRef.current?.abort();
	};

	const save = async () => {
		if (!options.monster?.name) return;
		const plan = getMonsterAiGenerationPlan(
			options.mode,
			options.instructions,
			options.monster,
			options.translate,
		);
		if (plan.validationError) {
			options.onError(plan.validationError);
			return;
		}

		options.onStart();
		const controller = new AbortController();
		options.controllerRef.current = controller;
		await executeMonsterAiRequest(controller, {
			request: (signal) => options.api.generateAi(
				buildMonsterAiRequestPayload({
					plan,
					modelName: options.selectedModel,
					campaignSlug: options.campaignSlug,
					sessionId: options.sessionId,
					encounterId: options.encounterId,
					monster: options.monster as EncounterViewParticipant,
					targetInstanceId: options.targetInstanceId,
					language: options.language,
				}),
				{ signal },
			),
			onResult: (data) => {
				applyEncounterGeneratedMonsterResult(
					data,
					options.monster as EncounterViewParticipant,
					plan.draftMode,
					options.targetInstanceId,
					{
						onDraftMode: options.onDraftMode,
						onDraftEntry: options.onDraftEntry,
						onMonsterUpdate: options.onMonsterUpdate,
					},
				);
				options.onSuccess();
			},
			onError: options.onError,
			onComplete: () => {
				if (options.controllerRef.current === controller) {
					options.controllerRef.current = null;
				}
				options.onComplete();
			},
		});
	};

	return { cancel, save };
}
