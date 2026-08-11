import { useCallback, useMemo, type ReactNode } from "react";

import {
	AiAssistantRuntimeProvider,
	type AiAssistantRuntime,
} from "../../widgets/ai-assistant/index.js";
import {
	alert,
	confirm,
	dataSyncReceivedAction,
	refreshEntitiesAction,
	requestCampaignsReloadAction,
	setActiveCampaignAction,
	setActiveEncounterAction,
	setActiveSessionAction,
} from "../../shared/model/index.js";
import { useAppDispatch, useAppSelector } from "../model/index.js";

export default function AiAssistantRuntimeHost({
	children,
}: {
	children?: ReactNode;
}) {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const activeSession = useAppSelector((state) => state.active.session);
	const activeEncounter = useAppSelector((state) => state.active.encounter);
	const imagePromptBasePrompt = useAppSelector(
		(state) => state.ui.imagePromptBasePrompt || "",
	);
	const globalAiBasePrompt = useAppSelector(
		(state) => state.ui.aiBasePrompt || "",
	);
	const campaignAiBasePrompts = useAppSelector(
		(state) => state.ui.campaignAiBasePrompts || {},
	);
	const campaignImagePromptBasePrompts = useAppSelector(
		(state) => state.ui.campaignImagePromptBasePrompts || {},
	);
	const navigation = useAppSelector(
		(state) => state.navigation,
	) as AiAssistantRuntime["navigation"];
	const setActiveCampaign = useCallback<
		AiAssistantRuntime["setActiveCampaign"]
	>(
		(campaign) => {
			dispatch(setActiveCampaignAction(campaign));
		},
		[dispatch],
	);
	const setActiveSession = useCallback<
		AiAssistantRuntime["setActiveSession"]
	>(
		(session) => {
			dispatch(setActiveSessionAction(session));
		},
		[dispatch],
	);
	const setActiveEncounter = useCallback<
		AiAssistantRuntime["setActiveEncounter"]
	>(
		(encounter) => {
			dispatch(setActiveEncounterAction(encounter));
		},
		[dispatch],
	);
	const requestCampaignReload = useCallback<
		AiAssistantRuntime["requestCampaignReload"]
	>(
		() => {
			dispatch(requestCampaignsReloadAction());
		},
		[dispatch],
	);
	const refreshEntities = useCallback<AiAssistantRuntime["refreshEntities"]>(
		() => {
			dispatch(refreshEntitiesAction());
		},
		[dispatch],
	);
	const publishSyncEvent = useCallback<
		AiAssistantRuntime["publishSyncEvent"]
	>(
		(event) => {
			dispatch(dataSyncReceivedAction(event));
		},
		[dispatch],
	);
	const requestConfirmation = useCallback<
		AiAssistantRuntime["requestConfirmation"]
	>(
		(copy) => dispatch(confirm(copy)),
		[dispatch],
	);
	const showMessage = useCallback<AiAssistantRuntime["showMessage"]>(
		(message) => {
			dispatch(alert(message));
		},
		[dispatch],
	);
	const runtime = useMemo<AiAssistantRuntime>(
		() => ({
			activeCampaign,
			activeEncounter,
			activeSession,
			campaignAiBasePrompts,
			campaignImagePromptBasePrompts,
			currentLanguage,
			globalAiBasePrompt,
			imagePromptBasePrompt,
			navigation,
			publishSyncEvent,
			refreshEntities,
			requestCampaignReload,
			requestConfirmation,
			setActiveCampaign,
			setActiveEncounter,
			setActiveSession,
			showMessage,
		}),
		[
			activeCampaign,
			activeEncounter,
			activeSession,
			campaignAiBasePrompts,
			campaignImagePromptBasePrompts,
			currentLanguage,
			globalAiBasePrompt,
			imagePromptBasePrompt,
			navigation,
			publishSyncEvent,
			refreshEntities,
			requestCampaignReload,
			requestConfirmation,
			setActiveCampaign,
			setActiveEncounter,
			setActiveSession,
			showMessage,
		],
	);

	return (
		<AiAssistantRuntimeProvider runtime={runtime}>
			{children}
		</AiAssistantRuntimeProvider>
	);
}
