import { useCallback, useMemo, type ReactNode } from "react";

import {
	BestiaryBrowserRuntimeProvider,
	type BestiaryBrowserRuntime,
} from "../../widgets/bestiary-browser/index.js";
import {
	alert,
	confirm,
	setCampaignsAction,
	setUiSettingsAction,
} from "../../shared/model/index.js";
import { useAppDispatch, useAppSelector } from "../model/index.js";

export default function BestiaryBrowserRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);
	const activeCampaignSlug = useAppSelector(
		(state) => state.navigation.activeCampaignSlug,
	);
	const activeCampaign = useAppSelector(
		(state) => state.active.campaign,
	) as BestiaryBrowserRuntime["activeCampaign"];
	const globalIgnoreSourcesList = useAppSelector(
		(state) => state.ui.ignoreSourcesList || [],
	);
	const syncEvent = useAppSelector((state) => state.sync.event);
	const replaceCampaigns = useCallback<
		BestiaryBrowserRuntime["replaceCampaigns"]
	>(
		(campaigns) => {
			dispatch(setCampaignsAction(campaigns));
		},
		[dispatch],
	);
	const setGlobalIgnoreSourcesList = useCallback<
		BestiaryBrowserRuntime["setGlobalIgnoreSourcesList"]
	>(
		(ignoreSourcesList) => {
			dispatch(setUiSettingsAction({ ignoreSourcesList }));
		},
		[dispatch],
	);
	const showMessage = useCallback<BestiaryBrowserRuntime["showMessage"]>(
		(message) => {
			dispatch(alert(message));
		},
		[dispatch],
	);
	const requestConfirmation = useCallback<
		BestiaryBrowserRuntime["requestConfirmation"]
	>(
		(copy) => dispatch(confirm(copy)),
		[dispatch],
	);
	const runtime = useMemo<BestiaryBrowserRuntime>(
		() => ({
			activeCampaign,
			activeCampaignSlug,
			currentLanguage,
			globalIgnoreSourcesList,
			requestConfirmation,
			replaceCampaigns,
			showMessage,
			setGlobalIgnoreSourcesList,
			syncEvent,
			useSearchDebounce,
		}),
		[
			activeCampaign,
			activeCampaignSlug,
			currentLanguage,
			globalIgnoreSourcesList,
			requestConfirmation,
			replaceCampaigns,
			showMessage,
			setGlobalIgnoreSourcesList,
			syncEvent,
			useSearchDebounce,
		],
	);

	return (
		<BestiaryBrowserRuntimeProvider runtime={runtime}>
			{children}
		</BestiaryBrowserRuntimeProvider>
	);
}
