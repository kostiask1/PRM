import { useMemo } from "react";
import { type AiAttachmentAlertRuntime } from "../../features/ai/ui/index.js";
import { type DiceRequestRuntime } from "../../features/dice/index.js";
import { type EditorMentionPickerRuntime } from "../../features/editor/ui/index.js";
import { type RulesReferenceRuntime } from "../../features/rules-reference/index.js";
import {
	alert,
	confirm,
	openMentionPickerAction,
	recordRulesReferenceHistoryEntryAction,
	requestDiceRollAction,
	requestCampaignsReloadAction,
	requestRulesReferenceNavigationAction,
	refreshEntitiesAction,
	setCampaignsAction,
	setRulesReferenceHistoryIndexAction,
	setRulesReferenceModalOpenAction,
	setUiSettingsAction,
} from "../../shared/model/index.js";
import {
	type CampaignEntityModalRuntime,
} from "../../widgets/campaign-entity-modal/index.js";
import {
	type MonsterStatBlockRuntime,
} from "../../widgets/monster-stat-block/index.js";
import {
	type RulesReferenceModalRuntime,
} from "../../widgets/rules-reference-modal/index.js";
import {
	type SpellsBrowserRuntime,
} from "../../widgets/spells-browser/index.js";
import {
	closeActiveModal,
	openModalRequest,
	useAppDispatch,
	useAppSelector,
} from "./appStore.ts";
import { type CampaignCompletionRecord } from "./useCampaignCompletionToggle.ts";

export function useAppRuntimes() {
	const dispatch = useAppDispatch();
	const modalState = useAppSelector((store) => store.modal);
	const campaigns = useAppSelector(
		(store) => store.campaigns.items as CampaignCompletionRecord[],
	);
	const campaignsReloadVersion = useAppSelector(
		(store) => store.campaigns.reloadVersion,
	);
	const { activeCampaignSlug } = useAppSelector((store) => store.navigation);
	const currentLanguage = useAppSelector(
		(store) => store.localization.language,
	);
	const currentTheme = useAppSelector((store) => store.ui.theme);
	const simplifiedNotesEnabled = useAppSelector(
		(store) => store.ui.simplifiedNotes,
	);
	const syncEvent = useAppSelector((store) => store.sync.event);
	const spellsBrowserUseSearchDebounce = useAppSelector(
		(store) => store.ui.useSearchDebounce !== false,
	);
	const spellsBrowserActiveCampaign = useAppSelector(
		(store) => store.active.campaign,
	);
	const spellsBrowserGlobalIgnoreSourcesList = useAppSelector(
		(store) => store.ui.ignoreSourcesList,
	);
	const rulesReferenceModalNavigationRequest = useAppSelector(
		(store) => store.rulesReference.navigationRequest,
	);
	const rulesReferenceModalNavigationHistory = useAppSelector(
		(store) => store.rulesReference.history,
	);
	const rulesReferenceModalIsOpen = useAppSelector(
		(store) => store.rulesReference.isOpen,
	);
	const rulesReferenceRuntime = useMemo<RulesReferenceRuntime>(
		() => ({
			navigate(tab, name) {
				dispatch(requestRulesReferenceNavigationAction(tab, name));
			},
			reportError(error) {
				dispatch(alert(error));
			},
		}),
		[dispatch],
	);
	const aiAttachmentAlertRuntime = useMemo<AiAttachmentAlertRuntime>(
		() => ({
			showAlert(copy) {
				dispatch(alert({ title: copy.title, message: copy.message }));
			},
		}),
		[dispatch],
	);
	const editorMentionPickerRuntime = useMemo<EditorMentionPickerRuntime>(
		() => ({
			openMentionPicker(request) {
				dispatch(openMentionPickerAction(request));
			},
		}),
		[dispatch],
	);
	const diceRequestRuntime = useMemo<DiceRequestRuntime>(
		() => ({
			requestRoll(payload) {
				dispatch(requestDiceRollAction(payload));
			},
		}),
		[dispatch],
	);
	const campaignEntityModalRuntime = useMemo<CampaignEntityModalRuntime>(
		() => ({
			requestConfirmation(payload) {
				return dispatch(confirm(payload));
			},
			refreshEntities() {
				dispatch(refreshEntitiesAction());
			},
		}),
		[dispatch],
	);
	const monsterStatBlockCommands = useMemo<
		Pick<
			MonsterStatBlockRuntime,
			| "openModal"
			| "reportError"
			| "requestCampaignsReload"
			| "closeModal"
			| "requestDiceRoll"
		>
	>(
		() => ({
			openModal(config) {
				return openModalRequest(config);
			},
			reportError(error) {
				dispatch(alert(error));
			},
			requestCampaignsReload() {
				dispatch(requestCampaignsReloadAction());
			},
			closeModal(value) {
				closeActiveModal(value);
			},
			requestDiceRoll(formula) {
				dispatch(requestDiceRollAction(formula));
			},
		}),
		[dispatch],
	);
	const monsterStatBlockRuntime = useMemo<MonsterStatBlockRuntime>(
		() => ({
			campaigns,
			...monsterStatBlockCommands,
		}),
		[campaigns, monsterStatBlockCommands],
	);
	const spellsBrowserCommands = useMemo<
		Pick<
			SpellsBrowserRuntime,
			"replaceCampaigns" | "setGlobalIgnoreSourcesList" | "reportError"
		>
	>(
		() => ({
			replaceCampaigns(nextCampaigns) {
				dispatch(setCampaignsAction(nextCampaigns));
			},
			setGlobalIgnoreSourcesList(ignoreSourcesList) {
				dispatch(setUiSettingsAction({ ignoreSourcesList }));
			},
			reportError(error) {
				dispatch(alert(error));
			},
		}),
		[dispatch],
	);
	const spellsBrowserRuntime = useMemo<SpellsBrowserRuntime>(
		() => ({
			useSearchDebounce: spellsBrowserUseSearchDebounce,
			activeCampaignSlug,
			activeCampaign: spellsBrowserActiveCampaign,
			globalIgnoreSourcesList: spellsBrowserGlobalIgnoreSourcesList,
			...spellsBrowserCommands,
		}),
		[
			activeCampaignSlug,
			spellsBrowserActiveCampaign,
			spellsBrowserCommands,
			spellsBrowserGlobalIgnoreSourcesList,
			spellsBrowserUseSearchDebounce,
		],
	);
	const rulesReferenceModalCommands = useMemo<
		Pick<
			RulesReferenceModalRuntime,
			| "openModal"
			| "reportError"
			| "setModalOpen"
			| "recordHistoryEntry"
			| "setHistoryIndex"
		>
	>(
		() => ({
			openModal(config) {
				return openModalRequest(config);
			},
			reportError(error) {
				dispatch(alert(error));
			},
			setModalOpen(isOpen) {
				dispatch(setRulesReferenceModalOpenAction(isOpen));
			},
			recordHistoryEntry(tabId, name) {
				dispatch(recordRulesReferenceHistoryEntryAction(tabId, name));
			},
			setHistoryIndex(index) {
				dispatch(setRulesReferenceHistoryIndexAction(index));
			},
		}),
		[dispatch],
	);
	const rulesReferenceModalRuntime = useMemo<RulesReferenceModalRuntime>(
		() => ({
			navigationRequest: rulesReferenceModalNavigationRequest,
			navigationHistory: rulesReferenceModalNavigationHistory,
			isOpen: rulesReferenceModalIsOpen,
			...rulesReferenceModalCommands,
		}),
		[
			rulesReferenceModalCommands,
			rulesReferenceModalIsOpen,
			rulesReferenceModalNavigationHistory,
			rulesReferenceModalNavigationRequest,
		],
	);

	return {
		dispatch,
		modalState,
		campaigns,
		campaignsReloadVersion,
		activeCampaignSlug,
		currentLanguage,
		currentTheme,
		simplifiedNotesEnabled,
		syncEvent,
		rulesReferenceRuntime,
		aiAttachmentAlertRuntime,
		editorMentionPickerRuntime,
		diceRequestRuntime,
		campaignEntityModalRuntime,
		monsterStatBlockRuntime,
		spellsBrowserRuntime,
		rulesReferenceModalRuntime,
		openModal: openModalRequest,
		closeModal: closeActiveModal,
	};
}
