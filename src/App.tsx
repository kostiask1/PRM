import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { campaignApi } from "./entities/campaign/index.js";
import { backupApi } from "./features/backup/index.js";
import { DiceRequestRuntimeProvider } from "./features/dice/index.js";
import { AiAttachmentAlertRuntimeProvider } from "./features/ai/ui/index.js";
import MainContent from "./app/routing/MainContent.tsx";
import CampaignEntityCreationRuntimeHost from "./app/ui/CampaignEntityCreationRuntimeHost.tsx";
import DiceCalculatorHost from "./app/ui/DiceCalculatorHost.tsx";
import ImageGalleryRuntimeHost from "./app/ui/ImageGalleryRuntimeHost.tsx";
import HistoryFocusRuntimeHost from "./app/ui/HistoryFocusRuntimeHost.tsx";
import MessageBoxHost from "./app/ui/MessageBoxHost.tsx";
import MentionPickerModalHost from "./app/ui/MentionPickerModalHost.tsx";
import SidebarRuntimeHost from "./app/ui/SidebarRuntimeHost.tsx";
import {
	CharacterCard,
	LocationCard,
} from "./widgets/campaign-entity-card/index.js";
import { CampaignEntityModalProvider } from "./widgets/campaign-entity-modal/index.js";
import { Icon, Modal } from "./shared/ui/index.js";
import { Sidebar } from "./widgets/sidebar/index.js";
import {
	EditableFieldEntityLinkProvider,
	EditorMentionPickerRuntimeProvider,
	type EditableFieldEntityLinkRuntime,
} from "./features/editor/ui/index.js";
import { SimplifiedNotesProvider } from "./features/notes/ui/index.js";
import { RulesReferenceRuntimeProvider } from "./features/rules-reference/index.js";
import {
	EntityLinkContext,
	EntityLinkResolverContext,
	EntityModal,
	openEntityLinkModal,
} from "./features/entity-link/index.js";
import { useCampaignCreationModal } from "./features/campaign-create/index.js";
import {
	RulesReferenceModalHost,
	RulesReferenceModalRuntimeProvider,
} from "./widgets/rules-reference-modal/index.js";
import {
	MonsterStatBlock,
	MonsterStatBlockRuntimeProvider,
} from "./widgets/monster-stat-block/index.js";
import {
	SpellsBrowser,
	SpellsBrowserRuntimeProvider,
} from "./widgets/spells-browser/index.js";
import { lang } from "./shared/lib/index.js";
import {
	alert,
	requestCampaignsReloadAction,
} from "./shared/model/index.js";
import { initRealtimeSync } from "./app/realtime/index.js";
import {
	navigateTo,
	resolveModalRequest,
	setRouterNavigate,
	syncNavigationFromPath,
} from "./app/model/index.js";
import { useAppBootstrap } from "./app/model/useAppBootstrap.ts";
import { useCampaignCompletionToggle } from "./app/model/useCampaignCompletionToggle.ts";
import { useMobileSidebar } from "./app/model/useMobileSidebar.ts";
import { useAppRuntimes } from "./app/model/useAppRuntimes.ts";
import { useAppModifierKey } from "./app/model/useAppModifierKey.ts";

const APP_EDITABLE_FIELD_ENTITY_LINK_RUNTIME = Object.freeze({
	EntityLinkContext,
	EntityLinkResolverContext,
	EntityModal,
	openEntityLinkModal,
}) satisfies EditableFieldEntityLinkRuntime;

export default function App() {
	const location = useLocation();
	const routerNavigate = useNavigate();
	const isCTRLPressed = useAppModifierKey();
	const {
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
		openModal,
		closeModal,
	} = useAppRuntimes();

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

	const [isMobileSidebarOpen, setMobileSidebarOpen] = useMobileSidebar(
		location.pathname,
	);

	useAppBootstrap({
		dispatch,
		campaignsReloadVersion,
		currentTheme,
		syncEvent,
	});
	const handleToggleCampaignStatus = useCampaignCompletionToggle(dispatch);
	const openCreateCampaignModal = useCampaignCreationModal({
		openModal,
		closeModal,
		createCampaign: campaignApi.createCampaign,
		importCampaign: (file) => backupApi.importArchive(file, "campaign"),
		requestCampaignsReload: () => dispatch(requestCampaignsReloadAction()),
		navigateToCampaign: (slug) => navigateTo(slug),
		reportError: (error) => dispatch(alert(error)),
	});

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
						<HistoryFocusRuntimeHost />
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
