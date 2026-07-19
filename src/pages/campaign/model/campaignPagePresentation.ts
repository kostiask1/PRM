import type {
	CardNote,
	CharacterData,
	DomainId,
	LocationData,
} from "../../../entities/campaign/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import type {
	CampaignPageCampaign,
	CampaignPageEntity,
} from "./contracts.ts";

export type CampaignNotesViewMode = "list" | "graph";
export type CampaignEntitySectionType = "characters" | "npc" | "locations";
export type CampaignCharacterType = "characters" | "npc";
export type CampaignHashTarget = "notes" | "characters" | "npc" | "locations";

export interface CampaignCharacterDropPayload {
	kind?: string;
	sourceType?: string;
	id?: DomainId;
}

export interface CampaignCharacterDropRequest {
	sourceType: CampaignCharacterType;
	targetType: CampaignCharacterType;
	id: DomainId;
}

export interface CampaignSessionItem extends SessionRecord {
	fileName: string;
}

export interface CampaignSectionStateInput {
	description: unknown;
	notes: unknown;
	characters?: CampaignPageEntity[];
	npcs?: CampaignPageEntity[];
	locations?: CampaignPageEntity[];
	isDescriptionCollapsed: boolean;
	isNotesCollapsed: boolean;
	isCharactersCollapsed: boolean;
	isNpcsCollapsed: boolean;
	isLocationsCollapsed: boolean;
}

export interface CampaignSectionState {
	hasDescriptionData: boolean;
	hasNotesData: boolean;
	hasCharactersData: boolean;
	hasNpcsData: boolean;
	hasLocationsData: boolean;
	isDescriptionCollapsed: boolean;
	isNotesCollapsed: boolean;
	isCharactersCollapsed: boolean;
	isNpcsCollapsed: boolean;
	isLocationsCollapsed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getCampaignPageCampaign(
	value: unknown,
): CampaignPageCampaign | null {
	if (!isRecord(value)) return null;
	if (typeof value.slug !== "string" || typeof value.name !== "string") return null;
	return value as CampaignPageCampaign;
}

export function hasCampaignDescription(description: unknown): boolean {
	return String(description || "").trim().length > 0;
}

export function hasCampaignNoteContent(notes: unknown): boolean {
	return (Array.isArray(notes) ? notes : []).some((note) => {
		if (!isRecord(note)) return false;
		return Boolean(String(note.title || "").trim() || String(note.text || "").trim());
	});
}

function hasCampaignItems(items: CampaignPageEntity[] | undefined): boolean {
	return Array.isArray(items) && items.length > 0;
}

function getStoredCollapseState(hasData: boolean, collapsed: boolean): boolean {
	return hasData ? collapsed : false;
}

export function getCampaignSectionState(
	input: CampaignSectionStateInput,
): CampaignSectionState {
	const hasDescriptionData = hasCampaignDescription(input.description);
	const hasNotesData = hasCampaignNoteContent(input.notes);
	const hasCharactersData = hasCampaignItems(input.characters);
	const hasNpcsData = hasCampaignItems(input.npcs);
	const hasLocationsData = hasCampaignItems(input.locations);
	return {
		hasDescriptionData,
		hasNotesData,
		hasCharactersData,
		hasNpcsData,
		hasLocationsData,
		isDescriptionCollapsed: getStoredCollapseState(
			hasDescriptionData,
			input.isDescriptionCollapsed,
		),
		isNotesCollapsed: getStoredCollapseState(
			hasNotesData,
			input.isNotesCollapsed,
		),
		isCharactersCollapsed: getStoredCollapseState(
			hasCharactersData,
			input.isCharactersCollapsed,
		),
		isNpcsCollapsed: getStoredCollapseState(
			hasNpcsData,
			input.isNpcsCollapsed,
		),
		isLocationsCollapsed: getStoredCollapseState(
			hasLocationsData,
			input.isLocationsCollapsed,
		),
	};
}

export function getCampaignHashTarget(hash: unknown): CampaignHashTarget | null {
	const value = String(hash || "");
	if (value.includes("campaign-note")) return "notes";
	if (value.includes("campaign-character")) return "characters";
	if (value.includes("campaign-npc")) return "npc";
	return value.includes("campaign-location") ? "locations" : null;
}

function isCampaignCharacterType(value: unknown): value is CampaignCharacterType {
	return value === "characters" || value === "npc";
}

export function getCampaignCharacterDropRequest(
	payload: CampaignCharacterDropPayload | null | undefined,
	targetType: unknown,
): CampaignCharacterDropRequest | null {
	if (payload?.kind !== "campaign-character") return null;
	if (!isCampaignCharacterType(payload.sourceType)) return null;
	if (!isCampaignCharacterType(targetType)) return null;
	if (typeof payload.id !== "string" && typeof payload.id !== "number") return null;
	return { sourceType: payload.sourceType, targetType, id: payload.id };
}

export function filterCampaignSessions(
	sessions: SessionRecord[] | null | undefined,
	query: string,
): CampaignSessionItem[] {
	const normalizedQuery = query.trim().toLowerCase();
	return (Array.isArray(sessions) ? sessions : []).filter(
		(session): session is CampaignSessionItem =>
			typeof session.fileName === "string" &&
			session.fileName.length > 0 &&
			(!normalizedQuery || session.name.toLowerCase().includes(normalizedQuery)),
	);
}

export function normalizeCampaignCardNotes(notes: unknown): CardNote[] {
	return (Array.isArray(notes) ? notes : [])
		.filter(
			(note): note is Record<string, unknown> & { id: DomainId } =>
				isRecord(note) &&
				(typeof note.id === "string" || typeof note.id === "number"),
		)
		.map((note) => ({
			...note,
			id: note.id,
			title: typeof note.title === "string" ? note.title : "",
			text: typeof note.text === "string" ? note.text : "",
			collapsed: Boolean(note.collapsed),
		}));
}

export function normalizeCampaignCardNote(note: unknown): CardNote {
	return normalizeCampaignCardNotes([note])[0] ?? {
		id: "preview-note",
		title: "",
		text: "",
		collapsed: false,
	};
}

export function toCharacterCardData(entity: CampaignPageEntity): CharacterData {
	return { ...entity, notes: normalizeCampaignCardNotes(entity.notes) };
}

export function toLocationCardData(entity: CampaignPageEntity): LocationData {
	return { ...entity, notes: normalizeCampaignCardNotes(entity.notes) };
}

export function getCampaignEntityId(entity: CampaignPageEntity): DomainId | null {
	return typeof entity.id === "string" || typeof entity.id === "number"
		? entity.id
		: null;
}

export function getCampaignEntityRenderKey(
	entity: CampaignPageEntity,
	index: number,
): DomainId {
	return getCampaignEntityId(entity) ?? entity.slug ?? `entity-${index}`;
}
