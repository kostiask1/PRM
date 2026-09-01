import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import type { CampaignEntityRecord } from "../../../entities/campaign/index.js";
import type { EncounterParticipant } from "../../../features/encounter-editor/index.js";

export type EncounterViewId = string | number;

export interface EncounterViewParticipant extends EncounterParticipant {
	instanceId?: string;
	name?: string;
	currentHp?: unknown;
	hit_points?: unknown;
}

export interface EncounterViewState extends Record<string, unknown> {
	id?: EncounterViewId;
	name: string;
	monsters: EncounterViewParticipant[];
}

export interface EncounterViewSession extends Record<string, unknown> {
	data?: {
		encounters?: EncounterViewState[];
	};
}

export interface EncounterSyncEvent extends Record<string, unknown> {
	version?: string | number | null;
	campaignSlug?: string;
	sessionFileName?: string | number;
	resource?: string;
}

export interface EncounterUpdateOptions {
	saveDebounceMs?: number;
	persist?: boolean;
	preferredId?: string | null;
}

export interface MonsterAiUpdateOptions {
	preserveCurrentHp?: boolean;
	localOverride?: boolean;
}

export interface InitiativeStats {
	average: number | string;
	max: number | string;
	weightedAverage: number | string;
}

export interface EncounterViewModel {
	encounter: EncounterViewState | null;
	canUndo: boolean;
	canRedo: boolean;
	isHistoryRestoring: boolean;
	undoLabel: string;
	redoLabel: string;
	isSaving: boolean;
	selectedInstance: EncounterViewParticipant | null;
	setSelectedInstance: Dispatch<SetStateAction<EncounterViewParticipant | null>>;
	showBestiary: boolean;
	setShowBestiary: Dispatch<SetStateAction<boolean>>;
	showCharacterPicker: boolean;
	setShowCharacterPicker: Dispatch<SetStateAction<boolean>>;
	playerCharacters: CampaignEntityRecord[];
	notification: string | null;
	setNotification: Dispatch<SetStateAction<string | null>>;
	fileInputRef: RefObject<HTMLInputElement | null>;
	averageInitiative: number | string;
	initiativeStats: InitiativeStats;
	handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
	handleExport: () => void;
	handleRename: () => Promise<void>;
	handleAddMonster: (monster: EncounterViewParticipant) => Promise<void>;
	handleAddCharacter: (character: CampaignEntityRecord) => void;
	updateEncounterCharacter: (
		instanceId: string,
		character: Record<string, unknown>,
	) => void;
	handleAiUpdate: (session: EncounterViewSession | null) => void;
	removeMonster: (instanceId: string) => void;
	updateMonsterHp: (instanceId: string, value: string | number) => void;
	updateMonsterMaxHp: (instanceId: string, value: string | number) => void;
	updateMonsterImage: (instanceId: string, imageUrl: string | null) => void;
	updateMonsterFromAi: (
		instanceId: string,
		monster: EncounterViewParticipant,
		options?: MonsterAiUpdateOptions,
	) => void;
	duplicateMonster: (monster: EncounterViewParticipant) => void;
	rollMonsterHp: (instanceId: string) => void;
	getHpColor: (current: number, max: number) => string;
	handleReorderMonsters: (monsters: EncounterViewParticipant[]) => void;
	handleMonstersDrop: (monsters?: EncounterViewParticipant[] | null) => void;
	handleUndo: () => void;
	handleRedo: () => void;
	getMonsterImageOverride: (monster: { name?: unknown }) => string | null;
	handleBack: () => void;
}
