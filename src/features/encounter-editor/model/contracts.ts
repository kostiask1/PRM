import type { EncounterParticipant } from "./participantSynchronization.ts";

export type EncounterEditorId = string | number;

export interface EncounterEditorState extends Record<string, unknown> {
	id?: EncounterEditorId;
	name?: string;
	monsters?: EncounterParticipant[];
}

export interface EncounterScene extends Record<string, unknown> {
	id: EncounterEditorId;
	encounterId?: EncounterEditorId | null;
}

export interface EncounterEditorSyncEvent extends Record<string, unknown> {
	resource?: string;
	version?: string | number | null;
}

export interface ApplyEncounterUpdateOptions {
	persist?: boolean;
	preferredId?: string | null;
}

export type ApplyEncounterUpdate = (
	encounter: EncounterEditorState,
	options?: ApplyEncounterUpdateOptions,
) => void;
