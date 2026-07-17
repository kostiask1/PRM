import {
	useCallback,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import { campaignApi } from "../../../entities/campaign/index.js";
import type { CampaignEntityRecord } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import type {
	EntityScopeMoveResult,
	SessionRecord,
} from "../../../entities/session/index.js";
import type {
	CampaignFeatureEntityId,
	CampaignFeatureEntityType,
} from "./contracts.ts";

type EntityScope = "campaign" | "session";
type ScopeMoveErrorOperation = "load" | "move-to-session" | "move-to-campaign";

interface SessionEntityRecord extends CampaignEntityRecord {
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

interface FlushPendingSaveOptions {
	throwOnError: boolean;
}

interface CampaignEntityScopeMovementOptions {
	campaignSlug: string;
	session: CampaignEntitySession | null | undefined;
	setSession: Dispatch<
		SetStateAction<CampaignEntitySession | SessionRecord | null>
	>;
	confirmMove: (
		targetScope: EntityScope,
		type: CampaignFeatureEntityType,
		entity: CampaignEntityRecord,
	) => boolean | Promise<boolean>;
	flushPendingSave?: (
		options: FlushPendingSaveOptions,
	) => CampaignEntitySession | null | void | Promise<CampaignEntitySession | null | void>;
	onMoved?: (result: EntityScopeMoveResult) => void;
	onError?: (error: unknown, operation: ScopeMoveErrorOperation) => void;
}

export interface CampaignEntityScopeMovement {
	closeScopeImportModal: () => void;
	moveCampaignEntityToSession: (
		type: CampaignFeatureEntityType,
		entity: SessionEntityRecord,
	) => Promise<void>;
	moveSessionEntityToCampaign: (
		type: CampaignFeatureEntityType,
		id: CampaignFeatureEntityId,
	) => Promise<void>;
	openCampaignScopeImport: (
		type: CampaignFeatureEntityType,
	) => Promise<void>;
	scopeImportModal: ScopeImportModalState | null;
}

export function useCampaignEntityScopeMovement({
	campaignSlug,
	session,
	setSession,
	confirmMove,
	flushPendingSave,
	onMoved,
	onError,
}: CampaignEntityScopeMovementOptions): CampaignEntityScopeMovement {
	const [scopeImportModal, setScopeImportModal] =
		useState<ScopeImportModalState | null>(null);

	const openCampaignScopeImport = useCallback(
		async (type: CampaignFeatureEntityType): Promise<void> => {
			setScopeImportModal({ type, items: [], isLoading: true });
			try {
				const items = await campaignApi.getEntities(campaignSlug, type);
				setScopeImportModal({
					type,
					items: Array.isArray(items) ? items : [],
					isLoading: false,
				});
			} catch (error) {
				setScopeImportModal(null);
				onError?.(error, "load");
			}
		},
		[campaignSlug, onError],
	);

	const closeScopeImportModal = useCallback(() => {
		setScopeImportModal(null);
	}, []);

	const moveCampaignEntityToSession = useCallback(
		async (
			type: CampaignFeatureEntityType,
			entity: SessionEntityRecord,
		): Promise<void> => {
			if (!session?.fileName || !entity?.slug) return;
			if (!(await confirmMove("session", type, entity))) return;
			try {
				const flushedSession = await flushPendingSave?.({ throwOnError: true });
				const fileName = flushedSession?.fileName || session.fileName;
				const result = await sessionApi.moveEntityScope(
					campaignSlug,
					fileName,
					type,
					entity.id || entity.slug,
					{ entitySlug: entity.slug, targetScope: "session" },
				);
				if (!result?.session) throw new Error("Entity scope move returned no session");
				setSession(result.session);
				setScopeImportModal((current) =>
					current
						? {
								...current,
								items: current.items.filter(
									(item) => item.slug !== entity.slug,
								),
							}
						: current,
				);
				onMoved?.(result);
			} catch (error) {
				onError?.(error, "move-to-session");
			}
		},
		[
			campaignSlug,
			confirmMove,
			flushPendingSave,
			onError,
			onMoved,
			session?.fileName,
			setSession,
		],
	);

	const moveSessionEntityToCampaign = useCallback(
		async (
			type: CampaignFeatureEntityType,
			id: CampaignFeatureEntityId,
		): Promise<void> => {
			if (!session?.fileName) return;
			const key = type === "locations" ? "locations" : "npcs";
			const entity = (session.data?.[key] || []).find(
				(item) => String(item.id) === String(id),
			);
			if (!entity || !(await confirmMove("campaign", type, entity))) return;
			try {
				const flushedSession = await flushPendingSave?.({ throwOnError: true });
				const fileName = flushedSession?.fileName || session.fileName;
				const result = await sessionApi.moveEntityScope(
					campaignSlug,
					fileName,
					type,
					id,
					{ targetScope: "campaign" },
				);
				if (!result?.session) throw new Error("Entity scope move returned no session");
				setSession(result.session);
				onMoved?.(result);
			} catch (error) {
				onError?.(error, "move-to-campaign");
			}
		},
		[
			campaignSlug,
			confirmMove,
			flushPendingSave,
			onError,
			onMoved,
			session,
			setSession,
		],
	);

	return {
		closeScopeImportModal,
		moveCampaignEntityToSession,
		moveSessionEntityToCampaign,
		openCampaignScopeImport,
		scopeImportModal,
	};
}
