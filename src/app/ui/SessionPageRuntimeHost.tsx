import { useCallback, useMemo, type ReactNode } from "react";

import {
	SessionPageRuntimeProvider,
	type SessionPageRuntime,
} from "../../pages/session/index.js";
import {
	alert,
	confirm,
	navigateTo,
	prompt,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
	setActiveSessionAction,
} from "../../shared/model/index.js";
import { useAppDispatch, useAppSelector } from "../model/index.js";

export default function SessionPageRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const dispatch = useAppDispatch();
	const activeCampaign = useAppSelector(
		(state) => state.active.campaign,
	) as SessionPageRuntime["activeCampaign"];
	const activeSessionFileName = useAppSelector(
		(state) => state.navigation.activeSessionFileName,
	);
	const syncEvent = useAppSelector(
		(state) => state.sync.event,
	) as SessionPageRuntime["syncEvent"];
	const setActiveSession = useCallback<
		SessionPageRuntime["setActiveSession"]
	>(
		(session) => {
			dispatch(setActiveSessionAction(session));
		},
		[dispatch],
	);
	const requestCampaignReload = useCallback<
		SessionPageRuntime["requestCampaignReload"]
	>(
		() => {
			dispatch(requestCampaignsReloadAction());
		},
		[dispatch],
	);
	const refreshEntities = useCallback<SessionPageRuntime["refreshEntities"]>(
		() => {
			dispatch(refreshEntitiesAction());
		},
		[dispatch],
	);
	const requestConfirmation = useCallback<
		SessionPageRuntime["requestConfirmation"]
	>(
		(copy) => dispatch(confirm(copy)),
		[dispatch],
	);
	const requestPrompt = useCallback<SessionPageRuntime["requestPrompt"]>(
		(copy) => dispatch(prompt(copy)),
		[dispatch],
	);
	const showMessage = useCallback<SessionPageRuntime["showMessage"]>(
		(message) => {
			dispatch(alert(message));
		},
		[dispatch],
	);
	const navigateToCampaign = useCallback<
		SessionPageRuntime["navigateToCampaign"]
	>((campaignSlug) => {
		navigateTo(campaignSlug, null);
	}, []);
	const navigateToSession = useCallback<
		SessionPageRuntime["navigateToSession"]
	>((campaignSlug, sessionFileName, replace) => {
		navigateTo(campaignSlug, sessionFileName, replace);
	}, []);
	const navigateToEncounter = useCallback<
		SessionPageRuntime["navigateToEncounter"]
	>((campaignSlug, sessionFileName, encounterId, openInNewTab) => {
		navigateTo(
			campaignSlug,
			sessionFileName,
			false,
			encounterId,
			openInNewTab,
		);
	}, []);
	const runtime = useMemo<SessionPageRuntime>(
		() => ({
			activeCampaign,
			activeSessionFileName,
			navigateToCampaign,
			navigateToEncounter,
			navigateToSession,
			refreshEntities,
			requestCampaignReload,
			requestConfirmation,
			requestPrompt,
			setActiveSession,
			showMessage,
			syncEvent,
		}),
		[
			activeCampaign,
			activeSessionFileName,
			navigateToCampaign,
			navigateToEncounter,
			navigateToSession,
			refreshEntities,
			requestCampaignReload,
			requestConfirmation,
			requestPrompt,
			setActiveSession,
			showMessage,
			syncEvent,
		],
	);

	return (
		<SessionPageRuntimeProvider runtime={runtime}>
			{children}
		</SessionPageRuntimeProvider>
	);
}
