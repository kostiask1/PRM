import { useState } from "react";
import type {
	CampaignEntityRecord,
	CharacterData,
} from "../../../entities/campaign/index.js";
import {
	buildCreateEntityPayload,
	createCampaignEntity,
} from "../../../features/campaign-entity/index.js";
import type { EncounterPageMessage } from "./EncounterPageRuntime.tsx";
import {
	createEmptyEncounterCharacterDraft,
	executeEncounterPlayerCreation,
} from "./encounterPagePresentation.ts";

type PlayerDraft = CharacterData & { firstName: string };

const DEFAULTS: Record<string, unknown> = {
	firstName: "", lastName: "", race: "", class: "", level: 1,
	motivation: "", description: "", trait: "", notes: [],
	collapsed: false, isNotesCollapsed: false,
};

interface Options {
	campaignSlug: string;
	onAdd(character: CampaignEntityRecord): void;
	onClosePicker(): void;
	refreshEntities(): void;
	showMessage(message: EncounterPageMessage): void;
	messages: { errorTitle: string; missingName: string; failedCreation: string };
}

export function useEncounterPlayerCreation(options: Options) {
	const [creating, setCreating] = useState(false);
	const [draft, setDraft] = useState<PlayerDraft>(() =>
		createEmptyEncounterCharacterDraft() as PlayerDraft,
	);
	const [submitting, setSubmitting] = useState(false);
	const reset = () => { setCreating(false); setDraft(createEmptyEncounterCharacterDraft() as PlayerDraft); };
	const closePicker = () => { if (submitting) return; reset(); options.onClosePicker(); };
	const start = () => { setDraft(createEmptyEncounterCharacterDraft() as PlayerDraft); setCreating(true); };
	const submit = async () => {
		if (!draft.firstName?.trim()) {
			options.showMessage({ title: options.messages.errorTitle, message: options.messages.missingName });
			return;
		}
		const payload = buildCreateEntityPayload(DEFAULTS, draft);
		setSubmitting(true);
		await executeEncounterPlayerCreation({
			request: () => createCampaignEntity(options.campaignSlug, "characters", payload as CampaignEntityRecord),
			onRefresh: options.refreshEntities,
			onAdd: options.onAdd,
			onReset: reset,
			onError: (error) => {
				console.error("Failed to create player from encounter", error);
				options.showMessage({ title: options.messages.errorTitle, message: options.messages.failedCreation });
			},
			onComplete: () => setSubmitting(false),
		});
	};
	return { creating, draft, submitting, closePicker, reset, setDraft, start, submit };
}
