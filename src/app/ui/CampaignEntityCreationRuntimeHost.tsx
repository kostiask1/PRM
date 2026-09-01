import { useCallback, useMemo, type ReactNode } from "react";

import {
	CampaignEntityCreationRuntimeProvider,
	type CampaignEntityCreationRuntime,
} from "../../widgets/campaign-entity-card/index.js";
import { alert, refreshEntitiesAction } from "../../shared/model/index.js";
import { useAppDispatch } from "../model/index.js";

export default function CampaignEntityCreationRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const dispatch = useAppDispatch();
	const notifyError = useCallback<CampaignEntityCreationRuntime["notifyError"]>(
		(payload) => {
			dispatch(alert(payload));
		},
		[dispatch],
	);
	const refreshEntities = useCallback<
		CampaignEntityCreationRuntime["refreshEntities"]
	>(() => {
		dispatch(refreshEntitiesAction());
	}, [dispatch]);
	const runtime = useMemo<CampaignEntityCreationRuntime>(
		() => ({ notifyError, refreshEntities }),
		[notifyError, refreshEntities],
	);

	return (
		<CampaignEntityCreationRuntimeProvider runtime={runtime}>
			{children}
		</CampaignEntityCreationRuntimeProvider>
	);
}
