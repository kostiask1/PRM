import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type PointerEvent,
} from "react";

import { campaignApi } from "../../../entities/campaign/index.js";
import {
	backupApi,
	type BackupImportStrategy,
} from "../../../features/backup/index.js";
import { ImageGallery } from "../../../features/images/index.js";
import { downloadBlob, lang } from "../../../shared/lib/index.js";
import { Button } from "../../../shared/ui/index.js";
import {
	buildSidebarCampaignOrder,
	getSidebarCampaignSelection,
	getSidebarClassName,
	getSidebarErrorMessage,
	groupSidebarCampaigns,
	mergeSidebarCampaignGroup,
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
	onSelectCampaign: (campaignSlug: string) => void;
	onCreateCampaign: () => void;
	onToggleCampaignStatus: (campaign: SidebarCampaign) => void;
}

export default function Sidebar({
	campaigns,
	activeCampaignId = "",
	isMobileOpen = false,
	onClose,
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
		reportError,
		requestRulesReferenceNavigation,
	} = useSidebarRuntime();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [dbImportStrategy, setDbImportStrategy] =
		useState<BackupImportStrategy | null>(null);
	const [localCampaigns, setLocalCampaigns] =
		useState<SidebarCampaign[]>(campaigns);
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const [isSidebarHovered, setIsSidebarHovered] = useState(false);
	const [isSidebarPinnedOpen, setIsSidebarPinnedOpen] = useState(false);
	const [isCompletedCampaignsCollapsed, setIsCompletedCampaignsCollapsed] =
		useState(true);
	const effectiveActiveSlug = activeCampaignId || activeNavigationSlug;

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
		requestRulesReferenceNavigation(initialTab, "", options);
	};

	const handleOpenPlayerQuestions = () => {
		onClose?.();
		void openModal({
			title: lang.t("Player questions"),
			type: "confirm",
			className: "PlayerQuestionsModal",
			showFooter: false,
			children: <SidebarPlayerQuestionsModalContent />,
		});
	};

	const handleOpenSettings = () => {
		onClose?.();
		void openModal({
			title: lang.t("Settings"),
			type: "confirm",
			showFooter: false,
			children: (
				<SidebarSettingsModalContent
					onCancel={() => closeModal()}
				/>
			),
		});
	};

	const handleCampaignClick = (campaignSlug: string) => {
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
		setIsGalleryOpen(true);
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
		setIsSidebarHovered(false);
	};

	const handleExport = async () => {
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
		}
	};

	const isSidebarExpanded =
		isSidebarHovered || isSidebarPinnedOpen || isMobileOpen;

	return (
		<>
			<aside
				className={getSidebarClassName(isSidebarExpanded, isMobileOpen)}
				onPointerEnter={handleSidebarPointerEnter}
				onPointerLeave={handleSidebarPointerLeave}
			>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon={isSidebarPinnedOpen ? "back" : "menu"}
					className="Sidebar__touchToggle"
					onClick={() => setIsSidebarPinnedOpen((value) => !value)}
					title={
						isSidebarPinnedOpen
							? lang.t("Collapse")
							: lang.t("Open navigation")
					}
				/>
				<div className="Sidebar__header">
					<h1 className="Sidebar__title">D&amp;D Session Manager</h1>
					<p className="Sidebar__description">
						{lang.t(
							"Campaigns, sessions, and planning in one local workspace.",
						)}
					</p>
				</div>

				<SidebarLinks
					onOpenSettings={handleOpenSettings}
					onOpenGallery={handleOpenGallery}
					onOpenBestiary={() =>
						handleOpenRulesReference("bestiary", { forceTab: true })
					}
					onOpenSpells={() =>
						handleOpenRulesReference("spells", { forceTab: true })
					}
					onOpenRulesReference={() => handleOpenRulesReference()}
				/>
				<SidebarCampaignSection
					groups={campaignGroups}
					activeCampaignId={activeCampaignId || ""}
					isCompletedCollapsed={isCompletedCampaignsCollapsed}
					onToggleCompleted={() =>
						setIsCompletedCampaignsCollapsed((value) => !value)
					}
					onCreateCampaign={onCreateCampaign}
					onSelectCampaign={handleCampaignClick}
					onToggleCampaignStatus={onToggleCampaignStatus}
					onReorder={handleCampaignGroupReorder}
					onDrop={handleCampaignGroupDrop}
				/>
				<SidebarResources
					onOpenPlayerQuestions={handleOpenPlayerQuestions}
				/>
				<SidebarArchiveControls
					fileInputRef={fileInputRef}
					onFileChange={handleFileChange}
					onExport={() => void handleExport()}
					onImport={handleOpenImportDb}
				/>
			</aside>
			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
			/>
		</>
	);
}
