export type SessionEntityType = "npc" | "locations";
export type SessionEntityId = string | number;

export interface SessionPageEntity extends Record<string, unknown> {
	id: SessionEntityId;
	name?: string;
	title?: string;
	firstName?: string;
	lastName?: string;
	notes: unknown[];
	imageUrl: unknown | null;
	collapsed: boolean;
	isNotesCollapsed: boolean;
	_aiIgnored: boolean;
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
	type: SessionEntityType,
	entity: Record<string, unknown> = {},
): SessionPageEntity {
	const now = Date.now();
	const source = stripInternalFields(entity);
	if (type === "locations") {
		return {
			id: (source.id as SessionEntityId) || `session-locations-${now}`,
			name: String(source.name || source.title || ""),
			description: source.description || "",
			notes: Array.isArray(source.notes) ? source.notes : [],
			imageUrl: source.imageUrl ?? null,
			collapsed: Boolean(source.collapsed),
			isNotesCollapsed: Boolean(source.isNotesCollapsed),
			...source,
			_aiIgnored: Boolean(entity._aiIgnored),
		} as SessionPageEntity;
	}
	return {
		id: (source.id as SessionEntityId) || `session-npc-${now}`,
		firstName: String(source.firstName || source.name || ""),
		lastName: String(source.lastName || ""),
		race: source.race || "",
		class: source.class || "",
		level: source.level === "" ? "" : source.level || 1,
		motivation: source.motivation || "",
		description: source.description || "",
		trait: source.trait || "",
		notes: Array.isArray(source.notes) ? source.notes : [],
		imageUrl: source.imageUrl ?? null,
		collapsed: Boolean(source.collapsed),
		isNotesCollapsed: Boolean(source.isNotesCollapsed),
		...source,
		_aiIgnored: Boolean(entity._aiIgnored),
	} as SessionPageEntity;
}

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
	entity: Partial<SessionPageEntity> = {},
	untitledLabel = "Untitled",
): string {
	if (type === "locations") {
		return String(entity.name || entity.title || untitledLabel).trim();
	}
	const fullName = `${entity.firstName || ""} ${entity.lastName || ""}`.trim();
	return String(fullName || entity.name || entity.title || untitledLabel).trim();
}
