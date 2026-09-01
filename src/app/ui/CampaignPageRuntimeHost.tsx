import { useCallback, useMemo, type ReactNode } from "react";

import {
	CampaignPageRuntimeProvider,
	type CampaignPageRuntime,
} from "../../pages/campaign/index.js";
import {
	alert,
	confirm,
	prompt,
	requestCampaignsReloadAction,
} from "../../shared/model/index.js";
import {
	navigateTo,
	openModalRequest,
	useAppDispatch,
	useAppSelector,
} from "../model/index.js";

export default function CampaignPageRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const dispatch = useAppDispatch();
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const entityRefreshVersion = useAppSelector(
		(state) => state.entityRefreshVersion,
	);
	const syncEvent = useAppSelector(
		(state) => state.sync.event,
	) as CampaignPageRuntime["syncEvent"];
	const theme = useAppSelector(
		(state) => state.ui.theme,
	) as CampaignPageRuntime["theme"];
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const navigateToCampaignList = useCallback<
		CampaignPageRuntime["navigateToCampaignList"]
	>(() => {
		navigateTo(null);
	}, []);
	const navigateToRenamedCampaign = useCallback<
		CampaignPageRuntime["navigateToRenamedCampaign"]
	>((campaignSlug) => {
		navigateTo(campaignSlug, null, true);
	}, []);
	const navigateToSession = useCallback<
		CampaignPageRuntime["navigateToSession"]
	>((campaignSlug, sessionFileName) => {
		navigateTo(campaignSlug, sessionFileName);
	}, []);
	const openModal = useCallback<CampaignPageRuntime["openModal"]>(
		(config) => openModalRequest(config),
		[],
	);
	const requestCampaignReload = useCallback<
		CampaignPageRuntime["requestCampaignReload"]
	>(() => {
		dispatch(requestCampaignsReloadAction());
	}, [dispatch]);
	const requestConfirmation = useCallback<
		CampaignPageRuntime["requestConfirmation"]
	>(
		(copy) => dispatch(confirm(copy)),
		[dispatch],
	);
	const requestPrompt = useCallback<CampaignPageRuntime["requestPrompt"]>(
		(copy) => dispatch(prompt(copy)),
		[dispatch],
	);
	const showMessage = useCallback<CampaignPageRuntime["showMessage"]>(
		(message) => {
			dispatch(alert(message));
		},
		[dispatch],
	);
	const runtime = useMemo<CampaignPageRuntime>(
		() => ({
			activeCampaign,
			currentLanguage,
			entityRefreshVersion,
			navigateToCampaignList,
			navigateToRenamedCampaign,
			navigateToSession,
			openModal,
			requestCampaignReload,
			requestConfirmation,
			requestPrompt,
			showMessage,
			syncEvent,
			theme,
		}),
		[
			activeCampaign,
			currentLanguage,
			entityRefreshVersion,
			navigateToCampaignList,
			navigateToRenamedCampaign,
			navigateToSession,
			openModal,
			requestCampaignReload,
			requestConfirmation,
			requestPrompt,
			showMessage,
			syncEvent,
			theme,
		],
	);

	return (
		<CampaignPageRuntimeProvider runtime={runtime}>
			{children}
		</CampaignPageRuntimeProvider>
	);
}
