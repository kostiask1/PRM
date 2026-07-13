import { useCallback, useState } from "react";

import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";

export function useCampaignEntityScopeMovement({
	campaignSlug,
	session,
	setSession,
	confirmMove,
	flushPendingSave,
	onMoved,
	onError,
}) {
	const [scopeImportModal, setScopeImportModal] = useState(null);

	const openCampaignScopeImport = useCallback(
		async (type) => {
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
		async (type, entity) => {
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
				setSession(result.session);
				setScopeImportModal((current) =>
					current
						? {
							...current,
							items: current.items.filter((item) => item.slug !== entity.slug),
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
		async (type, id) => {
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
