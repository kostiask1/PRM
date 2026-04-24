import { useEffect, useRef, useState } from "react";
import { alert } from "../actions/app";
import { api } from "../api";
import Button from "./form/Button";
import Icon from "./common/Icon";
import StatusBadge from "./common/StatusBadge";
import ListCard from "./common/ListCard";
import DraggableList from "./common/DraggableList";
import ImageGallery from "./ImageGallery";
import { openConditionsModal } from "./modals/openConditionsModal";
import SettingsModalContent from "./modals/SettingsModalContent";
import { downloadBlob } from "../utils/download";
import {
	closeActiveModal,
	openModalRequest,
	useAppDispatch,
} from "../store/appStore";
import { lang } from "../services/localization";
import "../assets/components/Sidebar.css";

const DB_IMPORT_STRATEGIES = [
	{ id: "append", labelKey: "Add to existing data" },
	{ id: "replace_by_id", labelKey: "Replace data by ID" },
	{ id: "wipe_and_replace", labelKey: "Replace all existing data" },
];

export default function Sidebar({
	campaigns,
	activeCampaignId,
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

	useEffect(() => {
		setLocalCampaigns(campaigns);
	}, [campaigns]);

	const handleFileChange = async (event) => {
		const file = event.target.files[0];
		if (!file) return;

		try {
			await api.importArchive(file, "all", dbImportStrategy);
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

	const handleDragEnd = (newList) => {
		const orders = {};
		newList.forEach((item, idx) => {
			orders[item.slug] = idx;
		});
		api.reorderCampaigns(orders);
	};

	const handleSelectImportStrategy = (strategyId) => {
		setDbImportStrategy(strategyId);
		closeActiveModal();
		setTimeout(() => fileInputRef.current?.click(), 0);
	};

	const handleOpenImportDb = () => {
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

	const handleOpenConditions = () => {
		openConditionsModal();
	};

	const handleOpenSettings = () => {
		dispatch(() => {
			openModalRequest({
				title: lang.t("Settings"),
				type: "confirm",
				showFooter: false,
				children: (
					<SettingsModalContent
						onCancel={() => closeActiveModal()}
					/>
				),
			});
		});
	};

	return (
		<>
			<aside
				className={`Sidebar App__sidebar${isSidebarHovered ? " Sidebar--hovered" : ""}`}
				onMouseEnter={() => setIsSidebarHovered(true)}
				onMouseLeave={() => setIsSidebarHovered(false)}
			>
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
							setIsGalleryOpen(true);
						}}
					>
						<Icon name="image" />
						<span>{lang.t("Gallery")}</span>
					</a>
					<a
						href="/bestiary"
						className="Sidebar__link"
						onClick={(e) => {
							if (!e.ctrlKey && !e.metaKey) {
								e.preventDefault();
								onSelectCampaign("bestiary");
							}
						}}
					>
						<Icon name="skull" />
						<span>{lang.t("Bestiary")}</span>
					</a>
					<a
						href="/spells"
						className="Sidebar__link"
						onClick={(e) => {
							if (!e.ctrlKey && !e.metaKey) {
								e.preventDefault();
								onSelectCampaign("spells");
							}
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
							handleOpenConditions();
						}}
					>
						<Icon name="list" />
						<span>{lang.t("Conditions")}</span>
					</a>
				</div>

				<div className="Sidebar__section">
					<div className="Sidebar__headerSection">
						<h2 className="Sidebar__sectionTitle">
							<span>{lang.t("Campaigns")}</span>
						</h2>
					</div>
					<Button variant="create" onClick={onCreateCampaign} icon="plus">
						<span>{lang.t("New campaign")}</span>
					</Button>

					<DraggableList
						items={localCampaigns}
						className="Sidebar__list"
						onReorder={setLocalCampaigns}
						onDrop={() => handleDragEnd(localCampaigns)}
						keyExtractor={(c) => c.slug}
						renderItem={(campaign, isDragging) => (
							<ListCard
								active={activeCampaignId === campaign.slug}
								dragging={isDragging}
								href={`/campaign/${encodeURIComponent(campaign.slug)}`}
								onClick={() => onSelectCampaign(campaign.slug)}
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
								<div className="ListCard__sidebar-content">
									<Icon name="map" className="ListCard__sidebar-icon" />
									<div className="ListCard__sidebar-info">
										<div className="ListCard__title">{campaign.name}</div>
										<div className="ListCard__meta">
											{lang.t("{count} sessions", {
												count: campaign.sessionCount || 0,
											})}
										</div>
									</div>
								</div>
							</ListCard>
						)}
					/>
				</div>

				<div className="Sidebar__section Sidebar__section--resources">
					<div className="Sidebar__resource-list">
						<a
							href="https://homebrewery.naturalcrit.com/"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource-item"
						>
							<Icon name="book" size={16} /> <span>Homebrewery</span>
						</a>
						<a
							href="https://crowsnest.me/tokenizer/"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource-item"
						>
							<Icon name="user" size={16} /> <span>Tokenizer</span>
						</a>
						<a
							href="https://forgottenadventures.piwigo.com"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource-item"
						>
							<Icon name="layers" size={16} /> <span>Assets</span>
						</a>
						<a
							href="https://www.owlbear.rodeo/"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource-item"
						>
							<Icon name="monitor" size={16} /> <span>Owlbear Rodeo</span>
						</a>
						<a
							href="https://kemono.cr/patreon/user/16010661"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource-item"
						>
							<Icon name="map" size={16} /> <span>{lang.t("Szepeku maps")}</span>
						</a>
						<a
							href="https://chatgpt.com/g/g-69c24d157a348191b640bf111b486080-ttrpg-map-architect"
							target="_blank"
							rel="noopener noreferrer"
							className="Sidebar__resource-item"
						>
							<Icon name="wand" size={16} /> <span>Map Architect (AI)</span>
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
									const blob = await api.exportAllArchive();
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
