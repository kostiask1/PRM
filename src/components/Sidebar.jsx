import { useEffect, useRef, useState } from "react";
import { alert } from "../actions/app";
import { api } from "../api";
import Button from "./form/Button";
import Icon from "./common/Icon";
import StatusBadge from "./common/StatusBadge";
import ListCard from "./common/ListCard";
import ColorThemeSwitcher from "./ColorThemeSwitcher";
import DraggableList from "./common/DraggableList";
import ImageGallery from "./ImageGallery";
import { downloadBlob } from "../utils/download";
import {
	closeActiveModal,
	openModalRequest,
	useAppDispatch,
} from "../store/appStore";
import "../assets/components/Sidebar.css";

const DB_IMPORT_STRATEGIES = [
	{ id: "append", label: "Додати до наявних даних" },
	{ id: "replace_by_id", label: "Замінити дані за ID" },
	{ id: "wipe_and_replace", label: "Повністю очистити і замінити" },
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
			dispatch(alert({ title: "Помилка імпорту", message: error.message }));
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
			title: "Імпорт бази даних",
			type: "confirm",
			showFooter: false,
			children: (
				<div className="Sidebar__importStrategyModal">
					<p className="Sidebar__importStrategyText">Оберіть режим імпорту:</p>
					<div className="Sidebar__importStrategyRow">
						{DB_IMPORT_STRATEGIES.map((item) => (
							<Button
								key={item.id}
								size="small"
								variant={dbImportStrategy === item.id ? "primary" : "ghost"}
								onClick={() => handleSelectImportStrategy(item.id)}>
								{item.label}
							</Button>
						))}
					</div>
					<div className="Sidebar__importStrategyActions">
						<Button variant="ghost" onClick={() => closeActiveModal()}>
							Скасувати
						</Button>
					</div>
				</div>
			),
		});
	};

	return (
		<aside className="Sidebar App__sidebar">
			<div className="Sidebar__header">
				<h1 className="Sidebar__title">
					D&D Session Manager
					<ColorThemeSwitcher />
				</h1>
				<p className="Sidebar__description">
					Кампанії, сесії та планування в одному локальному проєкті.
				</p>
			</div>

			<div className="Sidebar__links">
				<a
					href="#"
					className="Sidebar__link"
					onClick={(e) => {
						e.preventDefault();
						setIsGalleryOpen(true);
					}}>
					<Icon name="image" />
					<span>Галерея</span>
				</a>
				<a
					href="/bestiary"
					className="Sidebar__link"
					onClick={(e) => {
						if (!e.ctrlKey && !e.metaKey) {
							e.preventDefault();
							onSelectCampaign("bestiary");
						}
					}}>
					<Icon name="skull" />
					<span>Бестіарій</span>
				</a>
				<a
					href="/spells"
					className="Sidebar__link"
					onClick={(e) => {
						if (!e.ctrlKey && !e.metaKey) {
							e.preventDefault();
							onSelectCampaign("spells");
						}
					}}>
					<Icon name="magic" />
					<span>Заклинання</span>
				</a>
			</div>

			<div className="Sidebar__section">
				<div className="Sidebar__headerSection">
					<h2 className="Sidebar__sectionTitle">
						<span>Кампанії</span>
					</h2>
				</div>
				<Button variant="create" onClick={onCreateCampaign} icon="plus">
					<span>Нова кампанія</span>
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
							}>
							<div className="ListCard__sidebar-content">
								<Icon name="map" className="ListCard__sidebar-icon" />
								<div className="ListCard__sidebar-info">
									<div className="ListCard__title">{campaign.name}</div>
									<div className="ListCard__meta">
										{campaign.sessionCount || 0} сесій
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
						className="Sidebar__resource-item">
						<Icon name="book" size={16} /> <span>Homebrewery</span>
					</a>
					<a
						href="https://crowsnest.me/tokenizer/"
						target="_blank"
						rel="noopener noreferrer"
						className="Sidebar__resource-item">
						<Icon name="user" size={16} /> <span>Tokenizer</span>
					</a>
					<a
						href="https://forgottenadventures.piwigo.com"
						target="_blank"
						rel="noopener noreferrer"
						className="Sidebar__resource-item">
						<Icon name="layers" size={16} /> <span>Assets</span>
					</a>
					<a
						href="https://www.owlbear.rodeo/"
						target="_blank"
						rel="noopener noreferrer"
						className="Sidebar__resource-item">
						<Icon name="monitor" size={16} /> <span>Owlbear Rodeo</span>
					</a>
					<a
						href="https://kemono.cr/patreon/user/16010661"
						target="_blank"
						rel="noopener noreferrer"
						className="Sidebar__resource-item">
						<Icon name="map" size={16} /> <span>Мапи Szepeku</span>
					</a>
					<a
						href="https://chatgpt.com/g/g-69c24d157a348191b640bf111b486080-ttrpg-map-architect"
						target="_blank"
						rel="noopener noreferrer"
						className="Sidebar__resource-item">
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
										title: "Помилка бекапу",
										message: err.message || "Невідома помилка",
									}),
								);
							}
						}}>
						Бекап
					</Button>
					<Button
						variant="footer"
						icon="restore"
						iconSize={16}
						onClick={handleOpenImportDb}>
						Імпорт БД
					</Button>
				</div>
			</div>

			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
			/>
		</aside>
	);
}
