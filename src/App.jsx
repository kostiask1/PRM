import { useEffect, useState } from "react";
import { api } from "./api";
import DiceCalculator from "./components/DiceCalculator";
import MainContent from "./components/MainContent";
import MessageBox from "./components/MessageBox";
import Modal from "./components/Modal";
import Sidebar from "./components/Sidebar";
import MentionPickerModalContent from "./components/modals/MentionPickerModalContent";
import CreateCampaignModalContent from "./components/modals/CreateCampaignModalContent";
import { parseUrl } from "./utils/navigation";
import {
	closeMentionPickerAction,
	alert,
	confirm,
} from "./actions/app";
import {
	closeActiveModal,
	openModalRequest,
	resolveModalRequest,
	useAppDispatch,
	useAppSelector,
} from "./store/appStore";

/**
 * Main Application Component
 * Orchestrates the sidebar navigation and the main content area.
 */
export default function App() {
	const initialRoute = parseUrl();
	const [campaigns, setCampaigns] = useState([]);
	const [isCTRLPressed, setCTRLPressed] = useState(false);
	const [activeCampaignSlug, setActiveCampaignSlug] = useState(
		initialRoute.campaign,
	);
	const [activeSessionFileName, setActiveSessionFileName] = useState(
		initialRoute.session,
	);
	const [activeEncounterId, setActiveEncounterId] = useState(
		initialRoute.encounter,
	);

	const dispatch = useAppDispatch();
	const modalState = useAppSelector((store) => store.modal);
	const mentionPickerRequest = useAppSelector(
		(store) => store.mentionPickerRequest,
	);

	const loadCampaigns = async () => {
		try {
			const data = await api.listCampaigns();
			setCampaigns(data);
		} catch (err) {
			console.error("Failed to load campaigns", err);
			dispatch(
				alert({
				title: "Помилка",
				message: "Не вдалося завантажити список кампаній",
				}),
			);
		}
	};

	useEffect(() => {
		document.addEventListener("keydown", (e) => {
			if (e.ctrlKey || e.metaKey) {
				setCTRLPressed(true);
			}
		});

		document.addEventListener("keyup", (e) => {
			if (!e.ctrlKey && !e.metaKey) {
				setCTRLPressed(false);
			}
		});

		document.addEventListener("mouseup", () => setCTRLPressed(false));
	}, []);

	useEffect(() => {
		loadCampaigns();

		// Слухаємо кнопки Назад/Вперед у браузері
		const handlePopState = () => {
			const route = parseUrl();
			setActiveCampaignSlug(route.campaign);
			setActiveSessionFileName(route.session);
			setActiveEncounterId(route.encounter);
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

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
				const [characters, npcs] = await Promise.all([
					api.getEntities(activeCampaignSlug, "characters"),
					api.getEntities(activeCampaignSlug, "npc").catch(() => []),
				]);

				const toEntityOption = (entity, type) => {
					const firstName = (entity.firstName || "").trim();
					const lastName = (entity.lastName || "").trim();
					const fullName = `${firstName} ${lastName}`.trim();
					const name = fullName || (entity.name || "").trim();
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
					...npcs.map((entity) => toEntityOption(entity, "npc")).filter(Boolean),
				].sort((a, b) => a.name.localeCompare(b.name, "uk"));

				if (entities.length === 0) {
					cancel();
					dispatch(closeMentionPickerAction());
					return;
				}

				openModalRequest({
					title: "Вибір згадки",
					type: "confirm",
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
	}, [activeCampaignSlug, dispatch, mentionPickerRequest]);

	// Універсальна функція навігації
	const navigate = (
		slug,
		fileName = null,
		replace = false,
		encounterId = null,
	) => {
		let url = "/";
		if (slug && slug !== "bestiary" && slug !== "spells") {
			url = `/campaign/${encodeURIComponent(slug)}`;
			if (fileName) {
				url += `/session/${encodeURIComponent(fileName)}`;
				if (encounterId) {
					url += `/encounter/${encodeURIComponent(encounterId)}`;
				}
			}
		} else if (slug === "bestiary") {
			url = "/bestiary";
		} else if (slug === "spells") {
			url = "/spells";
		}

		if (isCTRLPressed) {
			window.open(url, "_blank");
		} else {
			setActiveCampaignSlug(slug);
			setActiveSessionFileName(fileName);
			setActiveEncounterId(encounterId);

			if (replace) window.history.replaceState({}, "", url);
			else window.history.pushState({}, "", url);
		}
	};

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
					title: "Оновлення дати",
					message: `Кампанія вже була завершена ${prevLabel}. Оновити дату завершення на сьогодні?`,
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
				completedAt: completedAt,
			});
			await loadCampaigns();
		} catch (err) {
			console.error("Failed to toggle campaign status", err);
			dispatch(
				alert({
				title: "Помилка",
				message: "Не вдалося оновити статус кампанії",
				}),
			);
		}
	};

	const activeCampaign = campaigns.find((c) => c.slug === activeCampaignSlug);

	const openCreateCampaignModal = () => {
		const handleClose = () => closeActiveModal();
		openModalRequest({
			title: "Нова кампанія",
			type: "confirm",
			showFooter: false,
			children: (
				<CreateCampaignModalContent
					onClose={handleClose}
					onCreateCampaign={async (name) => {
						if (!name?.trim()) return;
						try {
							const newCampaign = await api.createCampaign(name.trim());
							await loadCampaigns();
							handleClose();
							navigate(newCampaign.slug);
						} catch (err) {
							dispatch(
								alert({
								title: "Помилка",
								message: err.message || "Не вдалося створити кампанію",
								}),
							);
						}
					}}
					onImportCampaign={async (file) => {
						try {
							await api.importArchive(file, "campaign");
							await loadCampaigns();
							handleClose();
						} catch (err) {
							dispatch(
								alert({
								title: "Помилка імпорту",
								message: err.message || "Не вдалося імпортувати кампанію",
								}),
							);
						}
					}}
				/>
			),
		});
	};

	return (
		<div className="App">
			<Sidebar
				className="App__sidebar"
				campaigns={campaigns}
				activeCampaignId={activeCampaignSlug}
				onSelectCampaign={(slug) => navigate(slug)}
				onCreateCampaign={openCreateCampaignModal}
					onToggleCampaignStatus={handleToggleCampaignStatus}
				/>
			<MainContent
				className="App__main"
				campaign={activeCampaign}
				activeSessionId={activeSessionFileName}
				activeEncounterId={activeEncounterId}
				onSelectSession={(fileName) => navigate(activeCampaignSlug, fileName)}
					onRefreshCampaigns={loadCampaigns}
					onNavigate={navigate}
				/>

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
			{/* Передаємо команду для кидка та функцію для її скидання */}
			<DiceCalculator />
		</div>
	);
}



