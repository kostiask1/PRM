import { useState } from "react";
import { resolveEncounterHpInputValue } from "./encounterPagePresentation.ts";
import type { EncounterViewParticipant } from "./contracts.ts";

interface Options {
	getInstanceId(monster: EncounterViewParticipant): string;
	onUpdate(instanceId: string, currentHp: number): void;
}

export function useEncounterHpEditing({ getInstanceId, onUpdate }: Options) {
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const onChange = (instanceId: string, value: string) => {
		setDrafts((current) => ({ ...current, [instanceId]: value }));
	};
	const onBlur = (monster: EncounterViewParticipant) => {
		const instanceId = getInstanceId(monster);
		const draftValue = drafts[instanceId];
		if (draftValue === undefined) return;
		onUpdate(instanceId, resolveEncounterHpInputValue(draftValue, monster.currentHp));
		setDrafts((current) => {
			const next = { ...current };
			delete next[instanceId];
			return next;
		});
	};
	return { drafts, onChange, onBlur };
}
