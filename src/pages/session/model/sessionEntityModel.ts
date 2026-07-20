import type {
	CardNote,
	CharacterData,
	LocationData,
} from "../../../entities/campaign/index.js";

export type SessionEntityType = "npc" | "locations";
export type SessionEntityId = string | number;

interface SessionEntityState extends Record<string, unknown> {
	id: SessionEntityId;
	notes: CardNote[];
	imageUrl: string | null;
	collapsed: boolean;
	isNotesCollapsed: boolean;
	_aiIgnored: boolean;
}

export type SessionNpcEntity = CharacterData & SessionEntityState;
export type SessionLocationEntity = LocationData & SessionEntityState;
export type SessionPageEntity = SessionNpcEntity | SessionLocationEntity;

export interface SessionEntityNameSource {
	name?: unknown;
	title?: unknown;
	firstName?: unknown;
	lastName?: unknown;
}

export function stripInternalFields(
	entity: Record<string, unknown> = {},
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(entity).filter(([key]) => !key.startsWith("_")),
	);
}

export function sessionEntityKey(type: SessionEntityType): "npcs" | "locations" {
	return type === "locations" ? "locations" : "npcs";
}

export function normalizeSessionEntity(
	type: "npc",
	entity?: Record<string, unknown>,
): SessionNpcEntity;
export function normalizeSessionEntity(
	type: "locations",
	entity?: Record<string, unknown>,
): SessionLocationEntity;
export function normalizeSessionEntity(
	type: SessionEntityType,
	entity?: Record<string, unknown>,
): SessionPageEntity;
export function normalizeSessionEntity(
	type: SessionEntityType,
	entity: Record<string, unknown> = {},
): SessionPageEntity {
	const source = stripInternalFields(entity);
	const base = getSessionEntityBase(type, source, entity);
	return type === "locations"
		? normalizeSessionLocation(source, base)
		: normalizeSessionNpc(source, base);
}

function getSessionEntityBase(
	type: SessionEntityType,
	source: Record<string, unknown>,
	entity: Record<string, unknown>,
): SessionEntityState {
	return {
		...source,
		id: normalizeSessionEntityId(source.id, type),
		notes: normalizeSessionEntityNotes(source.notes),
		imageUrl: typeof source.imageUrl === "string" ? source.imageUrl : null,
		collapsed: Boolean(source.collapsed),
		isNotesCollapsed: Boolean(source.isNotesCollapsed),
		_aiIgnored: Boolean(entity._aiIgnored),
	};
}

function normalizeSessionLocation(
	source: Record<string, unknown>,
	base: SessionEntityState,
): SessionLocationEntity {
	return {
		...base,
		name: String(source.name || source.title || ""),
		description: getStringField(source, "description"),
	};
}

function normalizeSessionNpc(
	source: Record<string, unknown>,
	base: SessionEntityState,
): SessionNpcEntity {
	return {
		...base,
		firstName: getFirstStringField(source, ["firstName", "name"]),
		lastName: getStringField(source, "lastName"),
		race: getStringField(source, "race"),
		class: getStringField(source, "class"),
		level: getSessionNpcLevel(source.level),
		motivation: getStringField(source, "motivation"),
		description: getStringField(source, "description"),
		trait: getStringField(source, "trait"),
	};
}

function getStringField(source: Record<string, unknown>, key: string): string {
	return typeof source[key] === "string" ? source[key] : "";
}

function getFirstStringField(
	source: Record<string, unknown>,
	keys: readonly string[],
): string {
	for (const key of keys) {
		const value = getStringField(source, key);
		if (value) return value;
	}
	return "";
}

function getSessionNpcLevel(value: unknown): string | number {
	if (value === "") return "";
	return typeof value === "number" || typeof value === "string" ? value : 1;
}

function normalizeSessionEntityId(
	value: unknown,
	type: SessionEntityType,
): SessionEntityId {
	return readSessionEntityId(value) ?? createSessionEntityId(type);
}

const SESSION_ENTITY_ID_READERS: Record<
	string,
	(value: unknown) => SessionEntityId | null
> = {
	string: (value) => value ? String(value) : null,
	number: (value) => Number.isFinite(value) ? Number(value) : null,
};

function readSessionEntityId(value: unknown): SessionEntityId | null {
	return SESSION_ENTITY_ID_READERS[typeof value]?.(value) ?? null;
}

function createSessionEntityId(type: SessionEntityType): string {
	const prefix = type === "locations" ? "session-locations" : "session-npc";
	return `${prefix}-${Date.now()}`;
}

function normalizeSessionEntityNotes(value: unknown): CardNote[] {
	if (!Array.isArray(value)) return [];
	return value.map((item, index) => {
		const note = item && typeof item === "object"
			? (item as Record<string, unknown>)
			: {};
		return {
			...note,
			id: normalizeNoteId(note.id, index),
			title: typeof note.title === "string" ? note.title : "",
			text: typeof note.text === "string" ? note.text : "",
			collapsed: Boolean(note.collapsed),
		};
	});
}

function normalizeNoteId(value: unknown, index: number): SessionEntityId {
	if (typeof value === "string" && value) return value;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	return `session-entity-note-${Date.now()}-${index}`;
}

export function normalizeSessionEntities(
	type: "npc",
	entities: unknown,
): SessionNpcEntity[];
export function normalizeSessionEntities(
	type: "locations",
	entities: unknown,
): SessionLocationEntity[];
export function normalizeSessionEntities(
	type: SessionEntityType,
	entities: unknown,
): SessionPageEntity[];
export function normalizeSessionEntities(
	type: SessionEntityType,
	entities: unknown,
): SessionPageEntity[] {
	return (Array.isArray(entities) ? entities : []).map((entity) =>
		normalizeSessionEntity(
			type,
			entity && typeof entity === "object"
				? (entity as Record<string, unknown>)
				: {},
		),
	);
}

export function getSessionEntityDisplayName(
	type: SessionEntityType,
	entity: SessionEntityNameSource = {},
	untitledLabel = "Untitled",
): string {
	return type === "locations"
		? getFirstSessionEntityName([entity.name, entity.title, untitledLabel])
		: getFirstSessionEntityName([
			getSessionEntityFullName(entity),
			entity.name,
			entity.title,
			untitledLabel,
		]);
}

function getSessionEntityFullName(entity: SessionEntityNameSource): string {
	return `${getSessionEntityNamePart(entity.firstName)} ${getSessionEntityNamePart(entity.lastName)}`.trim();
}

function getSessionEntityNamePart(value: unknown): string {
	return value ? String(value) : "";
}

function getFirstSessionEntityName(values: readonly unknown[]): string {
	return String(values.find(Boolean) || "").trim();
}
