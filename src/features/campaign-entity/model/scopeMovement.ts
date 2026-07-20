import type { CampaignEntityRecord } from "../../../entities/campaign/index.js";
import type {
	EntityScopeMovePayload,
	EntityScopeMoveResult,
	SessionRecord,
} from "../../../entities/session/index.js";
import type {
	CampaignFeatureEntityId,
	CampaignFeatureEntityType,
} from "./contracts.ts";

export type EntityScope = "campaign" | "session";
export type ScopeMoveErrorOperation =
	| "load"
	| "move-to-session"
	| "move-to-campaign";

export interface SessionEntityRecord extends CampaignEntityRecord {
	id?: CampaignFeatureEntityId;
	slug?: string;
}

interface CampaignEntitySessionData extends Record<string, unknown> {
	npcs?: SessionEntityRecord[];
	locations?: SessionEntityRecord[];
}

export interface CampaignEntitySession extends Record<string, unknown> {
	fileName?: string;
	data?: CampaignEntitySessionData;
}

export interface ScopeImportModalState {
	type: CampaignFeatureEntityType;
	items: CampaignEntityRecord[];
	isLoading: boolean;
}

export interface FlushPendingSaveOptions {
	throwOnError: boolean;
}

interface EntityScopeMovePlanBase {
	type: CampaignFeatureEntityType;
	entity: SessionEntityRecord;
	entityId: CampaignFeatureEntityId;
	fileName: string;
}

export interface CampaignToSessionScopeMovePlan
	extends EntityScopeMovePlanBase {
	operation: "move-to-session";
	targetScope: "session";
	entitySlug: string;
}

export interface SessionToCampaignScopeMovePlan
	extends EntityScopeMovePlanBase {
	operation: "move-to-campaign";
	targetScope: "campaign";
}

export type EntityScopeMovePlan =
	| CampaignToSessionScopeMovePlan
	| SessionToCampaignScopeMovePlan;

export interface ScopeMoveApiPort {
	moveEntityScope: (
		campaignSlug: string,
		fileName: string,
		type: CampaignFeatureEntityType,
		entityId: CampaignFeatureEntityId,
		payload: EntityScopeMovePayload,
	) => Promise<EntityScopeMoveResult | null | undefined>;
}

export interface ScopeMoveExecutionDependencies {
	campaignSlug: string;
	confirmMove: (
		targetScope: EntityScope,
		type: CampaignFeatureEntityType,
		entity: CampaignEntityRecord,
	) => boolean | Promise<boolean>;
	flushPendingSave?: (
		options: FlushPendingSaveOptions,
	) =>
		| CampaignEntitySession
		| SessionRecord
		| null
		| void
		| Promise<CampaignEntitySession | SessionRecord | null | void>;
	api: ScopeMoveApiPort;
}

export type ScopeMoveExecutionOutcome =
	| { status: "cancelled" }
	| { status: "moved"; result: EntityScopeMoveResult }
	| { status: "failed"; error: unknown };

function hasFileName(
	session: CampaignEntitySession | null | undefined,
): session is CampaignEntitySession & { fileName: string } {
	return typeof session?.fileName === "string" && session.fileName.length > 0;
}

function getSessionEntityList(
	session: CampaignEntitySession,
	type: CampaignFeatureEntityType,
): readonly SessionEntityRecord[] {
	const key = type === "locations" ? "locations" : "npcs";
	const items = session.data?.[key];
	return Array.isArray(items) ? items : [];
}

export function buildCampaignToSessionScopeMovePlan(
	session: CampaignEntitySession | null | undefined,
	type: CampaignFeatureEntityType,
	entity: SessionEntityRecord | null | undefined,
): EntityScopeMovePlan | null {
	if (!hasFileName(session) || typeof entity?.slug !== "string" || !entity.slug) {
		return null;
	}
	const entityId =
		entity.id === undefined || entity.id === null || entity.id === ""
			? entity.slug
			: entity.id;
	return {
		operation: "move-to-session",
		targetScope: "session",
		type,
		entity,
		entityId,
		entitySlug: entity.slug,
		fileName: session.fileName,
	};
}

export function buildSessionToCampaignScopeMovePlan(
	session: CampaignEntitySession | null | undefined,
	type: CampaignFeatureEntityType,
	id: CampaignFeatureEntityId,
): EntityScopeMovePlan | null {
	if (!hasFileName(session)) return null;
	const entity = getSessionEntityList(session, type).find(
		(item) => String(item.id) === String(id),
	);
	if (!entity) return null;
	return {
		operation: "move-to-campaign",
		targetScope: "campaign",
		type,
		entity,
		entityId: id,
		fileName: session.fileName,
	};
}

export function removeMovedCampaignEntityFromImport(
	modal: ScopeImportModalState | null,
	entitySlug: string,
): ScopeImportModalState | null {
	if (!modal) return null;
	return {
		...modal,
		items: modal.items.filter((item) => item.slug !== entitySlug),
	};
}

export async function executeEntityScopeMove(
	plan: EntityScopeMovePlan,
	dependencies: ScopeMoveExecutionDependencies,
): Promise<ScopeMoveExecutionOutcome> {
	try {
		const confirmed = await dependencies.confirmMove(
			plan.targetScope,
			plan.type,
			plan.entity,
		);
		if (!confirmed) return { status: "cancelled" };

		const flushedSession = await dependencies.flushPendingSave?.({
			throwOnError: true,
		});
		const fileName = flushedSession?.fileName || plan.fileName;
		const payload: EntityScopeMovePayload =
			plan.operation === "move-to-session"
				? { entitySlug: plan.entitySlug, targetScope: "session" }
				: { targetScope: "campaign" };
		const result = await dependencies.api.moveEntityScope(
			dependencies.campaignSlug,
			fileName,
			plan.type,
			plan.entityId,
			payload,
		);
		if (!result?.session) {
			throw new Error("Entity scope move returned no session");
		}
		return { status: "moved", result };
	} catch (error) {
		return { status: "failed", error };
	}
}
