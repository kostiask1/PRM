import { request } from "../../../shared/api/index.ts";

export type SessionDomainId = string | number;

export interface SessionRecord extends Record<string, unknown> {
	id?: SessionDomainId;
	fileName?: string;
	name: string;
	order?: number;
}

export interface SessionOrder {
	id?: SessionDomainId;
	fileName?: string;
	order: number;
}

export type SessionOrderPayload = SessionOrder[] | Record<string, number>;

export interface EntityScopeMovePayload extends Record<string, unknown> {
	targetScope: "campaign" | "session";
	entitySlug?: string;
}

export interface EncounterRecord extends Record<string, unknown> {
	id?: SessionDomainId;
	name?: string;
	monsters?: EncounterMonsterRecord[];
}

export type EncounterMonsterRecord = Record<string, unknown>;

export interface EntityScopeMoveResult {
	entity: Record<string, unknown>;
	session: SessionRecord;
}

export interface SceneEncounterResult {
	created: boolean;
	encounter: EncounterRecord;
	session: SessionRecord;
}

export interface EncounterUpdateResult {
	encounter: EncounterRecord;
	session: SessionRecord;
}

export interface AddEncounterMonsterResult extends EncounterUpdateResult {
	monster: EncounterMonsterRecord;
}

const sessionPath = (slug: string, fileName = "") =>
	`/campaigns/${encodeURIComponent(slug)}/sessions${fileName ? `/${encodeURIComponent(fileName)}` : ""}`;

export const sessionApi = {
	listSessions: (slug: string) => request<SessionRecord[]>(sessionPath(slug)),
	createSession: (slug: string, name: string) =>
		request<SessionRecord>(sessionPath(slug), {
			method: "POST",
			body: JSON.stringify({ name }),
		}),
	getSession: (slug: string, fileName: string) =>
		request<SessionRecord>(sessionPath(slug, fileName)),
	updateSession: (
		slug: string,
		fileName: string,
		payload: Partial<SessionRecord>,
	) =>
		request<SessionRecord>(sessionPath(slug, fileName), {
			method: "PATCH",
			body: JSON.stringify(payload),
		}),
	deleteSession: (slug: string, fileName: string) =>
		request<void>(sessionPath(slug, fileName), { method: "DELETE" }),
	reorderSessions: (slug: string, orders: SessionOrderPayload) =>
		request<SessionRecord[]>(`${sessionPath(slug)}/reorder`, {
			method: "POST",
			body: JSON.stringify({ orders }),
		}),
	moveEntityScope: (
		slug: string,
		fileName: string,
		type: string,
		entityId: SessionDomainId,
		payload: EntityScopeMovePayload,
	) =>
		request<EntityScopeMoveResult>(
			`${sessionPath(slug, fileName)}/entities/${encodeURIComponent(type)}/${encodeURIComponent(String(entityId))}/move-scope`,
			{ method: "POST", body: JSON.stringify(payload) },
		),
	createSceneEncounter: (
		slug: string,
		fileName: string,
		sceneId: SessionDomainId,
		name: string,
	) =>
		request<SceneEncounterResult>(
			`${sessionPath(slug, fileName)}/scenes/${encodeURIComponent(String(sceneId))}/encounters`,
			{ method: "POST", body: JSON.stringify({ name }) },
		),
	updateEncounter: (
		slug: string,
		fileName: string,
		encounterId: SessionDomainId,
		patch: Partial<EncounterRecord>,
	) =>
		request<EncounterUpdateResult>(
			`${sessionPath(slug, fileName)}/encounters/${encodeURIComponent(String(encounterId))}`,
			{ method: "PATCH", body: JSON.stringify(patch) },
		),
	addEncounterMonster: (
		slug: string,
		fileName: string,
		encounterId: SessionDomainId,
		monster: EncounterMonsterRecord,
	) =>
		request<AddEncounterMonsterResult>(
			`${sessionPath(slug, fileName)}/encounters/${encodeURIComponent(String(encounterId))}/monsters`,
			{ method: "POST", body: JSON.stringify({ monster }) },
		),
};
