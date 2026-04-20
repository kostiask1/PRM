import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

export default function withEncounterView(WrappedComponent) {
	const ComponentWithEncounterView = memo(function ComponentWithEncounterView(
		props,
	) {
		const { campaign, sessionId, encounterId, onBack, onRefreshCampaigns, modal } =
			props;

		const [encounter, setEncounter] = useState(null);
		const [selectedInstance, setSelectedInstance] = useState(null);
		const [showBestiary, setShowBestiary] = useState(false);
		const [notification, setNotification] = useState(null);

		const saveTimeoutRef = useRef(null);
		const fileInputRef = useRef(null);

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
							onBack();
						}
					}
				}
			};
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [showBestiary, onBack]);

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
						modal.alert(
							"Помилка",
							"Зіткнення не знайдено або дані ще оновлюються.",
						);
						onBack();
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
		}, [campaign.slug, sessionId, encounterId, modal, onBack]);

		const saveEncounterState = useCallback(
			(updatedEncounter, debounceMs = 0) => {
				if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

				const performSave = async () => {
					try {
						const currentSession = await api.getSession(campaign.slug, sessionId);
						const updatedEncounters = (currentSession.data.encounters || []).map(
							(e) =>
								e.id.toString() === encounterId.toString() ? updatedEncounter : e,
						);

						await api.updateSession(campaign.slug, sessionId, {
							...currentSession,
							data: { ...currentSession.data, encounters: updatedEncounters },
						});
						onRefreshCampaigns();
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
			[campaign.slug, sessionId, encounterId, onRefreshCampaigns],
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
				onRefreshCampaigns();
			},
			[encounterId, onRefreshCampaigns],
		);

		const handleAddMonster = useCallback(
			async (m) => {
				if (!encounter) return;

				const hpVal =
					typeof m.hp === "object" && m.hp?.average
						? m.hp.average
						: m.hit_points || 0;

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
						? { ...m, currentHp: Math.max(0, parseInt(newHp) || 0) }
						: m,
				);
				const updated = { ...encounter, monsters: updatedMonsters };
				setEncounter(updated);
				if (selectedInstance?.instanceId === instanceId) {
					setSelectedInstance(
						updatedMonsters.find((m) => m.instanceId === instanceId),
					);
				}
				saveEncounterState(updated, 500);
			},
			[encounter, selectedInstance, saveEncounterState],
		);

		const updateMonsterMaxHp = useCallback(
			(instanceId, newMaxHp) => {
				if (!encounter) return;
				const updatedMonsters = encounter.monsters.map((m) =>
					m.instanceId === instanceId
						? { ...m, hit_points: parseInt(newMaxHp) || 0 }
						: m,
				);
				const updated = { ...encounter, monsters: updatedMonsters };
				setEncounter(updated);
				if (selectedInstance?.instanceId === instanceId) {
					setSelectedInstance(
						updatedMonsters.find((m) => m.instanceId === instanceId),
					);
				}
				saveEncounterState(updated, 500);
			},
			[encounter, selectedInstance, saveEncounterState],
		);

		const handleRename = useCallback(async () => {
			if (!encounter) return;
			const name = await modal.prompt(
				"Перейменування",
				"Вкажіть нову назву зіткнення:",
				encounter.name,
			);
			if (name && name !== encounter.name) {
				const updated = { ...encounter, name };
				setEncounter(updated);
				saveEncounterState(updated);
			}
		}, [encounter, modal, saveEncounterState]);

		const handleRenameMonster = useCallback(
			async (instanceId, currentName) => {
				if (!encounter) return;
				const name = await modal.prompt(
					"Перейменування",
					"Вкажіть нове ім'я монстра:",
					currentName,
				);
				if (name && name !== currentName) {
					const updatedMonsters = encounter.monsters.map((m) =>
						m.instanceId === instanceId ? { ...m, name } : m,
					);
					const updated = { ...encounter, monsters: updatedMonsters };
					setEncounter(updated);
					if (selectedInstance?.instanceId === instanceId) {
						setSelectedInstance(
							updatedMonsters.find((m) => m.instanceId === instanceId),
						);
					}
					saveEncounterState(updated);
				}
			},
			[encounter, modal, selectedInstance, saveEncounterState],
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
							throw new Error(
								"Невірний формат файлу (відсутній список монстрів)",
							);
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
						modal.alert("Помилка імпорту", err.message);
					}
					e.target.value = "";
				};
				reader.readAsText(file);
			},
			[encounter, modal, saveEncounterState],
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
			setEncounter((prev) =>
				prev ? { ...prev, monsters: newMonsters } : prev,
			);
		}, []);

		const handleMonstersDrop = useCallback(() => {
			if (encounter) saveEncounterState(encounter);
		}, [encounter, saveEncounterState]);

		return (
			<WrappedComponent
				{...props}
				encounter={encounter}
				selectedInstance={selectedInstance}
				setSelectedInstance={setSelectedInstance}
				showBestiary={showBestiary}
				setShowBestiary={setShowBestiary}
				notification={notification}
				setNotification={setNotification}
				fileInputRef={fileInputRef}
				averageInitiative={averageInitiative}
				handleFileChange={handleFileChange}
				handleExport={handleExport}
				handleRename={handleRename}
				handleAddMonster={handleAddMonster}
				handleAiUpdate={handleAiUpdate}
				removeMonster={removeMonster}
				updateMonsterHp={updateMonsterHp}
				updateMonsterMaxHp={updateMonsterMaxHp}
				handleRenameMonster={handleRenameMonster}
				duplicateMonster={duplicateMonster}
				getHpColor={getHpColor}
				handleReorderMonsters={handleReorderMonsters}
				handleMonstersDrop={handleMonstersDrop}
			/>
		);
	});

	ComponentWithEncounterView.displayName = `withEncounterView(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

	return ComponentWithEncounterView;
}

