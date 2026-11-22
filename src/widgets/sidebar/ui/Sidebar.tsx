import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type FocusEvent,
	type PointerEvent,
} from "react";

import { campaignApi } from "../../../entities/campaign/index.js";
import { usePersistentApplicationHistory } from "../../../entities/history/index.js";
import {
	backupApi,
	type BackupImportStrategy,
} from "../../../features/backup/index.js";
import { downloadBlob, lang } from "../../../shared/lib/index.js";
import { Button, Icon, Tooltip } from "../../../shared/ui/index.js";
import {
	buildSidebarCampaignOrder,
	getSidebarCampaignSelection,
	getSidebarClassName,
	getSidebarErrorMessage,
	getSidebarShortcutAction,
	groupSidebarCampaigns,
	isSidebarEditableTarget,
	mergeSidebarCampaignGroup,
	SIDEBAR_SHORTCUT_LABELS,
	type SidebarCampaign,
	type SidebarCampaignGroup,
} from "../model/sidebar.ts";
import SidebarArchiveControls from "./SidebarArchiveControls.tsx";
import SidebarCampaignSection from "./SidebarCampaignSection.tsx";
import SidebarLinks from "./SidebarLinks.tsx";
import SidebarResources from "./SidebarResources.tsx";
import { SidebarPlayerQuestionsModalContent } from "./sidebarPlayerQuestionsComposition.tsx";
import {
	type SidebarRulesReferenceNavigationOptions,
	useSidebarRuntime,
} from "./SidebarRuntime.tsx";
import { SidebarSettingsModalContent } from "./sidebarSettingsComposition.ts";
import "../../../assets/components/Sidebar.css";

const DB_IMPORT_STRATEGIES: Array<{
	id: BackupImportStrategy;
	labelKey: string;
}> = [
	{ id: "append", labelKey: "Add to existing data" },
	{ id: "replace_by_id", labelKey: "Replace data by ID" },
	{ id: "wipe_and_replace", labelKey: "Replace all existing data" },
];

export interface SidebarProps {
	campaigns: SidebarCampaign[];
	activeCampaignId?: string | null;
	isMobileOpen?: boolean;
	onClose?: () => void;
	onOpenDiceCalculator: () => void;
	onOpenGallery: () => void;
	isGalleryActive: boolean;
	onSelectCampaign: (campaignSlug: string) => void;
	onCreateCampaign: () => void;
	onToggleCampaignStatus: (campaign: SidebarCampaign) => void;
}

export default function Sidebar({
	campaigns,
	activeCampaignId = "",
	isMobileOpen = false,
	onClose,
	onOpenDiceCalculator,
	onOpenGallery,
	isGalleryActive,
	onSelectCampaign,
	onCreateCampaign,
	onToggleCampaignStatus,
}: SidebarProps) {
	const {
		activeCampaignSlug: activeNavigationSlug,
		activeEncounterId,
		activeSessionFileName,
		closeModal,
		openModal,
		publishHistoryRefresh,
		reportError,
		requestRulesReferenceNavigation,
		setCampaigns,
		syncEvent,
	} = useSidebarRuntime();
	const asideRef = useRef<HTMLElement>(null);
	const lastInputWasKeyboardRef = useRef(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [dbImportStrategy, setDbImportStrategy] =
		useState<BackupImportStrategy | null>(null);
	const [localCampaigns, setLocalCampaigns] =
		useState<SidebarCampaign[]>(campaigns);
	const [isExportingBackup, setIsExportingBackup] = useState(false);
	const [isSidebarHovered, setIsSidebarHovered] = useState(false);
	const [isSidebarPinnedOpen, setIsSidebarPinnedOpen] = useState(false);
	const [isSidebarFocusExpanded, setIsSidebarFocusExpanded] = useState(false);
	const [isCompletedCampaignsCollapsed, setIsCompletedCampaignsCollapsed] =
		useState(true);
	const effectiveActiveSlug = activeCampaignId || activeNavigationSlug;
	const reportApplicationHistoryError = useCallback((error: unknown) => {
		reportError({
			title: lang.t("Error"),
			message: getSidebarErrorMessage(error, lang.t("Unknown error")),
		});
	}, [reportError]);
	const reloadApplicationCampaigns = useCallback(async () => {
		const latestCampaigns = (await campaignApi.listCampaigns()) || [];
		setLocalCampaigns(latestCampaigns as SidebarCampaign[]);
		setCampaigns(latestCampaigns);
	}, [setCampaigns]);
	const handleApplicationHistoryConflict = useCallback(async () => {
		try {
			await reloadApplicationCampaigns();
			publishHistoryRefresh();
		} finally {
			reportError({
				title: lang.t("History conflict"),
				message: lang.t(
					"The change could not be restored because the data was edited elsewhere. Current data and history were reloaded; review the latest changes and try again.",
				),
			});
		}
	}, [publishHistoryRefresh, reloadApplicationCampaigns, reportError]);
	const applicationHistory = usePersistentApplicationHistory({
		onRestored: async () => {
			await reloadApplicationCampaigns();
			publishHistoryRefresh();
		},
		onConflict: handleApplicationHistoryConflict,
		onError: reportApplicationHistoryError,
		syncVersion: syncEvent?.version,
	});

	useEffect(() => {
		setLocalCampaigns(campaigns);
	}, [campaigns]);

	const campaignGroups = useMemo(
		() => groupSidebarCampaigns(localCampaigns),
		[localCampaigns],
	);

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file || !dbImportStrategy) return;

		try {
			await backupApi.importArchive(file, "all", dbImportStrategy);
			window.location.reload();
		} catch (error) {
			reportError({
				title: lang.t("Import data"),
				message: getSidebarErrorMessage(error, lang.t("Unknown error")),
			});
		} finally {
			event.target.value = "";
		}
	};

	const mergeCampaignGroup = (
		group: SidebarCampaignGroup,
		newGroupList: SidebarCampaign[],
	) => mergeSidebarCampaignGroup(campaignGroups, group, newGroupList);

	const handleCampaignGroupReorder = (
		group: SidebarCampaignGroup,
		newGroupList: SidebarCampaign[],
	) => {
		setLocalCampaigns(mergeCampaignGroup(group, newGroupList));
	};

	const handleCampaignGroupDrop = (
		group: SidebarCampaignGroup,
		newGroupList: SidebarCampaign[],
	) => {
		const next = mergeCampaignGroup(group, newGroupList);
		void campaignApi.reorderCampaigns(buildSidebarCampaignOrder(next));
	};

	const handleSelectImportStrategy = (strategy: BackupImportStrategy) => {
		setDbImportStrategy(strategy);
		closeModal();
		setTimeout(() => fileInputRef.current?.click(), 0);
	};

	const handleOpenImportDb = () => {
		onClose?.();
		setIsSidebarPinnedOpen(false);
		void openModal({
			title: lang.t("Import data"),
			type: "confirm",
			showFooter: false,
			children: (
				<div className="Sidebar__importStrategyModal">
					<p className="Sidebar__importStrategyText">
						{lang.t("Choose import mode:")}
					</p>
					<div className="Sidebar__importStrategyRow">
						{DB_IMPORT_STRATEGIES.map((item) => (
							<Button
								key={item.id}
								size={Button.SIZES.SMALL}
								variant={dbImportStrategy === item.id ? "primary" : "ghost"}
								onClick={() => handleSelectImportStrategy(item.id)}
							>
								{lang.t(item.labelKey)}
							</Button>
						))}
					</div>
					<div className="Sidebar__importStrategyActions">
						<Button variant="ghost" onClick={() => closeModal()}>
							{lang.t("Cancel")}
						</Button>
					</div>
				</div>
			),
		});
	};

	const handleOpenRulesReference = (
		initialTab = "conditions",
		options: SidebarRulesReferenceNavigationOptions = {},
	) => {
		onClose?.();
		setIsSidebarPinnedOpen(false);
		requestRulesReferenceNavigation(initialTab, "", options);
	};

	const handleOpenPlayerQuestions = () => {
		onClose?.();
		setIsSidebarPinnedOpen(false);
		void openModal({
			title: lang.t("Player questions"),
			type: "confirm",
			className: "PlayerQuestionsModalContent__modal",
			showFooter: false,
			children: <SidebarPlayerQuestionsModalContent />,
		});
	};

	const handleOpenSettings = () => {
		onClose?.();
		setIsSidebarPinnedOpen(false);
		void openModal({
			title: lang.t("Settings"),
			type: "confirm",
			className: "SettingsModal__modal",
			showFooter: false,
			children: (
				<SidebarSettingsModalContent
					onCancel={() => closeModal()}
				/>
			),
		});
	};

	const handleCampaignClick = (campaignSlug: string) => {
		setIsSidebarPinnedOpen(false);
		onSelectCampaign(
			getSidebarCampaignSelection({
				campaignSlug,
				activeCampaignSlug: effectiveActiveSlug,
				activeSessionFileName,
				activeEncounterId,
			}),
		);
	};

	const handleOpenGallery = () => {
		onClose?.();
		setIsSidebarPinnedOpen(false);
		onOpenGallery();
	};

	const canUseHoverSidebar = () =>
		typeof window !== "undefined" &&
		Boolean(
			window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches,
		);

	const handleSidebarPointerEnter = (event: PointerEvent<HTMLElement>) => {
		if (event.pointerType !== "mouse" || !canUseHoverSidebar()) return;
		setIsSidebarHovered(true);
	};

	const handleSidebarPointerLeave = (event: PointerEvent<HTMLElement>) => {
		if (event.pointerType !== "mouse") return;
		if (document.body.classList.contains("prm_draggable_list_dragging")) {
			return;
		}
		setIsSidebarHovered(false);
	};

	const handleExport = async () => {
		if (isExportingBackup) return;
		setIsExportingBackup(true);
		try {
			const blob = await backupApi.exportAllArchive();
			downloadBlob(
				blob,
				`prm-full-backup-${new Date().toISOString().slice(0, 10)}.prma.gz`,
			);
		} catch (error) {
				reportError({
				title: lang.t("Backup error"),
				message: getSidebarErrorMessage(error, lang.t("Unknown error")),
			});
		} finally {
			setIsExportingBackup(false);
		}
	};

	const shortcutHandlersRef = useRef({
		bestiary: () => handleOpenRulesReference("bestiary", { forceTab: true }),
		spells: () => handleOpenRulesReference("spells", { forceTab: true }),
		rulesReference: () =>
			handleOpenRulesReference("conditions", { forceTab: true }),
		gallery: handleOpenGallery,
		playerQuestions: handleOpenPlayerQuestions,
		settings: handleOpenSettings,
		newCampaign: () => {
			onClose?.();
			setIsSidebarPinnedOpen(false);
			onCreateCampaign();
		},
		exportData: () => {
			void handleExport();
		},
		importData: handleOpenImportDb,
	});
	shortcutHandlersRef.current = {
		bestiary: () => handleOpenRulesReference("bestiary", { forceTab: true }),
		spells: () => handleOpenRulesReference("spells", { forceTab: true }),
		rulesReference: () =>
			handleOpenRulesReference("conditions", { forceTab: true }),
		gallery: handleOpenGallery,
		playerQuestions: handleOpenPlayerQuestions,
		settings: handleOpenSettings,
		newCampaign: () => {
			onClose?.();
			setIsSidebarPinnedOpen(false);
			onCreateCampaign();
		},
		exportData: () => {
			void handleExport();
		},
		importData: handleOpenImportDb,
	};

	useEffect(() => {
		const handleDragModeChange = (event: Event) => {
			const dragEvent = event as CustomEvent<{ enabled?: boolean }>;
			if (
				dragEvent.detail?.enabled === false &&
				!asideRef.current?.matches(":hover")
			) {
				setIsSidebarHovered(false);
			}
		};

		window.addEventListener(
			"prm-draggable-list-drag-mode",
			handleDragModeChange,
		);
		return () =>
			window.removeEventListener(
				"prm-draggable-list-drag-mode",
				handleDragModeChange,
			);
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const action = getSidebarShortcutAction({
				key: event.key,
				code: event.code,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				altKey: event.altKey,
				shiftKey: event.shiftKey,
				repeat: event.repeat,
				isEditableTarget: isSidebarEditableTarget(event.target),
			});
			if (!action) return;

			if (action === "globalSearch") {
				if (document.querySelector(".Modal__overlay")) return;
				const trigger = document.querySelector<HTMLElement>(
					'[data-global-search-trigger="true"]',
				);
				if (!trigger) return;
				event.preventDefault();
				trigger.click();
				return;
			}

			if (action === "aiAssistant") {
				const toggles = Array.from(
					document.querySelectorAll<HTMLButtonElement>(
						".AiAssistantPanel__toggle button",
					),
				).filter((btn) => btn.getClientRects().length > 0);
				const activeToggle = toggles[toggles.length - 1];
				if (!activeToggle) return;
				event.preventDefault();
				activeToggle.click();
				return;
			}

			event.preventDefault();
			shortcutHandlersRef.current[action]();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	useEffect(() => {
		const navigationKeys = new Set([
			"Tab",
			"ArrowUp",
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight",
			"Home",
			"End",
		]);
		const handleModalityKeyDown = (event: KeyboardEvent) => {
			if (navigationKeys.has(event.key)) {
				lastInputWasKeyboardRef.current = true;
			}
		};
		const handleModalityPointerDown = () => {
			lastInputWasKeyboardRef.current = false;
			setIsSidebarFocusExpanded(false);
		};

		window.addEventListener("keydown", handleModalityKeyDown, {
			capture: true,
		});
		window.addEventListener("pointerdown", handleModalityPointerDown, {
			capture: true,
		});
		return () => {
			window.removeEventListener("keydown", handleModalityKeyDown, {
				capture: true,
			});
			window.removeEventListener(
				"pointerdown",
				handleModalityPointerDown,
				{ capture: true },
			);
		};
	}, []);

	const handleSidebarFocus = () => {
		if (lastInputWasKeyboardRef.current) {
			setIsSidebarFocusExpanded(true);
		}
	};

	const handleSidebarBlur = (event: FocusEvent<HTMLElement>) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
			setIsSidebarFocusExpanded(false);
		}
	};

	const isSidebarExpanded =
		isSidebarHovered ||
		isSidebarPinnedOpen ||
		isSidebarFocusExpanded ||
		isMobileOpen;

	return (
		<>
			<aside
				ref={asideRef}
				className={getSidebarClassName(isSidebarExpanded, isMobileOpen)}
				onPointerEnter={handleSidebarPointerEnter}
				onPointerLeave={handleSidebarPointerLeave}
				onFocus={handleSidebarFocus}
				onBlur={handleSidebarBlur}
			>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon={isSidebarPinnedOpen ? "back" : "menu"}
					className="Sidebar__touchToggle"
					aria-label={
						isSidebarPinnedOpen
							? lang.t("Close navigation")
							: lang.t("Open navigation")
					}
					aria-expanded={isSidebarPinnedOpen}
					onClick={() => setIsSidebarPinnedOpen((value) => !value)}
				/>
				<div className="Sidebar__header">
					<h1 className="Sidebar__title">
						<Tooltip delay={1200} content={SIDEBAR_SHORTCUT_LABELS.diceCalculator}>
							<button
								type="button"
								className="Sidebar__brandIcon"
								aria-label={lang.t("Dice calculator")}
								onClick={() => {
									setIsSidebarPinnedOpen(false);
									onOpenDiceCalculator();
								}}
							><Icon name="dice" size={20} /></button>
						</Tooltip>
						<span className="Sidebar__titleText">
							{lang.t("Session notebook")}
						</span>
					</h1>
					<div className="Sidebar__historyActions" role="group" aria-label={lang.t("Application history")}>
						<span className="Sidebar__historyScope">{lang.t("Application history")}</span>
						<Tooltip delay={1200} content={SIDEBAR_SHORTCUT_LABELS.undo}>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="undo"
								aria-label={`${lang.t("Application history")}: ${applicationHistory.undoLabel}`}
								disabled={!applicationHistory.canUndo || applicationHistory.isRestoring}
								onClick={() => void applicationHistory.handleUndo()}
							/>
						</Tooltip>
						<Tooltip delay={1200} content={SIDEBAR_SHORTCUT_LABELS.redo}>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="redo"
								aria-label={`${lang.t("Application history")}: ${applicationHistory.redoLabel}`}
								disabled={!applicationHistory.canRedo || applicationHistory.isRestoring}
								onClick={() => void applicationHistory.handleRedo()}
							/>
						</Tooltip>
					</div>
				</div>

				<SidebarCampaignSection
					groups={campaignGroups}
					activeCampaignId={activeCampaignId || ""}
					isCompletedCollapsed={isCompletedCampaignsCollapsed}
					onToggleCompleted={() =>
						setIsCompletedCampaignsCollapsed((value) => !value)
					}
					onCreateCampaign={() => {
						setIsSidebarPinnedOpen(false);
						onCreateCampaign();
					}}
					onSelectCampaign={handleCampaignClick}
					onToggleCampaignStatus={onToggleCampaignStatus}
					onReorder={handleCampaignGroupReorder}
					onDrop={handleCampaignGroupDrop}
				/>
				<SidebarLinks
					onOpenGallery={handleOpenGallery}
					isGalleryActive={isGalleryActive}
					onOpenBestiary={() =>
						handleOpenRulesReference("bestiary", { forceTab: true })
					}
					onOpenSpells={() =>
						handleOpenRulesReference("spells", { forceTab: true })
					}
					onOpenRulesReference={() => handleOpenRulesReference()}
				/>
				<SidebarResources
					onOpenPlayerQuestions={handleOpenPlayerQuestions}
				/>
				<SidebarArchiveControls
					fileInputRef={fileInputRef}
					isExporting={isExportingBackup}
					onFileChange={handleFileChange}
					onExport={() => void handleExport()}
					onImport={handleOpenImportDb}
				/>
				<Tooltip delay={1200} content={SIDEBAR_SHORTCUT_LABELS.settings}>
					<button
						type="button"
						className="Sidebar__link Sidebar__settings"
						onClick={handleOpenSettings}
					>
						<Icon name="settings" size={20} />
						<span>{lang.t("Settings")}</span>
					</button>
				</Tooltip>
			</aside>
		</>
	);
}
