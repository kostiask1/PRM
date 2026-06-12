import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { api } from "./api";
import DiceCalculator from "./components/DiceCalculator";
import MainContent from "./components/MainContent";
import MessageBox from "./components/common/MessageBox";
import Modal from "./components/common/Modal";
import CampaignEntityModalProvider from "./components/common/CampaignEntityModalProvider";
import Icon from "./components/common/Icon";
import Sidebar from "./components/Sidebar";
import MentionPickerModalContent from "./components/modals/MentionPickerModalContent";
import CreateCampaignModalContent from "./components/modals/CreateCampaignModalContent";
import RulesReferenceModalHost from "./components/modals/RulesReferenceModalHost";
import { lang } from "./services/localization";
import {
	alert,
	closeMentionPickerAction,
	confirm,
	requestCampaignsReloadAction,
	setLanguageAction,
	setCampaignsAction,
	setUiSettingsAction,
} from "./actions/app";
import { applyTheme } from "./services/uiSettings";
import { initRealtimeSync } from "./services/realtimeSync";
import {
	closeActiveModal,
	navigateTo,
	openModalRequest,
	resolveModalRequest,
	setRouterNavigate,
	syncNavigationFromPath,
	useAppDispatch,
	useAppSelector,
} from "./store/appStore";

export default function App() {
	const dispatch = useAppDispatch();
	const location = useLocation();
	const routerNavigate = useNavigate();
	const [isCTRLPressed, setCTRLPressed] = useState(false);
	const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
	const modalState = useAppSelector((store) => store.modal);
	const mentionPickerRequest = useAppSelector(
		(store) => store.mentionPickerRequest,
	);
	const campaigns = useAppSelector((store) => store.campaigns.items);
	const campaignsReloadVersion = useAppSelector(
		(store) => store.campaigns.reloadVersion,
	);
	const { activeCampaignSlug } = useAppSelector((store) => store.navigation);
	const currentLanguage = useAppSelector(
		(store) => store.localization.language,
	);
	const currentTheme = useAppSelector((store) => store.ui.theme);
	const syncEvent = useAppSelector((store) => store.sync.event);

	const loadCampaigns = useCallback(async () => {
		try {
			const data = await api.listCampaigns();
			dispatch(setCampaignsAction(data));
		} catch (err) {
			console.error("Failed to load campaigns", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to load campaigns"),
				}),
			);
		}
	}, [dispatch]);

	const applySettingsToStore = useCallback(
		(settings) => {
			dispatch(setLanguageAction(settings.language));
			dispatch(
				setUiSettingsAction({
					theme: settings.theme,
					encounterViewMode: settings.encounterViewMode,
					encounterGridColumns: settings.encounterGridColumns,
					simplifiedNotes: settings.simplifiedNotes,
					aiBasePrompt: settings.aiBasePrompt,
					imagePromptBasePrompt: settings.imagePromptBasePrompt,
					campaignAiBasePrompts: settings.campaignAiBasePrompts,
					campaignImagePromptBasePrompts:
						settings.campaignImagePromptBasePrompts,
					autoApplyAiChanges: settings.autoApplyAiChanges,
					useSearchDebounce: settings.useSearchDebounce,
				}),
			);
		},
		[dispatch],
	);

	const loadSettings = useCallback(
		async (isMounted, errorMessage) => {
			try {
				const settings = await api.getSettings();
				if (!isMounted() || !settings) return;
				applySettingsToStore(settings);
			} catch (error) {
				console.error(errorMessage, error);
			}
		},
		[applySettingsToStore],
	);

	useEffect(() => {
		const isEditableTarget = (target) =>
			target?.tagName === "INPUT" ||
			target?.tagName === "TEXTAREA" ||
			target?.isContentEditable;

		const handleKeyDown = (e) => {
			if (isEditableTarget(e.target)) return;
			if (e.ctrlKey || e.metaKey) {
				setCTRLPressed(true);
			}
		};
		const handleKeyUp = (e) => {
			if (isEditableTarget(e.target)) return;
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

		const handleKeyDown = (event) => {
			if (event.key === "Escape") {
				setMobileSidebarOpen(false);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isMobileSidebarOpen]);

	useEffect(() => {
		loadCampaigns();
	}, [loadCampaigns, campaignsReloadVersion]);

	useEffect(() => {
		applyTheme(currentTheme);
	}, [currentTheme]);

	useEffect(() => {
		let isMounted = true;
		loadSettings(() => isMounted, "Failed to load settings");

		return () => {
			isMounted = false;
		};
	}, [loadSettings]);

	useEffect(() => {
		if (syncEvent?.resource !== "settings") return;

		let isMounted = true;
		loadSettings(
			() => isMounted,
			"Failed to reload settings after sync event",
		);
		return () => {
			isMounted = false;
		};
	}, [loadSettings, syncEvent]);

	useEffect(() => {
		const handleMentionPicker = async () => {
			if (!mentionPickerRequest) return;
			const { select, cancel } = mentionPickerRequest;

			if (typeof select !== "function" || typeof cancel !== "function") {
				dispatch(closeMentionPickerAction());
				return;
			}

			if (!activeCampaignSlug) {
				cancel();
				dispatch(closeMentionPickerAction());
				return;
			}

			try {
				const [characters, npcs, locations] = await Promise.all([
					api.getEntities(activeCampaignSlug, "characters"),
					api.getEntities(activeCampaignSlug, "npc").catch(() => []),
					api.getEntities(activeCampaignSlug, "locations").catch(() => []),
				]);

				const toEntityOption = (entity, type) => {
					const firstName = (entity.firstName || "").trim();
					const lastName = (entity.lastName || "").trim();
					const fullName = `${firstName} ${lastName}`.trim();
					const name = fullName || (entity.name || entity.title || "").trim();
					if (!name) return null;

					return {
						id: entity.id || entity.slug || name,
						type,
						name,
						firstName,
						lastName,
					};
				};

				const entities = [
					...characters
						.map((entity) => toEntityOption(entity, "characters"))
						.filter(Boolean),
					...npcs
						.map((entity) => toEntityOption(entity, "npc"))
						.filter(Boolean),
					...locations
						.map((entity) => toEntityOption(entity, "locations"))
						.filter(Boolean),
				].sort((a, b) => a.name.localeCompare(b.name, currentLanguage));

				if (entities.length === 0) {
					cancel();
					dispatch(closeMentionPickerAction());
					return;
				}

				openModalRequest({
					title: lang.t("Choose mention"),
					type: "confirm",
					className: "MentionPickerModal",
					showFooter: false,
					onCancelAction: () => {
						cancel();
						dispatch(closeMentionPickerAction());
					},
					children: (
						<MentionPickerModalContent
							entities={entities}
							onSelect={(name) => {
								select(name);
								dispatch(closeMentionPickerAction());
								closeActiveModal();
							}}
							onCancel={() => {
								cancel();
								dispatch(closeMentionPickerAction());
								closeActiveModal();
							}}
						/>
					),
				});
			} catch (err) {
				console.error("Error opening mention picker:", err);
				cancel();
				dispatch(closeMentionPickerAction());
			}
		};

		handleMentionPicker();
	}, [activeCampaignSlug, currentLanguage, dispatch, mentionPickerRequest]);

	const handleToggleCampaignStatus = async (campaign) => {
		const isCompleting = !campaign.completed;
		let completedAt = campaign.completedAt;

		if (isCompleting) {
			const now = new Date().toISOString();
			const todayLabel = new Date().toLocaleDateString();
			const prevLabel = completedAt
				? new Date(completedAt).toLocaleDateString()
				: null;

			if (completedAt && todayLabel !== prevLabel) {
				const confirmUpdate = await dispatch(
					confirm({
						title: lang.t("Update completion date"),
						message: lang.t(
							"Campaign was already completed on {date}. Update completion date to today?",
							{ date: prevLabel },
						),
					}),
				);
				if (confirmUpdate) completedAt = now;
			} else {
				completedAt = now;
			}
		}

		try {
			await api.updateCampaign(campaign.slug, {
				completed: isCompleting,
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
							dispatch(requestCampaignsReloadAction());
							handleClose();
							navigateTo(newCampaign.slug);
						} catch (err) {
							dispatch(
								alert({
									title: lang.t("Error"),
									message: err.message || lang.t("Failed to create campaign"),
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
									message: err.message || lang.t("Failed to import campaign"),
								}),
							);
						}
					}}
				/>
			),
		});
	};

	return (
		<div className="App" data-lang={currentLanguage}>
			<CampaignEntityModalProvider campaignSlug={activeCampaignSlug}>
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
					className="App__sidebar"
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
										modalState.config?.onCancelAction?.();
										resolveModalRequest(modalState.requestId, null);
									}
						}
					/>
				)}
				<MessageBox />
				<DiceCalculator />
				<RulesReferenceModalHost />
			</CampaignEntityModalProvider>
		</div>
	);
}
