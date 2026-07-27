import { useEffect, useMemo, useRef, useState } from "react";
import { alert } from "../../shared/model/index.js";
import { archiveApi } from "../../entities/archive/api.js";
import { campaignApi } from "../../entities/campaign/api.js";
import Button from "../../components/form/Button";
import Icon from "../../components/common/Icon";
import StatusBadge from "../../components/common/StatusBadge";
import ListCard from "../../components/common/ListCard";
import DraggableList from "../../components/common/DraggableList";
import CollapseToggleButton from "../../components/common/CollapseToggleButton";
import { ImageGallery } from "../../features/images/index.js";
import { openRulesReferenceModal } from "../../components/modals/openRulesReferenceModal";
import PlayerQuestionsModalContent from "../../components/modals/PlayerQuestionsModalContent";
import SettingsModalContent from "../../components/modals/SettingsModalContent";
import { downloadBlob } from "../../shared/lib/download.js";
import {
	closeActiveModal,
	openModalRequest,
} from "../../shared/model/index.js";
import {
	useAppDispatch,
	useAppSelector,
} from "../../shared/lib/index.js";
import { lang } from "../../shared/config/index.js";
import "../../assets/components/Sidebar.css";

const DB_IMPORT_STRATEGIES = [
	{ id: "append", labelKey: "Add to existing data" },
	{ id: "replace_by_id", labelKey: "Replace data by ID" },
	{ id: "wipe_and_replace", labelKey: "Replace all existing data" },
];

export default function Sidebar({
	campaigns,
	activeCampaignId,
	isMobileOpen = false,
	onClose,
	onSelectCampaign,
	onCreateCampaign,
	onToggleCampaignStatus,
}) {
	const dispatch = useAppDispatch();
	const fileInputRef = useRef(null);
	const [dbImportStrategy, setDbImportStrategy] = useState("");
	const [localCampaigns, setLocalCampaigns] = useState(campaigns);
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const [isSidebarHovered, setIsSidebarHovered] = useState(false);
	const [isSidebarPinnedOpen, setIsSidebarPinnedOpen] = useState(false);
	const [isCompletedCampaignsCollapsed, setIsCompletedCampaignsCollapsed] =
		useState(true);
	const activeNavigationSlug = useAppSelector(
		(store) => store.navigation.activeCampaignSlug,
	);
	const activeSessionFileName = useAppSelector(
		(store) => store.navigation.activeSessionFileName,
	);
	const activeEncounterId = useAppSelector(
		(store) => store.navigation.activeEncounterId,
	);
	const effectiveActiveSlug = activeCampaignId || activeNavigationSlug;

	useEffect(() => {
		setLocalCampaigns(campaigns);
	}, [campaigns]);

	const campaignGroups = useMemo(() => {
		const active = [];
		const completed = [];

		localCampaigns.forEach((campaign) => {
			if (campaign.completed) {
				completed.push(campaign);
				return;
			}
			active.push(campaign);
		});

		return { active, completed };
	}, [localCampaigns]);

	const handleFileChange = async (event) => {
		const file = event.target.files[0];
		if (!file) return;

		try {
			await archiveApi.importArchive(file, "all", dbImportStrategy);
			window.location.reload();
		} catch (error) {
			dispatch(
				alert({
					title: lang.t("Import data"),
					message: error.message,
				}),
			);
		} finally {
			event.target.value = "";
		}
	};

	const persistCampaignOrder = (newList) => {
		const orders = {};
		newList.forEach((item, idx) => {
			orders[item.slug] = idx;
		});
		campaignApi.reorderCampaigns(orders);
	};

	const handleCampaignGroupReorder = (group, newGroupList) => {
		setLocalCampaigns(() => {
			const next =
				group === "completed"
					? [...campaignGroups.active, ...newGroupList]
					: [...newGroupList, ...campaignGroups.completed];
			return next;
		});
	};

	const handleCampaignGroupDrop = (group, newGroupList) => {
		const next =
			group === "completed"
				? [...campaignGroups.active, ...newGroupList]
				: [...newGroupList, ...campaignGroups.completed];
		persistCampaignOrder(next);
	};

	const handleSelectImportStrategy = (strategyId) => {
		setDbImportStrategy(strategyId);
		closeActiveModal();
		setTimeout(() => fileInputRef.current?.click(), 0);
	};

	const handleOpenImportDb = () => {
		onClose?.();
		openModalRequest({
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
						<Button variant="ghost" onClick={() => closeActiveModal()}>
							{lang.t("Cancel")}
						</Button>
					</div>
				</div>
			),
		});
	};

	const handleOpenRulesReference = (initialTab = "conditions", options = {}) => {
		onClose?.();
		openRulesReferenceModal(initialTab, "", options);
	};

	const handleOpenPlayerQuestions = () => {
		onClose?.();
		openModalRequest({
			title: lang.t("Player questions"),
			type: "confirm",
			className: "PlayerQuestionsModal",
			showFooter: false,
			children: <PlayerQuestionsModalContent />,
		});
	};

	const handleOpenSettings = () => {
		onClose?.();
		dispatch(() => {
			openModalRequest({
				title: lang.t("Settings"),
				type: "confirm",
				showFooter: false,
				children: <SettingsModalContent onCancel={() => closeActiveModal()} />,
			});
		});
	};

	const handleCampaignClick = (campaignSlug) => {
		const shouldClearSession =
			effectiveActiveSlug === campaignSlug &&
			!(activeSessionFileName || activeEncounterId);

		onSelectCampaign(shouldClearSession ? "" : campaignSlug);
	};

	const handleOpenGallery = () => {
		onClose?.();
		setIsGalleryOpen(true);
	};

	const canUseHoverSidebar = () =>
		typeof window !== "undefined" &&
		window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;

	const handleSidebarPointerEnter = (event) => {
		if (event.pointerType !== "mouse" || !canUseHoverSidebar()) return;
		setIsSidebarHovered(true);
	};

	const handleSidebarPointerLeave = (event) => {
		if (event.pointerType !== "mouse") return;
		setIsSidebarHovered(false);
	};

	const isSidebarExpanded =
		isSidebarHovered || isSidebarPinnedOpen || isMobileOpen;

	const renderCampaignCard = (campaign) => (
		<ListCard
			className={campaign.completed ? "Sidebar__campaignCompleted" : ""}
			active={activeCampaignId === campaign.slug}
			href={`/campaign/${encodeURIComponent(campaign.slug)}`}
			onClick={() => handleCampaignClick(campaign.slug)}
			actions={
				<StatusBadge
					completed={campaign.completed}
					onClick={(e) => {
						e.stopPropagation();
						onToggleCampaignStatus(campaign);
					}}
				/>
			}
		>
			<div className="ListCard__sidebar_content">
				<Icon name="map" className="ListCard__sidebar_icon" />
				<div className="ListCard__sidebar_info">
					<div
						className="ListCard__title Sidebar__campaignTitle"
						title={campaign.name}
					>
						{campaign.name}
					</div>
					<div className="ListCard__meta">
						{lang.t("{count} sessions", {
							count: campaign.sessionCount || 0,
						})}
					</div>
				</div>
			</div>
		</ListCard>
	);

	return (
		<>
			<aside
				className={`Sidebar App__sidebar${isSidebarExpanded ? " Sidebar__hovered" : ""}${isMobileOpen ? " Sidebar__mobile_open" : ""}`}
				onPointerEnter={handleSidebarPointerEnter}
				onPointerLeave={handleSidebarPointerLeave}
			>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon={isSidebarPinnedOpen ? "back" : "menu"}
					className="Sidebar__touchToggle"
					onClick={() => setIsSidebarPinnedOpen((value) => !value)}
					title={isSidebarPinnedOpen ? lang.t("Collapse") : lang.t("Open navigation")}
				/>
				<div className="Sidebar__header">
					<h1 className="Sidebar__title">D&D Session Manager</h1>
					<p className="Sidebar__description">
						{lang.t(
							"Campaigns, sessions, and planning in one local workspace.",
						)}
					</p>
				</div>

				<div className="Sidebar__links">
					<a
						href="#"
						className="Sidebar__link"
						onClick={(e) => {
							e.preventDefault();
							handleOpenSettings();
						}}
					>
						<Icon name="settings" />
						<span>{lang.t("Settings")}</span>
					</a>
					<a
						href="#"
						className="Sidebar__link"
						onClick={(e) => {
							e.preventDefault();
							handleOpenGallery();
						}}
					>
						<Icon name="image" />
						<span>{lang.t("Gallery")}</span>
					</a>
					<a
						href="#"
						className="Sidebar__link"
						onClick={(e) => {
							e.preventDefault();
							handleOpenRulesReference("bestiary", { forceTab: true });
						}}
					>
						<Icon name="skull" />
						<span>{lang.t("Bestiary")}</span>
					</a>
					<a
						href="#"
						className="Sidebar__link"
						onClick={(e) => {
							e.preventDefault();
							handleOpenRulesReference("spells", { forceTab: true });
						}}
					>
						<Icon name="magic" />
						<span>{lang.t("Spells")}</span>
					</a>
					<a
						href="#"
						className="Sidebar__link"
						onClick={(e) => {
							e.preventDefault();
							handleOpenRulesReference();
						}}
					>
						<Icon name="list" />
						<span>{lang.t("Rules Reference")}</span>
					</a>
				</div>

				<div className="Sidebar__section Sidebar__section__campaigns">
					<div className="Sidebar__headerSection">
						<h2 className="Sidebar__sectionTitle">
							<span>{lang.t("Campaigns")}</span>
						</h2>
					</div>
					<Button variant="create" onClick={onCreateCampaign} icon="plus">
						<span>{lang.t("New campaign")}</span>
					</Button>

					<DraggableList
						items={campaignGroups.active}
						className="Sidebar__list"
						onReorder={(newList) =>
							handleCampaignGroupReorder("active", newList)
						}
						onDrop={(newList) => handleCampaignGroupDrop("active", newList)}
						keyExtractor={(c) => c.slug}
						renderItem={renderCampaignCard}
					/>
					{campaignGroups.completed.length > 0 && (
						<div className="Sidebar__completedCampaigns">
							<div
								role="button"
								tabIndex={0}
								className="Sidebar__completedHeader"
								onClick={() =>
									setIsCompletedCampaignsCollapsed((value) => !value)
								}
								onKeyDown={(event) => {
									if (event.key !== "Enter" && event.key !== " ") return;
									event.preventDefault();
									setIsCompletedCampaignsCollapsed((value) => !value);
								}}
							>
								<CollapseToggleButton
									size={Button.SIZES.SMALL}
									collapsed={isCompletedCampaignsCollapsed}
									onClick={() =>
										setIsCompletedCampaignsCollapsed((value) => !value)
									}
								/>
								<span>{lang.t("Completed campaigns")}</span>
								<span className="Sidebar__completedCount">
									{campaignGroups.completed.length}
								</span>
							</div>
							{!isCompletedCampaignsCollapsed && (
								<DraggableList
									items={campaignGroups.completed}
									className="Sidebar__list Sidebar__completedList"
									onReorder={(newList) =>
										handleCampaignGroupReorder("completed", newList)
									}
									onDrop={(newList) =>
										handleCampaignGroupDrop("completed", newList)
									}
									keyExtractor={(c) => c.slug}
									renderItem={renderCampaignCard}
								/>
							)}
						</div>
					)}
				</div>

				<div className="Sidebar__section Sidebar__section__resources">
					<div className="Sidebar__resource_list">
						<a
							href="https://homebrewery.naturalcrit.com/"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource_item"
						>
							<Icon name="book" size={16} /> <span>Homebrewery</span>
						</a>
						<a
							href="https://crowsnest.me/tokenizer/"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource_item"
						>
							<Icon name="user" size={16} /> <span>Tokenizer</span>
						</a>
						<a
							href="https://forgottenadventures.piwigo.com"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource_item"
						>
							<Icon name="layers" size={16} /> <span>Assets</span>
						</a>
						<a
							href="https://www.owlbear.rodeo/"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource_item"
						>
							<Icon name="monitor" size={16} /> <span>Owlbear Rodeo</span>
						</a>
						<a
							href="https://kemono.cr/patreon/user/16010661"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource_item"
						>
							<Icon name="map" size={16} />{" "}
							<span>{lang.t("Szepeku maps")}</span>
						</a>
						<a
							href="https://chatgpt.com/g/g-69c24d157a348191b640bf111b486080-ttrpg-map-architect"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource_item"
						>
							<Icon name="wand" size={16} /> <span>Map Architect (AI)</span>
						</a>
						<a
							href="#"
							className="Sidebar__resource_item"
							onClick={(e) => {
								e.preventDefault();
								handleOpenPlayerQuestions();
							}}
						>
							<Icon name="help" size={16} />{" "}
							<span>{lang.t("Player questions")}</span>
						</a>
					</div>
				</div>

				<div className="Sidebar__footer">
					<input
						type="file"
						ref={fileInputRef}
						style={{ display: "none" }}
						accept=".json,.gz,.prma,.prma.gz"
						onChange={handleFileChange}
					/>
					<div className="Sidebar__footerGrid">
						<Button
							variant="footer"
							icon="database"
							iconSize={16}
							onClick={async () => {
								try {
									const blob = await archiveApi.exportAllArchive();
									downloadBlob(
										blob,
										`prm-full-backup-${new Date().toISOString().slice(0, 10)}.prma.gz`,
									);
								} catch (err) {
									dispatch(
										alert({
											title: lang.t("Backup error"),
											message: err.message || lang.t("Unknown error"),
										}),
									);
								}
							}}
						>
							{lang.t("Backup")}
						</Button>
						<Button
							variant="footer"
							icon="restore"
							iconSize={16}
							onClick={handleOpenImportDb}
						>
							{lang.t("Import DB")}
						</Button>
					</div>
				</div>
			</aside>
			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
			/>
		</>
	);
}
