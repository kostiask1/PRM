import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { campaignApi } from "./entities/campaign/index.js";
import { backupApi } from "./features/backup/index.js";

const api = { ...campaignApi, ...backupApi };
import {
	DiceRequestRuntimeProvider,
	type DiceRequestRuntime,
} from "./features/dice/index.js";
import {
	AiAttachmentAlertRuntimeProvider,
	type AiAttachmentAlertRuntime,
} from "./features/ai/ui/index.js";
import MainContent from "./app/routing/MainContent.tsx";
import CampaignEntityCreationRuntimeHost from "./app/ui/CampaignEntityCreationRuntimeHost.tsx";
import DiceCalculatorHost from "./app/ui/DiceCalculatorHost.tsx";
import ImageGalleryRuntimeHost from "./app/ui/ImageGalleryRuntimeHost.tsx";
import MessageBoxHost from "./app/ui/MessageBoxHost.tsx";
import MentionPickerModalHost from "./app/ui/MentionPickerModalHost.tsx";
import SidebarRuntimeHost from "./app/ui/SidebarRuntimeHost.tsx";
import {
	CharacterCard,
	LocationCard,
} from "./widgets/campaign-entity-card/index.js";
import {
	CampaignEntityModalProvider,
	type CampaignEntityModalRuntime,
} from "./widgets/campaign-entity-modal/index.js";
import { Icon, Modal } from "./shared/ui/index.js";
import { Sidebar } from "./widgets/sidebar/index.js";
import {
	EditableFieldEntityLinkProvider,
	EditorMentionPickerRuntimeProvider,
	type EditableFieldEntityLinkRuntime,
	type EditorMentionPickerRuntime,
} from "./features/editor/ui/index.js";
import { SimplifiedNotesProvider } from "./features/notes/ui/index.js";
import {
	RulesReferenceRuntimeProvider,
	type RulesReferenceRuntime,
} from "./features/rules-reference/index.js";
import {
	EntityLinkContext,
	EntityLinkResolverContext,
	EntityModal,
	openEntityLinkModal,
} from "./features/entity-link/index.js";
import { CreateCampaignModalContent } from "./features/campaign-create/index.js";
import {
	RulesReferenceModalHost,
	RulesReferenceModalRuntimeProvider,
	type RulesReferenceModalRuntime,
} from "./widgets/rules-reference-modal/index.js";
import {
	MonsterStatBlock,
	MonsterStatBlockRuntimeProvider,
	type MonsterStatBlockRuntime,
} from "./widgets/monster-stat-block/index.js";
import {
	SpellsBrowser,
	SpellsBrowserRuntimeProvider,
	type SpellsBrowserRuntime,
} from "./widgets/spells-browser/index.js";
import { lang } from "./shared/lib/index.js";
import {
	alert,
	confirm,
	openMentionPickerAction,
	recordRulesReferenceHistoryEntryAction,
	requestDiceRollAction,
	requestCampaignsReloadAction,
	requestRulesReferenceNavigationAction,
	refreshEntitiesAction,
	setRulesReferenceHistoryIndexAction,
	setRulesReferenceModalOpenAction,
} from "./shared/model/index.js";
import type { CampaignRecord } from "./entities/campaign/index.js";
import {
	getAppErrorMessage,
	getCampaignCompletionPlan,
	isEditableAppTarget,
} from "./app/model/appShellPresentation.ts";

interface AppCampaign extends CampaignRecord {
	completed?: boolean;
	completedAt?: string | null;
}

import { initRealtimeSync } from "./app/realtime/index.js";
import {
	closeActiveModal,
	navigateTo,
	openModalRequest,
	resolveModalRequest,
	setRouterNavigate,
	syncNavigationFromPath,
	useAppDispatch,
	useAppSelector,
} from "./app/model/index.js";
import { useAppBootstrap } from "./app/model/useAppBootstrap.ts";

const APP_EDITABLE_FIELD_ENTITY_LINK_RUNTIME = Object.freeze({
	EntityLinkContext,
	EntityLinkResolverContext,
	EntityModal,
	openEntityLinkModal,
}) satisfies EditableFieldEntityLinkRuntime;

export default function App() {
	const dispatch = useAppDispatch();
	const location = useLocation();
	const routerNavigate = useNavigate();
	const [isCTRLPressed, setCTRLPressed] = useState(false);
	const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
	const modalState = useAppSelector((store) => store.modal);
	const campaigns = useAppSelector(
		(store) => store.campaigns.items as AppCampaign[],
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

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (isEditableAppTarget(e.target)) return;
			if (e.ctrlKey || e.metaKey) {
				setCTRLPressed(true);
			}
		};
		const handleKeyUp = (e: KeyboardEvent) => {
			if (isEditableAppTarget(e.target)) return;
			if (!e.ctrlKey && !e.metaKey) {
				setCTRLPressed(false);
			}
		};
		const handleMouseUp = () => setCTRLPressed(false);

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("keyup", handleKeyUp);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("keyup", handleKeyUp);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, []);

	useEffect(() => {
		initRealtimeSync();
	}, []);

	useEffect(() => {
		setRouterNavigate(routerNavigate);
		return () => setRouterNavigate(null);
	}, [routerNavigate]);

	useEffect(() => {
		syncNavigationFromPath(location.pathname);
	}, [location.pathname]);

	useEffect(() => {
		setMobileSidebarOpen(false);
	}, [location.pathname]);

	useEffect(() => {
		document.body.classList.toggle(
			"is-mobile-sidebar-open",
			isMobileSidebarOpen,
		);

		return () => {
			document.body.classList.remove("is-mobile-sidebar-open");
		};
	}, [isMobileSidebarOpen]);

	useEffect(() => {
		if (!isMobileSidebarOpen) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setMobileSidebarOpen(false);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isMobileSidebarOpen]);

	useAppBootstrap({
		dispatch,
		campaignsReloadVersion,
		currentTheme,
		syncEvent,
	});

	const handleToggleCampaignStatus = async (campaign: AppCampaign) => {
		const completion = getCampaignCompletionPlan(
			campaign,
			new Date(),
			(date) => date.toLocaleDateString(),
		);
		let completedAt = completion.completedAt;

		if (completion.requiresDateConfirmation) {
				const confirmUpdate = await dispatch(
					confirm({
						title: lang.t("Update completion date"),
						message: lang.t(
							"Campaign was already completed on {date}. Update completion date to today?",
							{ date: completion.previousDateLabel },
						),
					}),
				);
				if (confirmUpdate) completedAt = completion.nextCompletedAt;
		} else if (completion.completed) {
			completedAt = completion.nextCompletedAt;
		}

		try {
			await api.updateCampaign(campaign.slug, {
				completed: completion.completed,
				completedAt,
			});
			dispatch(requestCampaignsReloadAction());
		} catch (err) {
			console.error("Failed to toggle campaign status", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to update campaign status"),
				}),
			);
		}
	};

	const openCreateCampaignModal = () => {
		const handleClose = () => closeActiveModal();
		openModalRequest({
			title: lang.t("New campaign"),
			type: "confirm",
			showFooter: false,
			children: (
				<CreateCampaignModalContent
					onClose={handleClose}
					onCreateCampaign={async (name) => {
						if (!name?.trim()) return;
						try {
							const newCampaign = await api.createCampaign(name.trim());
							if (!newCampaign) throw new Error("Campaign creation returned no result");
							dispatch(requestCampaignsReloadAction());
							handleClose();
							navigateTo(newCampaign.slug);
						} catch (err) {
							dispatch(
								alert({
									title: lang.t("Error"),
									message: getAppErrorMessage(err, lang.t("Failed to create campaign")),
								}),
							);
						}
					}}
					onImportCampaign={async (file) => {
						try {
							await api.importArchive(file, "campaign");
							dispatch(requestCampaignsReloadAction());
							handleClose();
						} catch (err) {
							dispatch(
								alert({
									title: lang.t("Import error"),
									message: getAppErrorMessage(err, lang.t("Failed to import campaign")),
								}),
							);
						}
					}}
				/>
			),
		});
	};

	return (
		<ImageGalleryRuntimeHost>
			<SidebarRuntimeHost>
			<CampaignEntityCreationRuntimeHost>
				<DiceRequestRuntimeProvider runtime={diceRequestRuntime}>
				<EditorMentionPickerRuntimeProvider runtime={editorMentionPickerRuntime}>
					<AiAttachmentAlertRuntimeProvider runtime={aiAttachmentAlertRuntime}>
				<RulesReferenceRuntimeProvider runtime={rulesReferenceRuntime}>
					<RulesReferenceModalRuntimeProvider
						runtime={rulesReferenceModalRuntime}
					>
					<MonsterStatBlockRuntimeProvider runtime={monsterStatBlockRuntime}>
					<SpellsBrowserRuntimeProvider runtime={spellsBrowserRuntime}>
					<SimplifiedNotesProvider
						simplifiedNotesEnabled={simplifiedNotesEnabled}
				>
						<EditableFieldEntityLinkProvider
							runtime={APP_EDITABLE_FIELD_ENTITY_LINK_RUNTIME}
					>
						<div className="App" data-lang={currentLanguage}>
					<CampaignEntityModalProvider
						CharacterCard={CharacterCard}
						LocationCard={LocationCard}
						runtime={campaignEntityModalRuntime}
						campaignSlug={activeCampaignSlug}
					>
						<button
							type="button"
							className="App__mobileNavButton"
							aria-label={
								isMobileSidebarOpen
									? lang.t("Close navigation")
									: lang.t("Open navigation")
							}
							aria-expanded={isMobileSidebarOpen}
							onClick={() => setMobileSidebarOpen((isOpen) => !isOpen)}
						>
							<Icon name={isMobileSidebarOpen ? "x" : "menu"} size={22} />
						</button>
						{isMobileSidebarOpen && (
							<button
								type="button"
								className="App__sidebarBackdrop"
								aria-label={lang.t("Close navigation")}
								onClick={() => setMobileSidebarOpen(false)}
							/>
						)}
						<Sidebar
							campaigns={campaigns}
							activeCampaignId={activeCampaignSlug}
							isMobileOpen={isMobileSidebarOpen}
							onClose={() => setMobileSidebarOpen(false)}
							onSelectCampaign={(slug) => {
								setMobileSidebarOpen(false);
								navigateTo(slug, null, false, null, isCTRLPressed);
							}}
							onCreateCampaign={() => {
								setMobileSidebarOpen(false);
								openCreateCampaignModal();
							}}
							onToggleCampaignStatus={handleToggleCampaignStatus}
						/>
						<MainContent />

						{modalState.config && (
							<Modal
								{...modalState.config}
								onConfirm={(value) =>
									resolveModalRequest(modalState.requestId, value)
								}
								onCancel={
									modalState.config?.isAlert
										? null
										: () => {
												const cancelAction = modalState.config?.onCancelAction;
												if (typeof cancelAction === "function") cancelAction();
												resolveModalRequest(modalState.requestId, null);
											}
								}
							/>
						)}
						<MessageBoxHost />
						<DiceCalculatorHost />
						<MentionPickerModalHost />
						<RulesReferenceModalHost
							MonsterStatBlock={MonsterStatBlock}
							SpellsBrowser={SpellsBrowser}
						/>
					</CampaignEntityModalProvider>
						</div>
						</EditableFieldEntityLinkProvider>
					</SimplifiedNotesProvider>
					</SpellsBrowserRuntimeProvider>
					</MonsterStatBlockRuntimeProvider>
					</RulesReferenceModalRuntimeProvider>
				</RulesReferenceRuntimeProvider>
					</AiAttachmentAlertRuntimeProvider>
				</EditorMentionPickerRuntimeProvider>
				</DiceRequestRuntimeProvider>
			</CampaignEntityCreationRuntimeHost>
			</SidebarRuntimeHost>
		</ImageGalleryRuntimeHost>
	);
}
