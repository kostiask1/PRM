import { useEffect, useState } from "react";
import { api } from "./api";
import DiceCalculator from "./components/DiceCalculator";
import MainContent from "./components/MainContent";
import Modal from "./components/Modal";
import Sidebar from "./components/Sidebar";
import CharacterCard from "./components/CharacterCard";
import Input from "./components/Input";
import Button from "./components/Button";
import { parseUrl } from "./utils/navigation";

/**
 * Допоміжний компонент для керування станом сутності всередині модального вікна.
 * Забезпечує реактивність при редагуванні полів персонажа.
 */
const EntityModalContent = ({ initialEntity, campaignSlug, type, onClose, modal }) => {
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
			campaignSlug={campaignSlug}
			modal={modal}
			type={type}
		/>
	);
};

const MentionPickerModalContent = ({ entities, onSelect, onCancel }) => {
	const [query, setQuery] = useState("");

	const normalizedQuery = query.trim().toLowerCase();
	const filteredEntities = entities.filter((entity) => {
		if (!normalizedQuery) return true;
		const name = (entity.name || "").toLowerCase();
		const firstName = (entity.firstName || "").toLowerCase();
		const lastName = (entity.lastName || "").toLowerCase();
		const fullName = `${firstName} ${lastName}`.trim();
		return (
			name.includes(normalizedQuery) ||
			firstName.includes(normalizedQuery) ||
			lastName.includes(normalizedQuery) ||
			fullName.includes(normalizedQuery)
		);
	});

	return (
		<div className="MentionPicker">
			<Input
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Пошук NPC або персонажа..."
				autoFocus
			/>

			<div className="MentionPicker__list">
				{filteredEntities.length > 0 ? (
					filteredEntities.map((entity) => (
						<button
							key={`${entity.type}-${entity.id}-${entity.name}`}
							type="button"
							className="MentionPicker__item"
							onClick={() => onSelect(entity.name)}>
							<span>{entity.name}</span>
							<span className="muted">
								{entity.type === "npc" ? "NPC" : "Персонаж"}
							</span>
						</button>
					))
				) : (
					<p className="muted">Нічого не знайдено.</p>
				)}
			</div>

			<div className="MentionPicker__actions">
				<Button variant="ghost" onClick={onCancel}>
					Скасувати
				</Button>
			</div>
		</div>
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
	const success = (title, message) => {
		return showModal({
			title,
			message,
			type: "success",
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
					showModal({
						title: `Персонаж: ${found.firstName} ${found.lastName}`,
						type: "character",
						showFooter: false,
						children: (
							<EntityModalContent
								initialEntity={found}
								campaignSlug={activeCampaignSlug}
								type={type}
								modal={{ alert, confirm, prompt, success }}
								onClose={() => setModalConfig(null)}
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

				const closePicker = () => setModalConfig(null);
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
				modal={{ alert, confirm, prompt, success }}
			/>
			<MainContent
				className="App__main"
				campaign={activeCampaign}
				activeSessionId={activeSessionFileName}
				activeEncounterId={activeEncounterId}
				onSelectSession={(fileName) => navigate(activeCampaignSlug, fileName)}
				onRefreshCampaigns={loadCampaigns}
				onNavigate={navigate}
				modal={{ alert, confirm, prompt, success }}
			/>

			{modalConfig && <Modal {...modalConfig} />}
			{/* Передаємо команду для кидка та функцію для її скидання */}
			<DiceCalculator />
		</div>
	);
}
