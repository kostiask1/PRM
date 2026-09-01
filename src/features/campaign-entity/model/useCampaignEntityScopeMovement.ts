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
import {
	buildCampaignToSessionScopeMovePlan,
	buildSessionToCampaignScopeMovePlan,
	executeEntityScopeMove,
	removeMovedCampaignEntityFromImport,
	type CampaignEntitySession,
	type EntityScope,
	type EntityScopeMovePlan,
	type FlushPendingSaveOptions,
	type ScopeImportModalState,
	type ScopeMoveErrorOperation,
	type SessionEntityRecord,
} from "./scopeMovement.ts";

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

	const executePlan = useCallback(
		async (plan: EntityScopeMovePlan | null): Promise<void> => {
			if (!plan) return;
			const outcome = await executeEntityScopeMove(plan, {
				campaignSlug,
				confirmMove,
				flushPendingSave,
				api: sessionApi,
			});
			if (outcome.status === "failed") {
				onError?.(outcome.error, plan.operation);
				return;
			}
			if (outcome.status !== "moved") return;

			setSession(outcome.result.session);
			if (plan.operation === "move-to-session") {
				const movedEntitySlug = plan.entitySlug;
				setScopeImportModal((current) =>
					removeMovedCampaignEntityFromImport(current, movedEntitySlug),
				);
			}
			onMoved?.(outcome.result);
		},
		[
			campaignSlug,
			confirmMove,
			flushPendingSave,
			onError,
			onMoved,
			setSession,
		],
	);

	const moveCampaignEntityToSession = useCallback(
		async (
			type: CampaignFeatureEntityType,
			entity: SessionEntityRecord,
		): Promise<void> => {
			await executePlan(
				buildCampaignToSessionScopeMovePlan(session, type, entity),
			);
		},
		[executePlan, session],
	);

	const moveSessionEntityToCampaign = useCallback(
		async (
			type: CampaignFeatureEntityType,
			id: CampaignFeatureEntityId,
		): Promise<void> => {
			await executePlan(
				buildSessionToCampaignScopeMovePlan(session, type, id),
			);
		},
		[executePlan, session],
	);

	return {
		closeScopeImportModal,
		moveCampaignEntityToSession,
		moveSessionEntityToCampaign,
		openCampaignScopeImport,
		scopeImportModal,
	};
}

export type {
	CampaignEntitySession,
	ScopeImportModalState,
} from "./scopeMovement.ts";
