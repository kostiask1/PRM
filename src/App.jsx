import { useEffect, useState } from "react";
import { api } from "./api";
import DiceCalculator from "./components/DiceCalculator";
import MainContent from "./components/MainContent";
import Modal from "./components/Modal";
import Sidebar from "./components/Sidebar";
import CharacterCard from "./components/CharacterCard";
import { parseUrl } from "./utils/navigation";

/**
 * Допоміжний компонент для керування станом сутності всередині модального вікна.
 * Забезпечує реактивність при редагуванні полів персонажа.
 */
const EntityModalContent = ({ initialEntity, campaignSlug, type, onClose }) => {
	const [entity, setEntity] = useState(initialEntity);
	const handleUpdate = async (id, updated) => {
		setEntity(updated);
		await api.updateEntity(campaignSlug, type, updated.slug, updated);
		window.dispatchEvent(new CustomEvent("refresh-entities"));
	};
	return (
		<CharacterCard
			character={{ ...entity, collapsed: false }}
			onChange={handleUpdate}
			onDelete={async () => {
				await api.deleteEntity(campaignSlug, type, entity.slug);
				window.dispatchEvent(new CustomEvent("refresh-entities"));
				onClose();
			}}
			onToggleCollapse={() => {}}
		/>
	);
};

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

	const showModal = (config) => {
		return new Promise((resolve) => {
			setModalConfig({
				...config,
				onConfirm: (value) => {
					setModalConfig(null);
					resolve(value);
				},
				onCancel: config.isAlert
					? null
					: () => {
							setModalConfig(null);
							resolve(null);
						},
			});
		});
	};

	const alert = (title, message, status = null) => {
		const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
		return showModal({
			title,
			message: fullMessage,
			type: status >= 500 ? "error" : "error",
			isAlert: true,
		});
	};
	const confirm = (title, message, status = null) => {
		const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
		return showModal({ title, message: fullMessage, type: "confirm" });
	};
	const prompt = (title, message, defaultValue = "") =>
		showModal({
			title,
			message,
			type: "confirm",
			showInput: true,
			defaultValue,
		});

	const loadCampaigns = async () => {
		try {
			const data = await api.listCampaigns();
			setCampaigns(data);
		} catch (err) {
			console.error("Failed to load campaigns", err);
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
					showModal({
						title: `Персонаж: ${found.firstName} ${found.lastName}`,
						type: "custom",
						showFooter: false,
						children: (
							<EntityModalContent
								initialEntity={found}
								campaignSlug={activeCampaignSlug}
								type={type}
								onClose={() => setModalConfig(null)}
							/>
						),
					});
				}
			} catch (err) {
				console.error("Error opening entity modal:", err);
			}
		};

		window.addEventListener("open-entity-modal", handleOpenEntity);
		return () => window.removeEventListener("open-entity-modal", handleOpenEntity);
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
		}
	};

	const activeCampaign = campaigns.find((c) => c.slug === activeCampaignSlug);

	return (
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
				modal={{ alert, confirm, prompt }}
			/>
			<MainContent
				className="App__main"
				campaign={activeCampaign}
				activeSessionId={activeSessionFileName}
				activeEncounterId={activeEncounterId}
				onSelectSession={(fileName) => navigate(activeCampaignSlug, fileName)}
				onRefreshCampaigns={loadCampaigns}
				onNavigate={navigate}
				modal={{ alert, confirm, prompt }}
			/>

			{modalConfig && <Modal {...modalConfig} />}
			{/* Передаємо команду для кидка та функцію для її скидання */}
			<DiceCalculator />
		</div>
	);
}
