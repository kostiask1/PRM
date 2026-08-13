import type { Dispatch, SetStateAction } from "react";

import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import {
	cloneSnapshot,
	getEncounterParticipantEntries,
	hasOwn,
	isObjectSnapshot,
	isResourceApplied,
	type PreviewResource,
	type SnapshotRecord,
} from "../model/aiResponseModal.ts";

export interface CreatureEditState {
	resource: PreviewResource;
	monster: BestiaryMonster;
	mode?: "encounter-participant";
	participantKey?: string;
}

export interface CreatureEditOptions {
	mode?: "encounter-participant";
	participantKey?: string;
}

interface AiResponseCreatureFieldEditingOptions {
	fieldEditingCreature: CreatureEditState | null;
	setFieldEditingCreature: Dispatch<SetStateAction<CreatureEditState | null>>;
	isDraft: boolean | undefined;
	resolvePreviewResource: (resource: PreviewResource) => PreviewResource;
	updateDraftResourceAfter: (
		resource: PreviewResource,
		nextSnapshot: unknown,
	) => void;
	toBestiaryMonster: (snapshot: SnapshotRecord) => BestiaryMonster;
}

export interface AiResponseCreatureFieldEditing {
	closeCreatureFieldEdit: () => void;
	openCreatureFieldEdit: (
		resource: PreviewResource,
		monster: unknown,
		options?: CreatureEditOptions,
	) => void;
	saveCreatureFieldEdit: (draftMonster: BestiaryMonster) => void;
}

function preserveCreatureIdentity(
	original: BestiaryMonster,
	parsed: BestiaryMonster,
): BestiaryMonster {
	const next = { ...parsed };
	["id", "instanceId", "participantType"].forEach((key) => {
		if (!hasOwn(next, key) && original?.[key] !== undefined) {
			next[key] = original[key];
		}
	});
	return next;
}

function replaceEncounterParticipant(
	encounter: unknown,
	participantKey: string,
	nextMonster: BestiaryMonster,
): SnapshotRecord {
	const nextEncounter = cloneSnapshot(
		isObjectSnapshot(encounter) ? encounter : {},
	);
	nextEncounter.monsters = getEncounterParticipantEntries(
		nextEncounter.monsters,
	).map((entry) =>
		entry.key === participantKey ? nextMonster : entry.participant,
	);
	return nextEncounter;
}

interface SavedCreatureFieldEdit {
	fieldEditingCreature: CreatureEditState;
	nextMonster: BestiaryMonster;
}

function getSavedCreatureFieldEdit(
	fieldEditingCreature: CreatureEditState | null,
	draftMonster: BestiaryMonster,
): SavedCreatureFieldEdit | null {
	if (!fieldEditingCreature?.resource || !isObjectSnapshot(draftMonster)) {
		return null;
	}
	return {
		fieldEditingCreature,
		nextMonster: preserveCreatureIdentity(fieldEditingCreature.monster, draftMonster),
	};
}

function updateSavedCreatureFieldEdit({
	fieldEditingCreature,
	resolvePreviewResource,
	updateDraftResourceAfter,
	nextMonster,
}: Pick<
	AiResponseCreatureFieldEditingOptions,
	"resolvePreviewResource" | "updateDraftResourceAfter"
> & {
	fieldEditingCreature: CreatureEditState;
	nextMonster: BestiaryMonster;
}): void {
	if (
		fieldEditingCreature.mode === "encounter-participant" &&
		fieldEditingCreature.participantKey
	) {
		const editedResource = resolvePreviewResource(fieldEditingCreature.resource);
		updateDraftResourceAfter(
			editedResource,
			replaceEncounterParticipant(
				editedResource.after,
				fieldEditingCreature.participantKey,
				nextMonster,
			),
		);
		return;
	}
	updateDraftResourceAfter(fieldEditingCreature.resource, nextMonster);
}

export function createAiResponseCreatureFieldEditing({
	fieldEditingCreature,
	setFieldEditingCreature,
	isDraft,
	resolvePreviewResource,
	updateDraftResourceAfter,
	toBestiaryMonster,
}: AiResponseCreatureFieldEditingOptions): AiResponseCreatureFieldEditing {
	const openCreatureFieldEdit = (
		resource: PreviewResource,
		monster: unknown,
		options: CreatureEditOptions = {},
	) => {
		if (!isDraft || isResourceApplied(resource) || !isObjectSnapshot(monster)) {
			return;
		}
		setFieldEditingCreature({
			resource,
			monster: toBestiaryMonster(monster),
			...options,
		});
	};
	const closeCreatureFieldEdit = () => {
		setFieldEditingCreature(null);
	};
	const saveCreatureFieldEdit = (draftMonster: BestiaryMonster) => {
		const savedEdit = getSavedCreatureFieldEdit(
			fieldEditingCreature,
			draftMonster,
		);
		if (!savedEdit) return;
		updateSavedCreatureFieldEdit({
			...savedEdit,
			resolvePreviewResource,
			updateDraftResourceAfter,
		});
		closeCreatureFieldEdit();
	};

	return {
		closeCreatureFieldEdit,
		openCreatureFieldEdit,
		saveCreatureFieldEdit,
	};
}
