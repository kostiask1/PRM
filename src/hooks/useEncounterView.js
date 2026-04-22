import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	alert,
	prompt,
	requestCampaignsReloadAction,
	requestDiceRollAction,
} from "../actions/app";
import { api } from "../api";
import {
	navigateTo,
	useAppDispatch,
	useAppSelector,
} from "../store/appStore";

export default function useEncounterView({
	campaign,
	sessionId,
	encounterId,
}) {
	const dispatch = useAppDispatch();
	const handleBack = useCallback(
		() => navigateTo(campaign.slug, sessionId),
		[campaign.slug, sessionId],
	);

	const [encounter, setEncounter] = useState(null);
	const [selectedInstance, setSelectedInstance] = useState(null);
	const [showBestiary, setShowBestiary] = useState(false);
	const [notification, setNotification] = useState(null);
	const [entityImageMap, setEntityImageMap] = useState(new Map());
	const diceRolledResult = useAppSelector((state) => state.dice.rolledResult);

	const saveTimeoutRef = useRef(null);
	const fileInputRef = useRef(null);
	const processedDiceResultIdRef = useRef(null);

	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
		};
	}, []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape" && showBestiary) {
				setShowBestiary(false);
			} else if (e.key === "Backspace") {
				const isInput =
					e.target.tagName === "INPUT" ||
					e.target.tagName === "TEXTAREA" ||
					e.target.isContentEditable;
				if (!isInput) {
					e.preventDefault();
					if (showBestiary) {
						setShowBestiary(false);
					} else {
						handleBack();
					}
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showBestiary, handleBack]);

	useEffect(() => {
		let isMounted = true;
		const loadEncounter = async (retries = 3) => {
			try {
				const session = await api.getSession(campaign.slug, sessionId);
				if (!isMounted) return;

				const found = (session.data.encounters || []).find(
					(e) => e.id.toString() === encounterId.toString(),
				);

				if (!found && retries > 0) {
					setTimeout(() => loadEncounter(retries - 1), 300);
					return;
				}

				if (!found) {
					dispatch(
						alert({
							title: "Помилка",
							message: "Зіткнення не знайдено або дані ще оновлюються.",
						}),
					);
					handleBack();
					return;
				}

				setEncounter(found);
				if (found.monsters?.length > 0) {
					setSelectedInstance((prev) => prev || found.monsters[0]);
				}
			} catch (err) {
				if (isMounted) console.error("Failed to load encounter", err);
			}
		};
		loadEncounter();
		return () => {
			isMounted = false;
		};
	}, [campaign.slug, sessionId, encounterId, dispatch, handleBack]);

	useEffect(() => {
		let isMounted = true;

		const normalizeName = (value) =>
			String(value || "")
				.trim()
				.toLowerCase()
				.replace(/\s+/g, " ");

		const getEntityNames = (entity) => {
			const firstName = String(entity?.firstName || "").trim();
			const lastName = String(entity?.lastName || "").trim();
			const fullName = `${firstName} ${lastName}`.trim();
			const fallbackName = String(entity?.name || "").trim();
			return Array.from(
				new Set([fullName, fallbackName].map((name) => normalizeName(name)).filter(Boolean)),
			);
		};

		const loadEntityImages = async () => {
			try {
				const [characters, npcs] = await Promise.all([
					api.getEntities(campaign.slug, "characters"),
					api.getEntities(campaign.slug, "npc"),
				]);

				if (!isMounted) return;

				const nextMap = new Map();
				[...(characters || []), ...(npcs || [])].forEach((entity) => {
					if (!entity?.imageUrl) return;
					getEntityNames(entity).forEach((name) => {
						if (!nextMap.has(name)) {
							nextMap.set(name, entity.imageUrl);
						}
					});
				});
				setEntityImageMap(nextMap);
			} catch (error) {
				if (isMounted) {
					console.error("Failed to load entity images for encounter", error);
				}
			}
		};

		loadEntityImages();
		return () => {
			isMounted = false;
		};
	}, [campaign.slug]);

	const getMonsterImageOverride = useCallback(
		(monster) => {
			const normalizedName = String(monster?.name || "")
				.trim()
				.toLowerCase()
				.replace(/\s+/g, " ");
			if (!normalizedName) return null;
			return entityImageMap.get(normalizedName) || null;
		},
		[entityImageMap],
	);

	const saveEncounterState = useCallback(
		(updatedEncounter, debounceMs = 0) => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

			const performSave = async () => {
				try {
					const currentSession = await api.getSession(campaign.slug, sessionId);
					const updatedEncounters = (currentSession.data.encounters || []).map((e) =>
						e.id.toString() === encounterId.toString() ? updatedEncounter : e,
					);

					await api.updateSession(campaign.slug, sessionId, {
						...currentSession,
						data: { ...currentSession.data, encounters: updatedEncounters },
					});
					dispatch(requestCampaignsReloadAction());
				} catch (err) {
					console.error("Failed to save encounter updates", err);
				}
			};

			if (debounceMs > 0) {
				saveTimeoutRef.current = setTimeout(performSave, debounceMs);
			} else {
				performSave();
			}
		},
		[campaign.slug, sessionId, encounterId, dispatch],
	);

	const handleAiUpdate = useCallback(
		(updatedSession) => {
			if (!updatedSession) return;
			const sData = updatedSession.data || updatedSession;
			const found = (sData.encounters || []).find(
				(e) => e.id.toString() === encounterId.toString(),
			);
			if (found) {
				setEncounter(found);
				setSelectedInstance((prev) => {
					if (!prev) return found.monsters[0] || null;
					const stillExists = found.monsters.find(
						(m) => m.instanceId === prev.instanceId,
					);
					return stillExists || found.monsters[0] || null;
				});
			}
			dispatch(requestCampaignsReloadAction());
		},
		[encounterId, dispatch],
	);

	const handleAddMonster = useCallback(
		async (m) => {
			if (!encounter) return;

			const hpVal =
				typeof m.hp === "object" && m.hp?.average ? m.hp.average : m.hit_points || 0;

			let acVal = m.armor_class || 0;
			if (Array.isArray(m.ac) && m.ac[0]) {
				const entry = m.ac[0];
				acVal = typeof entry === "object" ? entry.ac : entry;
			}

			const newMonster = {
				...m,
				instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
				originalBestiaryName: m.name,
				currentHp: hpVal,
				hit_points: hpVal,
				armor_class: acVal,
			};

			const updated = {
				...encounter,
				monsters: [...encounter.monsters, newMonster],
			};

			setEncounter(updated);
			saveEncounterState(updated);
			setNotification(`${m.name} додано до бою.`);
		},
		[encounter, saveEncounterState],
	);

	const removeMonster = useCallback(
		(instanceId) => {
			if (!encounter) return;
			const updated = {
				...encounter,
				monsters: encounter.monsters.filter((m) => m.instanceId !== instanceId),
			};
			setEncounter(updated);
			saveEncounterState(updated);
		},
		[encounter, saveEncounterState],
	);

	const updateMonsterHp = useCallback(
		(instanceId, newHp) => {
			if (!encounter) return;
			const updatedMonsters = encounter.monsters.map((m) =>
				m.instanceId === instanceId
					? { ...m, currentHp: Math.max(0, parseInt(newHp, 10) || 0) }
					: m,
			);
			const updated = { ...encounter, monsters: updatedMonsters };
			setEncounter(updated);
			if (selectedInstance?.instanceId === instanceId) {
				setSelectedInstance(updatedMonsters.find((m) => m.instanceId === instanceId));
			}
			saveEncounterState(updated, 500);
		},
		[encounter, selectedInstance, saveEncounterState],
	);

	const updateMonsterMaxHp = useCallback(
		(instanceId, newMaxHp) => {
			if (!encounter) return;
			const updatedMonsters = encounter.monsters.map((m) =>
				m.instanceId === instanceId ? { ...m, hit_points: parseInt(newMaxHp, 10) || 0 } : m,
			);
			const updated = { ...encounter, monsters: updatedMonsters };
			setEncounter(updated);
			if (selectedInstance?.instanceId === instanceId) {
				setSelectedInstance(updatedMonsters.find((m) => m.instanceId === instanceId));
			}
			saveEncounterState(updated, 500);
		},
		[encounter, selectedInstance, saveEncounterState],
	);

	const handleRename = useCallback(async () => {
		if (!encounter) return;
		const name = await dispatch(
			prompt({
				title: "Перейменування",
				message: "Вкажіть нову назву зіткнення:",
				defaultValue: encounter.name,
			}),
		);
		if (name && name !== encounter.name) {
			const updated = { ...encounter, name };
			setEncounter(updated);
			saveEncounterState(updated);
		}
	}, [encounter, saveEncounterState, dispatch]);

	const handleRenameMonster = useCallback(
		async (instanceId, currentName) => {
			if (!encounter) return;
			const name = await dispatch(
				prompt({
					title: "Перейменування",
					message: "Вкажіть нове ім'я монстра:",
					defaultValue: currentName,
				}),
			);
			if (name && name !== currentName) {
				const updatedMonsters = encounter.monsters.map((m) =>
					m.instanceId === instanceId ? { ...m, name } : m,
				);
				const updated = { ...encounter, monsters: updatedMonsters };
				setEncounter(updated);
				if (selectedInstance?.instanceId === instanceId) {
					setSelectedInstance(updatedMonsters.find((m) => m.instanceId === instanceId));
				}
				saveEncounterState(updated);
			}
		},
		[encounter, selectedInstance, saveEncounterState, dispatch],
	);

	const handleExport = useCallback(() => {
		if (!encounter) return;
		const data = {
			name: encounter.name,
			monsters: encounter.monsters,
		};
		const filename = `encounter-${encounter.name.toLowerCase().replace(/\s+/g, "-")}.json`;
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}, [encounter]);

	const handleFileChange = useCallback(
		(e) => {
			if (!encounter) return;
			const file = e.target.files[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = async (event) => {
				try {
					const imported = JSON.parse(event.target.result);
					if (!imported.monsters || !Array.isArray(imported.monsters)) {
						throw new Error("Невірний формат файлу (відсутній список монстрів)");
					}

					const updated = {
						...encounter,
						name: imported.name || encounter.name,
						monsters: imported.monsters.map((m, idx) => ({
							...m,
							instanceId: `inst-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
						})),
					};

					setEncounter(updated);
					saveEncounterState(updated);
					setSelectedInstance(updated.monsters[0] || null);
					setNotification("Бій успішно імпортовано.");
				} catch (err) {
					dispatch(alert({ title: "Помилка імпорту", message: err.message }));
				}
				e.target.value = "";
			};
			reader.readAsText(file);
		},
		[encounter, saveEncounterState, dispatch],
	);

	const duplicateMonster = useCallback(
		(m) => {
			if (!encounter) return;
			const newMonster = {
				...m,
				instanceId: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
			};
			const index = encounter.monsters.findIndex(
				(item) => item.instanceId === m.instanceId,
			);
			const updatedMonsters = [...encounter.monsters];
			updatedMonsters.splice(index + 1, 0, newMonster);

			const updated = { ...encounter, monsters: updatedMonsters };
			setEncounter(updated);
			saveEncounterState(updated);
		},
		[encounter, saveEncounterState],
	);

	const rollMonsterHp = useCallback(
		(instanceId) => {
			if (!encounter) return;

			const target = encounter.monsters.find((monster) => monster.instanceId === instanceId);
			if (!target) return;

			const hpFormula =
				(typeof target.hp === "object" && target.hp?.formula) ||
				target.hit_dice ||
				"";

			if (!String(hpFormula || "").trim() || !/d/i.test(String(hpFormula || ""))) {
				setNotification(`Для ${target.name} не знайдено формулу HP.`);
				return;
			}
			dispatch(
				requestDiceRollAction({
				formula: hpFormula,
				context: {
					kind: "encounter_hp",
					campaignSlug: campaign.slug,
					sessionId: String(sessionId),
					encounterId: String(encounterId),
					instanceId,
				},
				}),
			);
		},
		[dispatch, encounter, campaign.slug, sessionId, encounterId],
	);

	useEffect(() => {
		const resultId = diceRolledResult?.resultId;
		if (!resultId || processedDiceResultIdRef.current === resultId) return;

		processedDiceResultIdRef.current = resultId;
		const result = diceRolledResult?.result;
		const context = diceRolledResult?.context;
		if (!result || !context) return;
		if (context.kind !== "encounter_hp") return;
		if (context.campaignSlug !== campaign.slug) return;
		if (String(context.sessionId) !== String(sessionId)) return;
		if (String(context.encounterId) !== String(encounterId)) return;

		const rolledHp = Math.max(1, Number(result.total) || 0);
		if (!rolledHp) return;

		if (!encounter) return;
		let updatedMonster = null;
		const updatedMonsters = encounter.monsters.map((monster) => {
			if (monster.instanceId !== context.instanceId) return monster;
			updatedMonster = {
				...monster,
				hit_points: rolledHp,
				currentHp: rolledHp,
			};
			return updatedMonster;
		});
		if (!updatedMonster) return;

		const updatedEncounter = { ...encounter, monsters: updatedMonsters };
		setEncounter(updatedEncounter);

		setSelectedInstance((prev) =>
			prev?.instanceId === context.instanceId ? updatedMonster : prev,
		);
		saveEncounterState(updatedEncounter);
	}, [
		campaign.slug,
		diceRolledResult,
		sessionId,
		encounterId,
		encounter,
		saveEncounterState,
	]);

	const getHpColor = useCallback((current, max) => {
		const ratio = max > 0 ? Math.min(Math.max(0, current / max), 1) : 0;
		const hue = ratio * 120;
		return `hsl(${hue}, 80%, 60%)`;
	}, []);

	const averageInitiative = useMemo(() => {
		if (!encounter || encounter.monsters.length === 0) return 0;
		const total = encounter.monsters.reduce((sum, m) => {
			const dex = m.dex ?? m.dexterity ?? 10;
			const mod = Math.floor((dex - 10) / 2);
			return sum + 10.5 + mod;
		}, 0);
		const avg = total / encounter.monsters.length;
		return avg % 1 === 0 ? avg : avg.toFixed(1);
	}, [encounter]);

	const handleReorderMonsters = useCallback((newMonsters) => {
		setEncounter((prev) => (prev ? { ...prev, monsters: newMonsters } : prev));
	}, []);

	const handleMonstersDrop = useCallback(() => {
		if (encounter) saveEncounterState(encounter);
	}, [encounter, saveEncounterState]);

	return {
		encounter,
		selectedInstance,
		setSelectedInstance,
		showBestiary,
		setShowBestiary,
		notification,
		setNotification,
		fileInputRef,
		averageInitiative,
		handleFileChange,
		handleExport,
		handleRename,
		handleAddMonster,
		handleAiUpdate,
		removeMonster,
		updateMonsterHp,
		updateMonsterMaxHp,
		handleRenameMonster,
		duplicateMonster,
		rollMonsterHp,
		getHpColor,
		handleReorderMonsters,
		handleMonstersDrop,
		getMonsterImageOverride,
		handleBack,
	};
}

