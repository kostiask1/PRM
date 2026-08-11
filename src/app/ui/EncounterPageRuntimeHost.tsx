import { useCallback, useMemo, type ReactNode } from "react";

import {
	EncounterPageRuntimeProvider,
	type EncounterPageRuntime,
} from "../../pages/encounter/index.js";
import {
	alert,
	prompt,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
	requestDiceRollAction,
	setActiveEncounterAction,
	setActiveSessionAction,
	setUiSettingsAction,
} from "../../shared/model/index.js";
import { navigateTo, useAppDispatch, useAppSelector } from "../model/index.js";

export default function EncounterPageRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const dispatch = useAppDispatch();
	const activeCampaign = useAppSelector(
		(state) => state.active.campaign,
	) as EncounterPageRuntime["activeCampaign"];
	const activeSessionFileName = useAppSelector(
		(state) => state.navigation.activeSessionFileName,
	);
	const activeEncounterId = useAppSelector(
		(state) => state.navigation.activeEncounterId,
	);
	const syncEvent = useAppSelector(
		(state) => state.sync.event,
	) as EncounterPageRuntime["syncEvent"];
	const diceRolledResult = useAppSelector(
		(state) => state.dice.rolledResult,
	) as EncounterPageRuntime["diceRolledResult"];
	const theme = useAppSelector(
		(state) => state.ui.theme,
	) as EncounterPageRuntime["theme"];
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	) as EncounterPageRuntime["currentLanguage"];
	const encounterViewMode = useAppSelector(
		(state) => state.ui.encounterViewMode,
	);
	const encounterGridColumns = useAppSelector(
		(state) => state.ui.encounterGridColumns,
	);
	const navigateToSession = useCallback<
		EncounterPageRuntime["navigateToSession"]
	>((campaignSlug, sessionFileName) => {
		navigateTo(campaignSlug, sessionFileName);
	}, []);
	const patchUiSettings = useCallback<
		EncounterPageRuntime["patchUiSettings"]
	>((patch) => {
		dispatch(setUiSettingsAction(patch));
	}, [dispatch]);
	const refreshEntities = useCallback<EncounterPageRuntime["refreshEntities"]>(
		() => {
			dispatch(refreshEntitiesAction());
		},
		[dispatch],
	);
	const requestCampaignReload = useCallback<
		EncounterPageRuntime["requestCampaignReload"]
	>(() => {
		dispatch(requestCampaignsReloadAction());
	}, [dispatch]);
	const requestDiceRoll = useCallback<
		EncounterPageRuntime["requestDiceRoll"]
	>((request) => {
		dispatch(requestDiceRollAction(request));
	}, [dispatch]);
	const requestPrompt = useCallback<EncounterPageRuntime["requestPrompt"]>(
		(copy) => dispatch(prompt(copy)),
		[dispatch],
	);
	const setActiveEncounter = useCallback<
		EncounterPageRuntime["setActiveEncounter"]
	>((encounter) => {
		dispatch(setActiveEncounterAction(encounter));
	}, [dispatch]);
	const setActiveSession = useCallback<
		EncounterPageRuntime["setActiveSession"]
	>((session) => {
		dispatch(setActiveSessionAction(session));
	}, [dispatch]);
	const showMessage = useCallback<EncounterPageRuntime["showMessage"]>(
		(message) => {
			dispatch(alert(message));
		},
		[dispatch],
	);
	const runtime = useMemo<EncounterPageRuntime>(
		() => ({
			activeCampaign,
			activeEncounterId,
			activeSessionFileName,
			currentLanguage,
			diceRolledResult,
			encounterGridColumns,
			encounterViewMode,
			navigateToSession,
			patchUiSettings,
			refreshEntities,
			requestCampaignReload,
			requestDiceRoll,
			requestPrompt,
			setActiveEncounter,
			setActiveSession,
			showMessage,
			syncEvent,
			theme,
		}),
		[
			activeCampaign,
			activeEncounterId,
			activeSessionFileName,
			currentLanguage,
			diceRolledResult,
			encounterGridColumns,
			encounterViewMode,
			navigateToSession,
			patchUiSettings,
			refreshEntities,
			requestCampaignReload,
			requestDiceRoll,
			requestPrompt,
			setActiveEncounter,
			setActiveSession,
			showMessage,
			syncEvent,
			theme,
		],
	);

	return (
		<EncounterPageRuntimeProvider runtime={runtime}>
			{children}
		</EncounterPageRuntimeProvider>
	);
}
