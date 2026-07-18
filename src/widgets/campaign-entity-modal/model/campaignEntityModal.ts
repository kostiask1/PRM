import type {
	CampaignEntity,
	CampaignEntityRecord,
} from "../../../entities/campaign/index.js";
import { sanitizeNotesForSave, type SharedNote } from "../../../shared/lib/index.js";

export type CampaignEntityModalCardKind = "character" | "location";

export interface CampaignEntityRenamePlan {
	normalizedOldName: string;
	normalizedNewName: string;
	requiresConfirmation: boolean;
}

export interface CampaignEntityModalCardPlan {
	kind: CampaignEntityModalCardKind;
	key: string;
}

export interface CampaignModalEntity extends CampaignEntity {
	slug: string;
}

export function isCampaignModalEntity(
	value: CampaignEntity | null | undefined,
): value is CampaignModalEntity {
	return Boolean(value && typeof value.slug === "string" && value.slug.trim());
}

export function normalizeCampaignEntityMentionName(value: unknown): string {
	return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function getCampaignEntityRenamePlan(
	oldName: unknown,
	newName: unknown,
): CampaignEntityRenamePlan {
	const normalizedOldName = normalizeCampaignEntityMentionName(oldName);
	const normalizedNewName = normalizeCampaignEntityMentionName(newName);
	return {
		normalizedOldName,
		normalizedNewName,
		requiresConfirmation: Boolean(
			normalizedOldName &&
			normalizedNewName &&
			normalizedOldName !== normalizedNewName,
		),
	};
}

function isSharedNote(value: unknown): value is SharedNote {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function sanitizeCampaignModalEntity(
	entity: CampaignEntity,
): Partial<CampaignEntityRecord> {
	const sanitized = Object.fromEntries(
		Object.entries(entity || {}).filter(([key]) => !key.startsWith("_")),
	) as Record<string, unknown>;
	if (Array.isArray(sanitized.notes)) {
		sanitized.notes = sanitizeNotesForSave(sanitized.notes.filter(isSharedNote));
	}
	return sanitized as Partial<CampaignEntityRecord>;
}

export function getCampaignEntityModalCardPlan(
	type: unknown,
	entity: CampaignEntity,
): CampaignEntityModalCardPlan {
	const kind = type === "locations" ? "location" : "character";
	return {
		kind,
		key: String(
			entity.id ||
			entity.slug ||
			(kind === "location"
				? "entity-modal-location-card"
				: "entity-modal-card"),
		),
	};
}

export function shouldRenderCampaignEntityModal(
	campaignSlug: unknown,
	modalScope: unknown,
): boolean {
	return Boolean(String(campaignSlug || "").trim() && !modalScope);
}
