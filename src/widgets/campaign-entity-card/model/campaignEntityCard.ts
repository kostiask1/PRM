import type {
	CardNote,
	CharacterData,
	LocationData,
} from "../../../entities/campaign/index.js";

export type CampaignCardViewMode = "card" | "modal";
export type CampaignCardEntityId = string | number | undefined;

export interface CampaignEntityHighlightFields {
	fields?: readonly string[];
	notes?: Record<string, readonly string[]>;
}

export interface CampaignCardPresentation {
	hasNotesData: boolean;
	hasCardData: boolean;
	canCollapseCard: boolean;
	isCollapsed: boolean;
	isNotesCollapsed: boolean;
}

export interface CharacterDraft extends CharacterData {
	id: string;
	firstName: string;
	lastName: string;
	race: string;
	class: string;
	level: number;
	motivation: string;
	description: string;
	trait: string;
	notes: CardNote[];
	collapsed: false;
	isNotesCollapsed: false;
}

export interface LocationDraft extends LocationData {
	id: string;
	name: string;
	description: string;
	notes: CardNote[];
	imageUrl: null;
	collapsed: false;
	isNotesCollapsed: false;
}

function hasText(value: unknown): boolean {
	return String(value ?? "").trim().length > 0;
}

export function hasCampaignCardNoteData(notes: readonly CardNote[]): boolean {
	return notes.some((note) => hasText(note.title) || hasText(note.text));
}

function getCampaignCardPresentation(
	entity: CharacterData | LocationData,
	hasCardData: boolean,
	hasNotesData: boolean,
	viewMode: CampaignCardViewMode,
	hasToggleCollapse: boolean,
): CampaignCardPresentation {
	const canCollapseCard = viewMode !== "modal" && hasToggleCollapse && hasCardData;
	return {
		hasNotesData,
		hasCardData,
		canCollapseCard,
		isCollapsed: canCollapseCard && Boolean(entity.collapsed),
		isNotesCollapsed: hasNotesData && Boolean(entity.isNotesCollapsed),
	};
}

export function getCharacterCardPresentation(
	character: CharacterData,
	notes: readonly CardNote[],
	viewMode: CampaignCardViewMode,
	hasToggleCollapse: boolean,
): CampaignCardPresentation {
	const hasNotesData = hasCampaignCardNoteData(notes);
	const hasCardData = [
		character.firstName,
		character.lastName,
		character.race,
		character.class,
		character.motivation,
		character.description,
		character.trait,
		character.imageUrl,
	].some(hasText) || hasNotesData;
	return getCampaignCardPresentation(character, hasCardData, hasNotesData, viewMode, hasToggleCollapse);
}

export function getLocationCardPresentation(
	location: LocationData,
	notes: readonly CardNote[],
	viewMode: CampaignCardViewMode,
	hasToggleCollapse: boolean,
): CampaignCardPresentation {
	const hasNotesData = hasCampaignCardNoteData(notes);
	const hasCardData = [location.name, location.description, location.imageUrl].some(hasText) || hasNotesData;
	return getCampaignCardPresentation(location, hasCardData, hasNotesData, viewMode, hasToggleCollapse);
}

export function getCharacterDisplayName(character: CharacterData): string {
	return `${character.firstName ?? ""} ${character.lastName ?? ""}`.trim()
		|| String(character.name ?? character.title ?? "").trim();
}

export function getLocationDisplayName(location: LocationData): string {
	return String(location.name ?? location.title ?? "").trim();
}

export function getCampaignEntityFieldClass(
	highlightFields: CampaignEntityHighlightFields | null | undefined,
	field: string,
): string {
	return highlightFields?.fields?.includes(field) ? "is_ai_changed_field" : "";
}

export function getCampaignNoteHighlightFields(
	highlightFields: CampaignEntityHighlightFields | null | undefined,
	note: CardNote,
): readonly string[] | null {
	return highlightFields?.notes?.[String(note.id)]
		?? highlightFields?.notes?.[String(note.title ?? "").trim()]
		?? null;
}

export function setCampaignNoteAiIgnored(
	notes: readonly CardNote[],
	noteId: CardNote["id"],
	ignored: boolean,
): CardNote[] {
	return notes.map((note) => note.id === noteId ? { ...note, _aiIgnored: ignored } : note);
}

function createDraftNote(now: number): CardNote {
	return { id: now + 1, title: "", text: "", collapsed: false };
}

export function createCharacterDraft(
	entityType: string,
	now = Date.now(),
): CharacterDraft {
	return {
		id: `new-${entityType}-${now}`,
		firstName: "",
		lastName: "",
		race: "",
		class: "",
		level: 1,
		motivation: "",
		description: "",
		trait: "",
		notes: [createDraftNote(now)],
		collapsed: false,
		isNotesCollapsed: false,
	};
}

export function createLocationDraft(now = Date.now()): LocationDraft {
	return {
		id: `new-locations-${now}`,
		name: "",
		description: "",
		notes: [createDraftNote(now)],
		imageUrl: null,
		collapsed: false,
		isNotesCollapsed: false,
	};
}

export function isCharacterDraftValid(draft: CharacterData): boolean {
	return hasText(draft.firstName);
}

export function isLocationDraftValid(draft: LocationData): boolean {
	return hasText(draft.name);
}
