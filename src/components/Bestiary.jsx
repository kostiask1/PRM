import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../api";
import { alert, confirm } from "../actions/app";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import Panel from "./common/Panel";
import Button from "./form/Button";
import AiAssistantPanel from "./AiAssistantPanel";
import BestiaryAiDraftModal from "./bestiary/BestiaryAiDraftModal";
import BestiaryContent from "./bestiary/BestiaryContent";
import CustomMonsterEditModal from "./bestiary/CustomMonsterEditModal";
import MonsterAiActionModal from "./bestiary/MonsterAiActionModal";
import MonsterAiEditModal from "./bestiary/MonsterAiEditModal";
import {
	buildDiffResources,
	getDiffResourceState as getAiDiffResourceState,
} from "../utils/aiDiff.js";
import { matchesMonsterSearch } from "../utils/bestiary.js";
import { objectMatchesSearch } from "../utils/deepSearch.js";
import {
	addUndoSnapshot,
	clearRedoStack,
	createRedoTransition,
	createUndoTransition,
} from "../utils/undoRedo.js";
import { downloadJsonFile } from "../utils/download.js";
import "../assets/components/Bestiary.css";
import { lang } from "../services/localization";

function getHistoryChangeSummary(entry) {
	const resources = Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
	const summary = entry?.changes?.summary || {};
	const total = Number(summary.total) || resources.length || 0;
	if (!total) return "";
	const parts = [];
	if (summary.added) parts.push(`+${summary.added}`);
	if (summary.deleted) parts.push(`-${summary.deleted}`);
	if (summary.modified) parts.push(`~${summary.modified}`);
	return `${lang.t("Changes")}: ${parts.length ? parts.join(" ") : total}`;
}

function getDiffResourceState(resource) {
	return getAiDiffResourceState(resource, {
		added: lang.t("Added"),
		deleted: lang.t("Deleted"),
		modified: lang.t("Modified"),
	});
}

function getFirstChangedMonsterName(entry, resourceIds = null) {
	const ids = Array.isArray(resourceIds)
		? new Set(resourceIds.map((id) => String(id || "")).filter(Boolean))
		: null;
	const resources = Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
	const resource = resources.find(
		(item) => item?.kind === "custom-monster" && (!ids || ids.has(item.id)),
	);
	return resource?.after?.name || resource?.before?.name || resource?.name || null;
}

function getMonsterTokenImageUrl(monster) {
	if (!monster) return "";
	if (monster.imageUrl) return monster.imageUrl;
	const source = String(monster.source || "").trim();
	const name = String(monster.originalBestiaryName || monster.name || "").trim();
	if (!source || !name) return "";
	return `/api/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(name)}.webp`;
}

function addSourceMonsterImageToDraft(entry, sourceMonster) {
	if (!entry || !sourceMonster) return entry;
	const imageUrl = getMonsterTokenImageUrl(sourceMonster);
	if (!imageUrl) return entry;
	const resources = Array.isArray(entry?.changes?.resources)
		? entry.changes.resources
		: [];
	let changed = false;
	const nextResources = resources.map((resource) => {
		if (
			resource?.kind !== "custom-monster" ||
			resource.before !== null ||
			!resource.after ||
			resource.after.imageUrl
		) {
			return resource;
		}
		changed = true;
		return {
			...resource,
			after: {
				...resource.after,
				imageUrl,
				originalBestiaryName:
					resource.after.originalBestiaryName || sourceMonster.name,
			},
		};
	});
	if (!changed) return entry;
	return {
		...entry,
		changes: {
			...(entry.changes || {}),
			resources: nextResources,
		},
	};
}

function monsterMatchesUrl(monster, name, source) {
	return monster?.name === name && (!source || monster.source === source);
}

function isCustomSource(source) {
	return String(source || "").toUpperCase() === "CUSTOM";
}

function normalizeSourceSelection(source) {
	if (isCustomSource(source)) return "CUSTOM";
	return source || "all";
}

function clearMonsterUrlSelection() {
	const params = new URLSearchParams(window.location.search);
	params.delete("monster");
	params.delete("m_source");
	window.history.replaceState({}, "", `?${params.toString()}`);
}

function cloneCustomMonsters(monsters) {
	return JSON.parse(JSON.stringify(monsters || []));
}

function customMonsterListsEqual(left, right) {
	return JSON.stringify(left || []) === JSON.stringify(right || []);
}

export default function Bestiary({
	onAddMonster,
	isEmbedded = false,
}) {
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector((state) => state.localization.language);
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState("all");
	const [allMonsters, setAllMonsters] = useState([]);
	const [monsters, setMonsters] = useState([]);
	const [search, setSearch] = useState("");
	const [isDetailedSearch, setIsDetailedSearch] = useState(false);
	const [loading, setLoading] = useState(false);
	const [selectedMonster, setSelectedMonster] = useState(null);
	const [legendaryGroups, setLegendaryGroups] = useState([]);
	const [favorites, setFavorites] = useState([]);
	const [onlyFavorites, setOnlyFavorites] = useState(false);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'desc', 'asc'
	const [reloadToken, setReloadToken] = useState(0);
	const [editingMonster, setEditingMonster] = useState(null);
	const [editingMonsterJson, setEditingMonsterJson] = useState("");
	const [editingMonsterError, setEditingMonsterError] = useState("");
	const [isSavingMonsterEdit, setIsSavingMonsterEdit] = useState(false);
	const [aiEditingMonster, setAiEditingMonster] = useState(null);
	const [aiEditMode, setAiEditMode] = useState("edit");
	const [aiActionMonster, setAiActionMonster] = useState(null);
	const [aiEditInstructions, setAiEditInstructions] = useState("");
	const [aiEditError, setAiEditError] = useState("");
	const [isAiEditingMonster, setIsAiEditingMonster] = useState(false);
	const [aiModels, setAiModels] = useState([]);
	const [selectedAiModel, setSelectedAiModel] = useState("");
	const [aiDraftResponseEntry, setAiDraftResponseEntry] = useState(null);
	const [isRestoringAiResponse, setIsRestoringAiResponse] = useState(false);
	const [undoStack, setUndoStack] = useState([]);
	const [redoStack, setRedoStack] = useState([]);
	const listRef = useRef(null);
	const customImportInputRef = useRef(null);
	const selectedMonsterRef = useRef(null);
	const aiDraftResponseRef = useRef(null);
	const hasInitializedSourceRef = useRef(false);
	const shouldAutoSelectMonsterRef = useRef(true);

	const sourceOptions = useMemo(
		() => sources.filter((source) => !isCustomSource(source)),
		[sources],
	);

	useEffect(() => {
		selectedMonsterRef.current = selectedMonster;
	}, [selectedMonster]);

	const displayedMonsters = useMemo(() => {
		let list = [...monsters];
		if (sortOrder === "none") {
			return list;
		}

		return list.sort((a, b) => {
			const crA = parseCR(a);
			const crB = parseCR(b);
			if (crA === crB) {
				return a.name.localeCompare(b.name);
			}
			return sortOrder === "desc" ? crB - crA : crA - crB;
		});
	}, [monsters, sortOrder]);

	const customMonsters = useMemo(
		() => allMonsters.filter((monster) => isCustomSource(monster.source)),
		[allMonsters],
	);
	const aiDraftDiffResources = useMemo(
		() =>
			buildDiffResources(aiDraftResponseEntry, {
				creature: lang.t("Creature"),
			}),
		[aiDraftResponseEntry],
	);

	const pushCustomUndoSnapshot = (snapshot) => {
		setUndoStack((current) =>
			addUndoSnapshot(current, snapshot, cloneCustomMonsters),
		);
		setRedoStack(clearRedoStack());
	};

	const pushCustomUndo = () => {
		pushCustomUndoSnapshot(customMonsters);
	};

	const applyCustomMonsterList = (nextCustomMonsters, options = {}) => {
		const selectedName = options.selectedName;
		const nextSelected = selectedName
			? nextCustomMonsters.find((monster) => monster.name === selectedName)
			: null;
		setAllMonsters((current) => [
			...current.filter((item) => !isCustomSource(item.source)),
			...nextCustomMonsters,
		]);
		if (nextSelected) {
			setSelectedSource("CUSTOM");
			shouldAutoSelectMonsterRef.current = true;
			selectedMonsterRef.current = nextSelected;
			setSelectedMonster(nextSelected);
		} else if (options.clearSelection) {
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = "";
			setSelectedMonster("");
			clearMonsterUrlSelection();
		}
	};

	const restoreCustomMonsters = async (nextCustomMonsters, options = {}) => {
		const updated = await api.replaceCustomBestiaryMonsters(nextCustomMonsters);
		applyCustomMonsterList(Array.isArray(updated) ? updated : [], options);
		return Array.isArray(updated) ? updated : [];
	};

	const handleUndo = async () => {
		if (undoStack.length === 0) return;
		const transition = createUndoTransition({
			undoStack,
			redoStack,
			current: customMonsters,
			clone: cloneCustomMonsters,
		});
		if (!transition.target) return;
		try {
			await restoreCustomMonsters(transition.target, { clearSelection: true });
			setUndoStack(transition.undoStack);
			setRedoStack(transition.redoStack);
		} catch (err) {
			dispatch(alert({ title: lang.t("Undo error"), message: err.message }));
		}
	};

	const handleRedo = async () => {
		if (redoStack.length === 0) return;
		const transition = createRedoTransition({
			undoStack,
			redoStack,
			current: customMonsters,
			clone: cloneCustomMonsters,
		});
		if (!transition.target) return;
		try {
			await restoreCustomMonsters(transition.target, { clearSelection: true });
			setRedoStack(transition.redoStack);
			setUndoStack(transition.undoStack);
		} catch (err) {
			dispatch(alert({ title: lang.t("Redo error"), message: err.message }));
		}
	};

	// Допоміжна функція для отримання текстового представлення типу монстра
	// Завантаження списку доступних джерел (файлів)
	useEffect(() => {
		const loadInitialData = async () => {
			try {
				const [sourcesData, legendaryData, favData] = await Promise.all([
					api.getBestiarySources(),
					api.getLegendaryGroups(),
					api.getBestiaryFavorites(),
				]);
				setSources(sourcesData);
				setLegendaryGroups(legendaryData); // Зберігаємо дані легендарних груп
				setFavorites(favData);
				if (sourcesData.length > 0) {
					const params = new URLSearchParams(window.location.search);
					const sourceFromUrl = params.get("source");
					if (!hasInitializedSourceRef.current) {
						setSelectedSource(normalizeSourceSelection(sourceFromUrl));
						hasInitializedSourceRef.current = true;
					}
				}
			} catch (err) {
				console.error(
					"Failed to load bestiary sources or legendary groups",
					err,
				);
			}
		};
		loadInitialData();
	}, []);

	// Завантаження повного списку монстрів один раз; джерела далі фільтруються локально
	useEffect(() => {
		if (sources.length === 0) return;

		const loadData = async () => {
			setLoading(true);
			try {
				const data = await api.getBestiaryData("all");
				const combinedList = Array.isArray(data)
					? data
					: data.monster || data.monsters || data.results || [];

				// Об'єднуємо дані монстрів з легендарними діями/регіональними ефектами

				const enrichedMonsters = combinedList.map((monster) => {
					// Шукаємо групу: або за спеціальним посиланням legendaryGroup, або за ім'ям самого монстра
					const groupRef = monster.legendaryGroup;
					const targetName = groupRef?.name || monster.name;
					const targetSource = groupRef?.source || monster.source;

					const legendaryEntry = legendaryGroups.find(
						(lg) =>
							lg.name === targetName &&
							lg.source?.toUpperCase() === targetSource?.toUpperCase(),
					);
					if (legendaryEntry) {
						return {
							...monster,
							lairActions: legendaryEntry.lairActions,
							regionalEffects: legendaryEntry.regionalEffects,
						};
					}
					return monster;
				});
				setAllMonsters((current) => [
					...enrichedMonsters,
					...current.filter((monster) => isCustomSource(monster.source)),
				]);
			} catch (error) {
				console.error("Failed to load local monsters", error);
			} finally {
				setLoading(false);
			}
		};
		loadData();
	}, [sources, legendaryGroups]);

	useEffect(() => {
		if (sources.length === 0) return;

		const loadCustomData = async () => {
			try {
				const customData = await api.getCustomBestiaryData();
				const customList = Array.isArray(customData)
					? customData
					: customData.monster || customData.monsters || customData.results || [];
				const enrichedCustomMonsters = customList.map((monster) => {
					const groupRef = monster.legendaryGroup;
					const targetName = groupRef?.name || monster.name;
					const targetSource = groupRef?.source || monster.source;
					const legendaryEntry = legendaryGroups.find(
						(lg) =>
							lg.name === targetName &&
							lg.source?.toUpperCase() === targetSource?.toUpperCase(),
					);
					if (!legendaryEntry) return monster;
					return {
						...monster,
						lairActions: legendaryEntry.lairActions,
						regionalEffects: legendaryEntry.regionalEffects,
					};
				});
				setAllMonsters((current) => [
					...current.filter((monster) => !isCustomSource(monster.source)),
					...enrichedCustomMonsters,
				]);
			} catch (error) {
				console.error("Failed to load custom monsters", error);
			}
		};
		loadCustomData();
	}, [sources, legendaryGroups, reloadToken]);

	useEffect(() => {
		if (!aiEditingMonster || aiModels.length > 0) return;
		api
			.listAiModels()
			.then((result) => {
				const models = Array.isArray(result?.models) ? result.models : [];
				setAiModels(models);
				setSelectedAiModel(
					(current) => current || result?.defaultModel || models[0]?.name || "",
				);
			})
			.catch((err) => {
				console.error("Failed to load AI models", err);
				setAiEditError(err.message || lang.t("Failed to connect to AI."));
			});
	}, [aiEditingMonster, aiModels.length]);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		params.set("source", selectedSource);
		window.history.replaceState({}, "", `?${params.toString()}`);
	}, [selectedSource]);

	// Локальна фільтрація списку за пошуковим запитом
	useEffect(() => {
		const filtered = allMonsters.filter((m) => {
			const isFav = favorites.some(
				(f) =>
					f.name === m.name &&
					f.source?.toUpperCase() === m.source?.toUpperCase(),
			);
			if (onlyFavorites && !isFav) return false;
			const matchesSource =
				selectedSource === "all" ||
				m.source?.toUpperCase() === selectedSource.toUpperCase();
			if (!onlyFavorites && !matchesSource) return false;

			return isDetailedSearch
				? objectMatchesSearch(m, search)
				: matchesMonsterSearch(m, search);
		});
		setMonsters(filtered);
	}, [
		search,
		allMonsters,
		onlyFavorites,
		favorites,
		selectedSource,
		isDetailedSearch,
	]);

	const handleToggleFavorite = async (monster) => {
		try {
			const newFavs = await api.toggleBestiaryFavorite(
				monster.name,
				monster.source,
			);
			setFavorites(newFavs);
		} catch (err) {
			console.error("Failed to toggle favorite", err);
		}
	};

	const handleCustomBestiaryUpdate = (updated, options = {}) => {
		const hasUpdatedCustomMonsters = Array.isArray(updated?.monsters);
		const updatedCustomMonsters = hasUpdatedCustomMonsters ? updated.monsters : [];
		if (hasUpdatedCustomMonsters && options.trackUndo !== false) {
			pushCustomUndo();
		}
		const generatedMonsters = Array.isArray(options?.generated?.monsters)
			? options.generated.monsters
			: [];
		const firstGeneratedMonster = generatedMonsters[0];
		const selectedGeneratedMonster = firstGeneratedMonster
			? updatedCustomMonsters.find(
					(monster) =>
						monster.name === firstGeneratedMonster.name &&
						isCustomSource(monster.source),
				) || firstGeneratedMonster
			: null;
		const selectedUpdatedMonster = options.selectedName
			? updatedCustomMonsters.find(
					(monster) =>
						monster.name === options.selectedName &&
						isCustomSource(monster.source),
				)
			: null;
		const nextSelectedMonster =
			selectedGeneratedMonster || selectedUpdatedMonster;

		setSelectedSource("CUSTOM");
		shouldAutoSelectMonsterRef.current = true;
		if (hasUpdatedCustomMonsters) {
			setAllMonsters((current) => [
				...current.filter((item) => !isCustomSource(item.source)),
				...updatedCustomMonsters,
			]);
		}
		if (nextSelectedMonster) {
			selectedMonsterRef.current = nextSelectedMonster;
			setSelectedMonster(nextSelectedMonster);
		}
		setReloadToken((value) => value + 1);
	};

	const openEditCustomMonster = (monster) => {
		if (!isCustomSource(monster?.source)) return;
		setEditingMonster(monster);
		setEditingMonsterJson(JSON.stringify(monster, null, 2));
		setEditingMonsterError("");
	};

	const closeEditCustomMonster = () => {
		if (isSavingMonsterEdit) return;
		setEditingMonster(null);
		setEditingMonsterJson("");
		setEditingMonsterError("");
	};

	const openAiEditCustomMonster = (monster, mode = "edit") => {
		if (!monster?.name) return;
		if (mode === "edit" && !isCustomSource(monster.source)) return;
		setAiEditMode(mode);
		setAiEditingMonster(monster);
		setAiEditInstructions("");
		setAiEditError("");
	};

	const closeAiEditCustomMonster = () => {
		if (isAiEditingMonster) return;
		setAiEditingMonster(null);
		setAiEditMode("edit");
		setAiEditInstructions("");
		setAiEditError("");
	};

	const openMonsterAiAction = (monster) => {
		if (!monster?.name) return;
		if (isCustomSource(monster.source)) {
			setAiActionMonster(monster);
			return;
		}
		openAiEditCustomMonster(monster, "create-based");
	};

	const closeMonsterAiAction = () => {
		if (isAiEditingMonster) return;
		setAiActionMonster(null);
	};

	const chooseMonsterAiAction = (mode) => {
		if (!aiActionMonster) return;
		const target = aiActionMonster;
		setAiActionMonster(null);
		openAiEditCustomMonster(target, mode);
	};

	const saveEditedCustomMonster = async () => {
		if (!editingMonster?.name) return;
		setEditingMonsterError("");

		let parsed;
		try {
			parsed = JSON.parse(editingMonsterJson);
		} catch (err) {
			setEditingMonsterError(err.message || lang.t("Invalid JSON."));
			return;
		}

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			setEditingMonsterError(lang.t("Monster data must be a JSON object."));
			return;
		}
		if (!String(parsed.name || "").trim()) {
			setEditingMonsterError(lang.t("Name is required to create an entry."));
			return;
		}

		setIsSavingMonsterEdit(true);
		const undoSnapshot = cloneCustomMonsters(customMonsters);
		try {
			const updatedMonster = await api.updateCustomBestiaryMonster(
				editingMonster.name,
				{ monster: { ...parsed, source: "CUSTOM" } },
			);
			pushCustomUndoSnapshot(undoSnapshot);
			shouldAutoSelectMonsterRef.current = true;
			setAllMonsters((current) => [
				...current.filter(
					(item) =>
						!isCustomSource(item.source) ||
						!(
							item.name === editingMonster.name ||
							item.name === updatedMonster.name
						),
				),
				updatedMonster,
			]);
			setSelectedSource("CUSTOM");
			setSelectedMonster(updatedMonster);
			selectedMonsterRef.current = updatedMonster;
			setEditingMonster(null);
			setEditingMonsterJson("");
			setEditingMonsterError("");
			if (editingMonster.name !== updatedMonster.name) {
				setFavorites((current) =>
					current.map((favorite) =>
						favorite.name === editingMonster.name &&
						isCustomSource(favorite.source)
							? { ...favorite, name: updatedMonster.name, source: "CUSTOM" }
							: favorite,
					),
				);
			}
		} catch (err) {
			setEditingMonsterError(err.message || lang.t("Unknown error"));
		} finally {
			setIsSavingMonsterEdit(false);
		}
	};

	const saveAiEditedCustomMonster = async () => {
		if (!aiEditingMonster?.name) return;
		const instructions = aiEditInstructions.trim();
		const isCreateBasedMode = aiEditMode === "create-based";
		if (!instructions && !isCreateBasedMode) {
			setAiEditError(lang.t("Describe what to change."));
			return;
		}
		const finalInstructions = isCreateBasedMode
			? [
					lang.t(
						"Create a new custom creature based on the selected creature. Do not change the selected creature.",
					),
					instructions,
				]
					.filter(Boolean)
					.join("\n\n")
			: instructions;

		setIsAiEditingMonster(true);
		setAiEditError("");
		try {
			const data = await api.generateAi({
				type: "custom-monster",
				modelName: selectedAiModel || undefined,
				userInstructions: finalInstructions,
				path: { campaign: "bestiary" },
				customMonsterTarget: aiEditingMonster,
				customMonsterMode: aiEditMode,
				parseAIResponse: true,
				generateCharacters: false,
				generateNpcs: false,
				generateLocations: false,
				generateEncounters: false,
				entityScope: "custom-bestiary",
				contextConfig: null,
				language: currentLanguage,
			});
			if (data.draft && data.aiResponse) {
				setAiDraftResponseEntry(
					addSourceMonsterImageToDraft(data.aiResponse, aiEditingMonster),
				);
			} else if (data.updated) {
				handleCustomBestiaryUpdate(data.updated, {
					generated: data.generated,
					selectedName:
						aiEditMode === "edit" ? aiEditingMonster.name : undefined,
					trackUndo: false,
				});
			}
			setAiEditingMonster(null);
			setAiEditMode("edit");
			setAiEditInstructions("");
		} catch (err) {
			setAiEditError(err.message || lang.t("Unknown error"));
		} finally {
			setIsAiEditingMonster(false);
		}
	};

	const saveAiDraftResponseChanges = async (resources) => {
		if (!aiDraftResponseEntry?.id) return null;
		const updatedEntry = await api.updateAiResponse("bestiary", aiDraftResponseEntry.id, {
			resources: resources.map((resource) => {
				const sourceResource = aiDraftResponseEntry.changes?.resources?.find(
					(item) => item.id === resource.id,
				);
				const after = {
					...(resource.after || {}),
				};
				if (
					after &&
					sourceResource?.after?.imageUrl &&
					!after.imageUrl
				) {
					after.imageUrl = sourceResource.after.imageUrl;
				}
				if (
					after &&
					sourceResource?.after?.originalBestiaryName &&
					!after.originalBestiaryName
				) {
					after.originalBestiaryName = sourceResource.after.originalBestiaryName;
				}
				return { ...resource, after };
			}),
		});
		if (updatedEntry) {
			setAiDraftResponseEntry(updatedEntry);
		}
		return updatedEntry;
	};

	const restoreAiDraftResponse = async (
		entry = aiDraftResponseEntry,
		mode = "apply",
		options = {},
	) => {
		if (!entry?.id || isRestoringAiResponse) return;
		const undoSnapshot =
			mode === "apply" ? cloneCustomMonsters(customMonsters) : null;
		setIsRestoringAiResponse(true);
		try {
			const result =
				mode === "undo"
					? await api.undoAiResponse("bestiary", entry.id, {
							resourceIds: options.resourceIds,
						})
					: await api.applyAiResponse("bestiary", entry.id, {
							resourceIds: options.resourceIds,
						});
			const nextEntry = result?.response || entry;
			setAiDraftResponseEntry(nextEntry);
			if (mode !== "undo" && result?.updated) {
				if (
					undoSnapshot &&
					!customMonsterListsEqual(undoSnapshot, result.updated.monsters)
				) {
					pushCustomUndoSnapshot(undoSnapshot);
				}
				handleCustomBestiaryUpdate(result.updated, {
					selectedName: getFirstChangedMonsterName(nextEntry, options.resourceIds),
					trackUndo: false,
				});
			}
			if (mode === "undo" && result?.updated) {
				handleCustomBestiaryUpdate(result.updated, {
					clearSelection: true,
					trackUndo: false,
				});
			}
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("AI history error"),
					message: err.message || lang.t("Unknown error"),
				}),
			);
		} finally {
			setIsRestoringAiResponse(false);
		}
	};

	const closeAiDraftResponse = () => {
		if (isRestoringAiResponse) return;
		setAiDraftResponseEntry(null);
	};

	const handleDeleteCustomMonster = async (monster) => {
		if (!isCustomSource(monster?.source) || !monster?.name) return;
		const confirmed = await dispatch(
			confirm({
				title: lang.t("Delete custom creature"),
				message: lang.t("Delete custom creature \"{name}\"?", {
					name: monster.name,
				}),
			}),
		);
		if (!confirmed) return;

		const undoSnapshot = cloneCustomMonsters(customMonsters);
		try {
			const updatedCustomMonsters = await api.deleteCustomBestiaryMonster(
				monster.name,
			);
			pushCustomUndoSnapshot(undoSnapshot);
			shouldAutoSelectMonsterRef.current = false;
			selectedMonsterRef.current = "";
			setSelectedMonster("");
			clearMonsterUrlSelection();
			setAllMonsters((current) => [
				...current.filter((item) => !isCustomSource(item.source)),
				...(Array.isArray(updatedCustomMonsters) ? updatedCustomMonsters : []),
			]);
			setFavorites((current) =>
				current.filter(
					(favorite) =>
						!(
							favorite.name === monster.name &&
							isCustomSource(favorite.source)
					),
				),
			);
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Delete error"),
					message: err.message || lang.t("Unknown error"),
				}),
			);
		}
	};

	const handleExportCustomMonsters = () => {
		downloadJsonFile(
			{
				version: 1,
				type: "custom-bestiary",
				exportedAt: new Date().toISOString(),
				monster: customMonsters,
			},
			`custom-bestiary-${new Date().toISOString().slice(0, 10)}.json`,
		);
	};

	const handleImportCustomMonsters = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		try {
			const raw = await file.text();
			const parsed = JSON.parse(raw);
			const imported = Array.isArray(parsed)
				? parsed
				: parsed.monster || parsed.monsters || parsed.results || [];
			if (!Array.isArray(imported) || imported.length === 0) {
				throw new Error(lang.t("No custom creatures found in file."));
			}
			const validImported = imported.filter((monster) =>
				String(monster?.name || "").trim(),
			);
			if (validImported.length === 0) {
				throw new Error(lang.t("No custom creatures found in file."));
			}
			const undoSnapshot = cloneCustomMonsters(customMonsters);
			const byName = new Map(
				customMonsters.map((monster) => [
					String(monster.name || "").trim().toLowerCase(),
					monster,
				]),
			);
			validImported.forEach((monster) => {
				const name = String(monster?.name || "").trim();
				byName.set(name.toLowerCase(), { ...monster, name, source: "CUSTOM" });
			});
			await restoreCustomMonsters([...byName.values()], {
				selectedName: validImported[0].name,
			});
			pushCustomUndoSnapshot(undoSnapshot);
			setSelectedSource("CUSTOM");
			dispatch(
				alert({
					title: lang.t("Import custom creatures"),
					message: lang.t("Imported custom creatures: {count}", {
						count: validImported.length,
					}),
				}),
			);
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Import error"),
					message: err.message || lang.t("Unknown error"),
				}),
			);
		}
	};

	useEffect(() => {
		const syncSelectionFromUrl = () => {
			const params = new URLSearchParams(window.location.search);
			const urlMonsterName = params.get("monster");
			const urlMonsterSource = params.get("m_source");
			const currentMonster = selectedMonsterRef.current;

			if (!urlMonsterName) {
				// Якщо нічого не вибрано в URL, але монстри завантажені — вибираємо першого
				if (
					shouldAutoSelectMonsterRef.current &&
					displayedMonsters.length > 0 &&
					!currentMonster?.name
				) {
					setSelectedMonster(displayedMonsters[0]);
				}
				return;
			}

			// Якщо в URL той самий монстр, що вже вибраний - нічого не робимо
			if (monsterMatchesUrl(currentMonster, urlMonsterName, urlMonsterSource)) {
				return;
			}

			// Шукаємо в поточному видимому списку для прокрутки; деталі можна
			// показати й для монстра, який не підпадає під активний пошук.
			const foundInList = displayedMonsters.findIndex(
				(m) => monsterMatchesUrl(m, urlMonsterName, urlMonsterSource),
			);

			const monster =
				displayedMonsters[foundInList] ||
				allMonsters.find((m) =>
					monsterMatchesUrl(m, urlMonsterName, urlMonsterSource),
				);

			if (monster) {
				setSelectedMonster(monster);
				if (foundInList >= 0) {
					setTimeout(() => listRef?.current?.scrollTo(foundInList), 0);
				}
			} else if (monsterMatchesUrl(currentMonster, urlMonsterName, urlMonsterSource)) {
				shouldAutoSelectMonsterRef.current = false;
				setSelectedMonster("");
			}
		};

		// Ініціалізація при зміні списку всіх монстрів
		if (displayedMonsters.length > 0 || allMonsters.length > 0) {
			syncSelectionFromUrl();
		}

		window.addEventListener("popstate", syncSelectionFromUrl);
		return () => window.removeEventListener("popstate", syncSelectionFromUrl);
	}, [allMonsters, displayedMonsters]);

	useEffect(() => {
		if (selectedMonster?.name) {
			const params = new URLSearchParams(window.location.search);
			let changed = false;
			if (params.get("monster") !== selectedMonster.name) {
				params.set("monster", selectedMonster.name);
				changed = true;
			}
			if (params.get("m_source") !== selectedMonster.source) {
				params.set("m_source", selectedMonster.source || "");
				changed = true;
			}
			if (changed) {
				window.history.pushState({}, "", `?${params.toString()}`);
			}
		} else if (selectedMonster === "") {
			const params = new URLSearchParams(window.location.search);
			if (params.has("monster") || params.has("m_source")) {
				clearMonsterUrlSelection();
			}
		}
	}, [selectedMonster]);

	const toggleSort = () => {
		setSortOrder((prev) => {
			if (prev === "none") return "desc";
			if (prev === "desc") return "asc";
			return "none";
		});
	};

	function parseCR(monster) {
		const crValue = monster.cr?.cr !== undefined ? monster.cr.cr : monster.cr;
		if (typeof crValue === "number") return crValue;

		const crStr = String(crValue || "0");
		if (crStr.includes("/")) {
			const [num, den] = crStr.split("/").map(Number);
			return den ? num / den : 0;
		}

		return parseFloat(crStr) || 0;
	}

	const bestiaryContent = (
		<BestiaryContent
			displayedMonsters={displayedMonsters}
			favorites={favorites}
			isDetailedSearch={isDetailedSearch}
			isEmbedded={isEmbedded}
			listRef={listRef}
			loading={loading}
			onAddMonster={onAddMonster}
			onAiEditCustomMonster={openAiEditCustomMonster}
			onDeleteCustomMonster={handleDeleteCustomMonster}
			onEditCustomMonster={openEditCustomMonster}
			onFavoriteListChange={setFavorites}
			onMonsterAiAction={openMonsterAiAction}
			onToggleFavorite={handleToggleFavorite}
			onlyFavorites={onlyFavorites}
			search={search}
			selectedMonster={selectedMonster}
			selectedSource={selectedSource}
			setIsDetailedSearch={setIsDetailedSearch}
			setOnlyFavorites={setOnlyFavorites}
			setSearch={setSearch}
			setSelectedMonster={setSelectedMonster}
			setSelectedSource={setSelectedSource}
			sortOrder={sortOrder}
			sourceOptions={sourceOptions}
			sources={sources}
			toggleSort={toggleSort}
		/>
	);

	const bestiaryModals = (
		<>
			<CustomMonsterEditModal
				editingMonster={editingMonster}
				editingMonsterError={editingMonsterError}
				editingMonsterJson={editingMonsterJson}
				isSavingMonsterEdit={isSavingMonsterEdit}
				onCancel={closeEditCustomMonster}
				onJsonChange={setEditingMonsterJson}
				onSave={saveEditedCustomMonster}
			/>
			<MonsterAiActionModal
				aiActionMonster={aiActionMonster}
				onCancel={closeMonsterAiAction}
				onChoose={chooseMonsterAiAction}
			/>
			<MonsterAiEditModal
				aiEditingMonster={aiEditingMonster}
				aiEditError={aiEditError}
				aiEditInstructions={aiEditInstructions}
				aiEditMode={aiEditMode}
				aiModels={aiModels}
				isAiEditingMonster={isAiEditingMonster}
				onCancel={closeAiEditCustomMonster}
				onInstructionsChange={setAiEditInstructions}
				onModelChange={setSelectedAiModel}
				onSave={saveAiEditedCustomMonster}
				selectedAiModel={selectedAiModel}
			/>
			<BestiaryAiDraftModal
				aiDraftDiffResources={aiDraftDiffResources}
				aiDraftResponseEntry={aiDraftResponseEntry}
				aiDraftResponseRef={aiDraftResponseRef}
				getDiffResourceState={getDiffResourceState}
				getHistoryChangeSummary={getHistoryChangeSummary}
				isRestoringAiResponse={isRestoringAiResponse}
				onApply={(entry) => restoreAiDraftResponse(entry, "apply")}
				onApplyResource={(entry, resourceIds) =>
					restoreAiDraftResponse(entry, "apply", { resourceIds })
				}
				onCancel={closeAiDraftResponse}
				onSaveDraftChanges={saveAiDraftResponseChanges}
				onUndo={(entry) => restoreAiDraftResponse(entry, "undo")}
				onUndoResource={(entry, resourceIds) =>
					restoreAiDraftResponse(entry, "undo", { resourceIds })
				}
			/>
		</>
	);

	if (isEmbedded) {
		return (
			<>
				{bestiaryContent}
				{bestiaryModals}
			</>
		);
	}

	return (
		<Panel className="Bestiary">
			<div className="Panel__header">
				<h2>{lang.t("Bestiary")}</h2>
				<div className="Bestiary__header_actions">
					<input
						ref={customImportInputRef}
						type="file"
						accept=".json"
						style={{ display: "none" }}
						onChange={handleImportCustomMonsters}
					/>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="import"
						onClick={() => customImportInputRef.current?.click()}
						title={lang.t("Import custom creatures")}
					>
						{lang.t("Import")}
					</Button>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="export"
						onClick={handleExportCustomMonsters}
						disabled={customMonsters.length === 0}
						title={lang.t("Export custom creatures")}
					>
						{lang.t("Export")}
					</Button>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="undo"
						onClick={handleUndo}
						disabled={undoStack.length === 0}
						title={lang.t("Undo (Ctrl+Z)")}
					/>
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="redo"
						onClick={handleRedo}
						disabled={redoStack.length === 0}
						title={lang.t("Redo (Ctrl+Y)")}
					/>
				</div>
			</div>
			<div className="Panel__body">{bestiaryContent}</div>
			<AiAssistantPanel
				bestiaryMode
				sessionData={{}}
				onInsertResult={handleCustomBestiaryUpdate}
			/>
			{bestiaryModals}
		</Panel>
	);
}
