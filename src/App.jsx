import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import DiceCalculator from "./components/DiceCalculator";
import MainContent from "./components/MainContent";
import Modal from "./components/Modal";
import Sidebar from "./components/Sidebar";
import EntityModalContent from "./components/modals/EntityModalContent";
import MentionPickerModalContent from "./components/modals/MentionPickerModalContent";
import { parseUrl } from "./utils/navigation";
import { ModalContext } from "./context/ModalContext";

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

	// Modal State
	const [modalConfig, setModalConfig] = useState(null);

	const modal = useMemo(() => Modal.createApi(setModalConfig), []);
	const { open: openModal, close: closeModal, alert, confirm, prompt } =
		modal;

	const loadCampaigns = async () => {
		try {
			const data = await api.listCampaigns();
			setCampaigns(data);
		} catch (err) {
			console.error("Failed to load campaigns", err);
			alert("Помилка", "Не вдалося завантажити список кампаній");
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
		const handleOpenEntity = async (e) => {
			const { name } = e.detail;
			if (!activeCampaignSlug || !name) return;

			try {
				// Завантажуємо персонажів та NPC
				const [chars, npcs] = await Promise.all([
					api.getEntities(activeCampaignSlug, "characters"),
					api.getEntities(activeCampaignSlug, "npc").catch(() => []),
				]);

				const allEntities = [...chars, ...npcs];
				const searchName = name.trim().toLowerCase();

				// Пошук за логікою: Ім'я, Прізвище або Повне ім'я
				const found = allEntities.find((ent) => {
					const first = (ent.firstName || "").toLowerCase();
					const last = (ent.lastName || "").toLowerCase();
					const full = `${first} ${last}`.trim().toLowerCase();
					return (
						first === searchName || last === searchName || full === searchName
					);
				});

				if (found) {
					const type = chars.some((c) => c.id === found.id) ? "characters" : "npc";
					openModal({
						title: `Персонаж: ${found.firstName} ${found.lastName}`,
						type: "character",
						showFooter: false,
						children: (
								<EntityModalContent
									initialEntity={found}
									campaignSlug={activeCampaignSlug}
									type={type}
									onClose={closeModal}
								/>
						),
					});
				}
			} catch (err) {
				console.error("Error opening entity modal:", err);
				alert("Помилка", "Не вдалося відкрити картку персонажа");
			}
		};

		window.addEventListener("open-entity-modal", handleOpenEntity);
		return () => window.removeEventListener("open-entity-modal", handleOpenEntity);
	}, [activeCampaignSlug]);

	useEffect(() => {
		const handleOpenMentionPicker = async (e) => {
			const detail = e.detail || {};
			if (typeof detail.select !== "function" || typeof detail.cancel !== "function") {
				return;
			}

			detail.handled = true;

			if (!activeCampaignSlug) {
				detail.cancel();
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
					detail.cancel();
					return;
				}

				const closePicker = closeModal;
				setModalConfig({
					title: "Вибір згадки",
					type: "confirm",
					showFooter: false,
					onCancel: () => {
						closePicker();
						detail.cancel();
					},
					children: (
						<MentionPickerModalContent
							entities={entities}
							onSelect={(name) => {
								closePicker();
								detail.select(name);
							}}
							onCancel={() => {
								closePicker();
								detail.cancel();
							}}
						/>
					),
				});
			} catch (err) {
				console.error("Error opening mention picker:", err);
				detail.cancel();
			}
		};

		window.addEventListener("open-mention-picker", handleOpenMentionPicker);
		return () =>
			window.removeEventListener("open-mention-picker", handleOpenMentionPicker);
	}, [activeCampaignSlug]);

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
				const confirmUpdate = await confirm(
					"Оновлення дати",
					`Кампанія вже була завершена ${prevLabel}. Оновити дату завершення на сьогодні?`,
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
			alert("Помилка", "Не вдалося оновити статус кампанії");
		}
	};

	const activeCampaign = campaigns.find((c) => c.slug === activeCampaignSlug);

	return (
		<ModalContext.Provider value={modal}>
			<div className="App">
			<Sidebar
				className="App__sidebar"
				campaigns={campaigns}
				activeCampaignId={activeCampaignSlug}
				onSelectCampaign={(slug) => navigate(slug)}
				onCreateCampaign={async () => {
					const name = await prompt(
						"Нова кампанія",
						"Введіть назву для вашої пригоди:",
					);
					if (name) {
						const newCampaign = await api.createCampaign(name);
						await loadCampaigns();
						navigate(newCampaign.slug);
					}
				}}
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

			{modalConfig && <Modal {...modalConfig} />}
			{/* Передаємо команду для кидка та функцію для її скидання */}
			<DiceCalculator />
			</div>
		</ModalContext.Provider>
	);
}

