import type {
	CampaignEntityType,
	CampaignRecord,
} from "../../../entities/campaign/index.js";
import type { SessionRecord } from "../../../entities/session/index.js";
import type { SharedNote } from "../../../shared/lib/index.js";
import type {
	CampaignAiUpdateOptions,
	CampaignPageCampaign,
	CampaignPageEntity,
	CampaignSyncEvent,
} from "./contracts.ts";

export interface CampaignViewStateProjection {
	description: string;
	notes: SharedNote[];
	isDescriptionCollapsed: boolean;
	isNotesCollapsed: boolean;
	isCharactersCollapsed: boolean;
	isNpcsCollapsed: boolean;
	isLocationsCollapsed: boolean;
}

export function getCampaignViewStateProjection(
	campaign: Partial<CampaignPageCampaign>,
): CampaignViewStateProjection {
	return {
		description: getCampaignViewText(campaign.description),
		notes: getCampaignViewNotes(campaign.notes),
		isDescriptionCollapsed: getCampaignViewCollapsed(campaign.isDescriptionCollapsed),
		isNotesCollapsed: getCampaignViewCollapsed(campaign.isNotesCollapsed),
		isCharactersCollapsed: getCampaignViewCollapsed(campaign.isCharactersCollapsed),
		isNpcsCollapsed: getCampaignViewCollapsed(campaign.isNpcsCollapsed),
		isLocationsCollapsed: getCampaignViewCollapsed(campaign.isLocationsCollapsed),
	};
}

export function getCampaignViewEntities(
	entities: CampaignPageEntity[] | null | undefined,
): CampaignPageEntity[] {
	return entities || [];
}

function getCampaignViewText(value: string | null | undefined): string {
	return value || "";
}

function getCampaignViewNotes(
	value: CampaignPageCampaign["notes"] | null | undefined,
): SharedNote[] {
	return value || [];
}

function getCampaignViewCollapsed(value: boolean | null | undefined): boolean {
	return value || false;
}

export interface CampaignSyncPlan {
	reloadEntities: boolean;
	reloadSessions: boolean;
}

const EMPTY_CAMPAIGN_SYNC_PLAN: CampaignSyncPlan = {
	reloadEntities: false,
	reloadSessions: false,
};

const CAMPAIGN_SYNC_PLANS: Record<string, CampaignSyncPlan> = {
	entities: { reloadEntities: true, reloadSessions: false },
	images: { reloadEntities: true, reloadSessions: false },
	sessions: { reloadEntities: false, reloadSessions: true },
	ai: { reloadEntities: true, reloadSessions: true },
	import: { reloadEntities: true, reloadSessions: true },
};

export function getCampaignSyncPlan(
	event: CampaignSyncEvent | null | undefined,
	campaignSlug: string,
): CampaignSyncPlan {
	if (!hasCampaignSyncVersion(event)) return EMPTY_CAMPAIGN_SYNC_PLAN;
	if (!isCampaignSyncEventInScope(event, campaignSlug)) return EMPTY_CAMPAIGN_SYNC_PLAN;
	return CAMPAIGN_SYNC_PLANS[String(event?.resource)] || EMPTY_CAMPAIGN_SYNC_PLAN;
}

function hasCampaignSyncVersion(event: CampaignSyncEvent | null | undefined): boolean {
	return Boolean(event?.version);
}

function isCampaignSyncEventInScope(
	event: CampaignSyncEvent | null | undefined,
	campaignSlug: string,
): boolean {
	return !event?.campaignSlug || event.campaignSlug === campaignSlug;
}

export interface CampaignSyncEffects {
	reloadEntities: () => void;
	reloadSessions: () => void;
}

export function executeCampaignSyncPlan(
	plan: CampaignSyncPlan,
	effects: CampaignSyncEffects,
): void {
	if (plan.reloadEntities) effects.reloadEntities();
	if (plan.reloadSessions) effects.reloadSessions();
}

export interface CampaignDeleteConfirmation {
	confirmed?: boolean;
	moveImagesToGeneral?: boolean;
}

interface CampaignImageCheckOptions {
	campaignSlug: string;
	checkImages: (campaignSlug: string) => Promise<{ hasImages?: unknown } | null>;
	onError: (error: unknown) => void;
}

export async function executeCampaignImageCheck({
	campaignSlug,
	checkImages,
	onError,
}: CampaignImageCheckOptions): Promise<boolean> {
	try {
		const result = await checkImages(campaignSlug);
		return Boolean(result?.hasImages);
	} catch (error) {
		onError(error);
		return true;
	}
}

export interface CampaignDeleteConfirmationConfig extends Record<string, unknown> {
	title: string;
	message: string;
	checkboxLabel?: string;
	checkboxDefaultChecked?: boolean;
	getConfirmValue: (
		value?: unknown,
		moveImagesToGeneral?: boolean,
	) => CampaignDeleteConfirmation;
}

type CampaignViewTranslate = (key: string) => string;

export function getCampaignDeleteConfirmationConfig(
	hasCampaignImages: boolean,
	translate: CampaignViewTranslate,
): CampaignDeleteConfirmationConfig {
	return hasCampaignImages
		? getCampaignDeleteWithImagesConfig(translate)
		: getCampaignDeleteWithoutImagesConfig(translate);
}

function getCampaignDeleteWithImagesConfig(
	translate: CampaignViewTranslate,
): CampaignDeleteConfirmationConfig {
	return {
		title: translate("Delete campaign"),
		message: translate(
			"All sessions in this campaign will be permanently lost. Campaign images will be moved to General if this option is enabled; otherwise they will be deleted. Continue?",
		),
		checkboxLabel: translate("Move campaign images to General"),
		checkboxDefaultChecked: true,
		getConfirmValue: (_value, moveImagesToGeneral) => ({
			confirmed: true,
			moveImagesToGeneral: Boolean(moveImagesToGeneral),
		}),
	};
}

function getCampaignDeleteWithoutImagesConfig(
	translate: CampaignViewTranslate,
): CampaignDeleteConfirmationConfig {
	return {
		title: translate("Delete campaign"),
		message: translate("All sessions in this campaign will be permanently lost. Continue?"),
		getConfirmValue: () => ({ confirmed: true, moveImagesToGeneral: false }),
	};
}

export type CampaignDeleteOutcome = "deleted" | "cancelled" | "failed";

interface ExecuteCampaignDeleteOptions {
	campaignSlug: string;
	hasCampaignImages: boolean;
	confirmation: CampaignDeleteConfirmation | null | undefined;
	deleteCampaign: (
		campaignSlug: string,
		options: { moveImagesToGeneral: boolean },
	) => Promise<unknown>;
	onDeleted: () => void;
	onError: (error: unknown) => void;
}

export async function executeCampaignDelete({
	campaignSlug,
	hasCampaignImages,
	confirmation,
	deleteCampaign,
	onDeleted,
	onError,
}: ExecuteCampaignDeleteOptions): Promise<CampaignDeleteOutcome> {
	if (!confirmation?.confirmed) return "cancelled";
	try {
		await deleteCampaign(campaignSlug, {
			moveImagesToGeneral: hasCampaignImages && Boolean(confirmation.moveImagesToGeneral),
		});
		onDeleted();
		return "deleted";
	} catch (error) {
		onError(error);
		return "failed";
	}
}

export interface CampaignAiUpdatePlan {
	campaignState: Pick<CampaignViewStateProjection, "description" | "notes"> | null;
	entityTypes: CampaignEntityType[];
}

const DEFAULT_AI_ENTITY_TYPES: CampaignEntityType[] = ["characters", "npc", "locations"];

export function getCampaignAiUpdatePlan(
	updatedCampaign: Partial<CampaignPageCampaign> | null,
	options: CampaignAiUpdateOptions = {},
): CampaignAiUpdatePlan {
	return {
		campaignState: updatedCampaign
			? {
				description: getCampaignViewText(updatedCampaign.description),
				notes: getCampaignViewNotes(updatedCampaign.notes),
			}
			: null,
		entityTypes: Array.isArray(options.entityTypes)
			? options.entityTypes
			: [...DEFAULT_AI_ENTITY_TYPES],
	};
}

export type CampaignAiEntityReloadOutcome = "reloaded" | "skipped" | "failed";

interface ExecuteCampaignAiEntityReloadOptions {
	campaignSlug: string;
	entityTypes: CampaignEntityType[];
	getEntities: (
		campaignSlug: string,
		type: CampaignEntityType,
	) => Promise<CampaignPageEntity[] | null>;
	normalizeEntity: (entity: CampaignPageEntity) => CampaignPageEntity;
	setEntities: Record<CampaignEntityType, (entities: CampaignPageEntity[]) => void>;
	onError: (error: unknown) => void;
}

export async function executeCampaignAiEntityReload({
	campaignSlug,
	entityTypes,
	getEntities,
	normalizeEntity,
	setEntities,
	onError,
}: ExecuteCampaignAiEntityReloadOptions): Promise<CampaignAiEntityReloadOutcome> {
	if (entityTypes.length === 0) return "skipped";
	try {
		await Promise.all(entityTypes.map(async (type) => {
			const entities = await getEntities(campaignSlug, type);
			setEntities[type]((entities || []).map(normalizeEntity));
		}));
		return "reloaded";
	} catch (error) {
		onError(error);
		return "failed";
	}
}

export type CampaignSessionCreationPlan =
	| { kind: "cancelled" }
	| { kind: "create"; name: string };

export function getCampaignSessionCreationPlan(
	promptValue: unknown,
): CampaignSessionCreationPlan {
	if (promptValue === null) return { kind: "cancelled" };
	return {
		kind: "create",
		name: typeof promptValue === "string" ? promptValue : "",
	};
}

export type CampaignSessionCreationOutcome = "created" | "cancelled" | "failed";

type CampaignCreatedSession = SessionRecord & { fileName: string };

interface ExecuteCampaignSessionCreationOptions {
	campaignSlug: string;
	plan: CampaignSessionCreationPlan;
	createSession: (
		campaignSlug: string,
		name: string,
	) => Promise<SessionRecord | null>;
	onCreated: (session: CampaignCreatedSession) => void;
	onError: (error: unknown) => void;
}

export async function executeCampaignSessionCreation({
	campaignSlug,
	plan,
	createSession,
	onCreated,
	onError,
}: ExecuteCampaignSessionCreationOptions): Promise<CampaignSessionCreationOutcome> {
	if (plan.kind === "cancelled") return "cancelled";
	try {
		const session = await createSession(campaignSlug, plan.name);
		if (!session || typeof session.fileName !== "string" || !session.fileName) {
			throw new Error("Session creation returned no session");
		}
		onCreated({ ...session, fileName: session.fileName });
		return "created";
	} catch (error) {
		onError(error);
		return "failed";
	}
}

export type CampaignRenamePlan =
	| { kind: "cancelled" }
	| { kind: "rename"; name: string };

export function getCampaignRenamePlan(
	promptValue: unknown,
	currentName: string,
): CampaignRenamePlan {
	if (typeof promptValue !== "string") return { kind: "cancelled" };
	if (!promptValue || promptValue === currentName) return { kind: "cancelled" };
	return { kind: "rename", name: promptValue };
}

export type CampaignRenameOutcome = "renamed" | "cancelled" | "failed";

interface ExecuteCampaignRenameOptions {
	campaignSlug: string;
	plan: CampaignRenamePlan;
	renameCampaign: (
		campaignSlug: string,
		patch: { name: string },
	) => Promise<CampaignRecord | null>;
	onRenamed: (campaign: CampaignRecord) => void;
	onError: (error: unknown) => void;
}

export async function executeCampaignRename({
	campaignSlug,
	plan,
	renameCampaign,
	onRenamed,
	onError,
}: ExecuteCampaignRenameOptions): Promise<CampaignRenameOutcome> {
	if (plan.kind === "cancelled") return "cancelled";
	try {
		const campaign = await renameCampaign(campaignSlug, { name: plan.name });
		if (!campaign) throw new Error("Campaign rename returned no campaign");
		onRenamed(campaign);
		return "renamed";
	} catch (error) {
		onError(error);
		return "failed";
	}
}

type CampaignTranslate = (
	key: unknown,
	variables?: Record<string, unknown>,
) => string;

export function getCampaignSessionCreationErrorMessage(
	error: unknown,
	translate: CampaignTranslate,
): string {
	const status = getCampaignErrorStatus(error);
	if (!status) return getCampaignErrorMessage(error);
	return `[${translate("Status")}: ${String(status)}] ${getCampaignErrorMessage(error)}`;
}

export function getCampaignRenameErrorMessage(
	error: unknown,
	translate: CampaignTranslate,
): string {
	return translate("Failed to rename campaign: {error}", {
		error: getCampaignErrorMessage(error),
	});
}

function getCampaignErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function getCampaignErrorStatus(error: unknown): unknown {
	return error && typeof error === "object" && "status" in error
		? error.status
		: null;
}
