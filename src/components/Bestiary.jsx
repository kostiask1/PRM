import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router";
import { api } from "../api";
import { alert, confirm } from "../actions/app";
import { useAppDispatch, useAppSelector } from "../store/appStore";
import Panel from "./common/Panel";
import Button from "./form/Button";
import BestiaryAiDraftModal from "./bestiary/BestiaryAiDraftModal";
import BestiaryContent from "./bestiary/BestiaryContent";
import MonsterFieldEditModal from "./bestiary/MonsterFieldEditModal";
import MonsterAiActionModal from "./bestiary/MonsterAiActionModal";
import MonsterAiEditModal from "./bestiary/MonsterAiEditModal";
import useDebounce from "../hooks/useDebounce.js";
import { buildDiffResources } from "../utils/aiDiff.js";
import {
	addSourceMonsterImageToDraft,
	getFirstChangedMonsterName,
	getHistoryChangeSummary as getAiHistoryChangeSummary,
	getLocalizedDiffResourceState,
} from "../utils/aiResponseHelpers.js";
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

function translate(...args) {
	return lang.t(...args);
}

function getHistoryChangeSummary(entry) {
	return getAiHistoryChangeSummary(entry, translate);
}

function getDiffResourceState(resource) {
	return getLocalizedDiffResourceState(resource, translate);
}

function monsterMatchesUrl(monster, name, source) {
	return monster?.name === name && (!source || monster.source === source);
}

function isCustomSource(source) {
	return String(source || "").toUpperCase() === "CUSTOM";
}

function isSameMonsterIdentity(left, right) {
	return (
		String(left?.name || "").trim() === String(right?.name || "").trim() &&
		String(left?.source || "").toUpperCase() ===
			String(right?.source || "").toUpperCase()
	);
}

function getMonsterListIndex(monsters, selectedMonster) {
	if (!selectedMonster?.name) return -1;
	return monsters.findIndex((monster) =>
		isSameMonsterIdentity(monster, selectedMonster),
	);
}

function normalizeSourceSelection(source) {
	if (isCustomSource(source)) return "CUSTOM";
	return source || "all";
}

function cloneCustomMonsters(monsters) {
	return JSON.parse(JSON.stringify(monsters || []));
}

function customMonsterListsEqual(left, right) {
	return JSON.stringify(left || []) === JSON.stringify(right || []);
}

export default function Bestiary({ onAddMonster, isEmbedded = false }) {
	const [urlSearchParams, setUrlSearchParams] = useSearchParams();
	const dispatch = useAppDispatch();
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);
	const syncEvent = useAppSelector((state) => state.sync.event);
	const urlSelectedSource = isEmbedded
		? ""
		: urlSearchParams.get("source") || "";
	const urlMonsterName = isEmbedded ? "" : urlSearchParams.get("monster") || "";
	const urlMonsterSource = isEmbedded
		? ""
		: urlSearchParams.get("m_source") || "";
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState(() =>
		normalizeSourceSelection(urlSelectedSource),
	);
	const [allMonsters, setAllMonsters] = useState([]);
	const [monsters, setMonsters] = useState([]);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounce(search, useSearchDebounce ? 250 : 0);
	const [isDetailedSearch, setIsDetailedSearch] = useState(false);
	const [loading, setLoading] = useState(false);
	const [selectedMonster, setSelectedMonster] = useState(null);
	const [legendaryGroups, setLegendaryGroups] = useState([]);
	const [favorites, setFavorites] = useState([]);
	const [onlyFavorites, setOnlyFavorites] = useState(false);
	const [sortOrder, setSortOrder] = useState("none"); // 'none', 'desc', 'asc'
	const [reloadToken, setReloadToken] = useState(0);
	const [fieldEditingMonster, setFieldEditingMonster] = useState(null);
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
	const aiEditControllerRef = useRef(null);
	const shouldAutoSelectMonsterRef = useRef(true);
	const hasScrolledToInitialMonsterRef = useRef(false);

	const sourceOptions = useMemo(
		() => sources.filter((source) => !isCustomSource(source)),
		[sources],
	);

	useEffect(() => {
		selectedMonsterRef.current = selectedMonster;
	}, [selectedMonster]);

	const clearMonsterUrlSelection = useCallback(() => {
		setUrlSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.delete("monster");
				next.delete("m_source");
				return next;
			},
			{ replace: true },
		);
	}, [setUrlSearchParams]);

	useEffect(() => {
		return () => {
			aiEditControllerRef.current?.abort();
		};
	}, []);

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

	// Load available source files.
	useEffect(() => {
		const loadInitialData = async () => {
			try {
				const [sourcesData, legendaryData, favData] = await Promise.all([
					api.getBestiarySources(),
					api.getLegendaryGroups(),
					api.getBestiaryFavorites(),
				]);
				setSources(sourcesData);
				setLegendaryGroups(legendaryData); // Keep legendary group data.
				setFavorites(favData);
			} catch (err) {
				console.error(
					"Failed to load bestiary sources or legendary groups",
					err,
				);
			}
		};
		loadInitialData();
	}, []);

	useEffect(() => {
		if (isEmbedded || !urlSelectedSource) return;
		const nextSource = normalizeSourceSelection(urlSelectedSource);
		setSelectedSource((current) =>
			current === nextSource ? current : nextSource,
		);
	}, [isEmbedded, urlSelectedSource]);

	useEffect(() => {
		if (!syncEvent?.version) return;
		if (!["bestiary", "custom-bestiary", "ai"].includes(syncEvent.resource)) {
			return;
		}

		api
			.getBestiaryFavorites()
			.then(setFavorites)
			.catch((error) =>
				console.error("Failed to reload bestiary favorites", error),
			);
		if (syncEvent.resource === "custom-bestiary" || syncEvent.resource === "ai") {
			setReloadToken((current) => current + 1);
		}
	}, [syncEvent]);

	// Load the full monster list once; sources are filtered locally after that.
	useEffect(() => {
		if (sources.length === 0) return;

		const loadData = async () => {
			setLoading(true);
			try {
				const data = await api.getBestiaryData("all");
				const combinedList = Array.isArray(data)
					? data
					: data.monster || data.monsters || data.results || [];

				// Merge monsters with legendary actions and regional effects.

				const enrichedMonsters = combinedList.map((monster) => {
					// Find a group by explicit legendaryGroup reference or monster name.
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
					: customData.monster ||
						customData.monsters ||
						customData.results ||
						[];
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
				const currentSelected = selectedMonsterRef.current;
				if (currentSelected && isCustomSource(currentSelected.source)) {
					const nextSelected =
						enrichedCustomMonsters.find((monster) =>
							isSameMonsterIdentity(monster, currentSelected),
						) || null;
					selectedMonsterRef.current = nextSelected || "";
					setSelectedMonster(nextSelected || "");
				}
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
		if (isEmbedded) return;
		if (normalizeSourceSelection(urlSelectedSource) === selectedSource) return;
		setUrlSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("source", selectedSource);
				return next;
			},
			{ replace: true },
		);
	}, [isEmbedded, selectedSource, setUrlSearchParams, urlSelectedSource]);

	// Local search filtering.
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
				? objectMatchesSearch(m, debouncedSearch)
				: matchesMonsterSearch(m, debouncedSearch);
		});
		setMonsters(filtered);
	}, [
		debouncedSearch,
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
		const updatedCustomMonsters = hasUpdatedCustomMonsters
			? updated.monsters
			: [];
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
		setFieldEditingMonster(monster);
	};

	const closeEditCustomMonster = () => {
		setFieldEditingMonster(null);
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

	const cancelAiEditCustomMonsterRequest = () => {
		aiEditControllerRef.current?.abort();
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

	const applyUpdatedCustomMonster = (previousName, updatedMonster) => {
		pushCustomUndoSnapshot(cloneCustomMonsters(customMonsters));
		shouldAutoSelectMonsterRef.current = true;
		setAllMonsters((current) => [
			...current.filter(
				(item) =>
					!isCustomSource(item.source) ||
					!(item.name === previousName || item.name === updatedMonster.name),
			),
			updatedMonster,
		]);
		setSelectedSource("CUSTOM");
		setSelectedMonster(updatedMonster);
		selectedMonsterRef.current = updatedMonster;
		if (previousName !== updatedMonster.name) {
			setFavorites((current) =>
				current.map((favorite) =>
					favorite.name === previousName && isCustomSource(favorite.source)
						? { ...favorite, name: updatedMonster.name, source: "CUSTOM" }
						: favorite,
				),
			);
		}
	};

	const saveEditedCustomMonster = async (draftMonster) => {
		if (!fieldEditingMonster?.name || !draftMonster) return;
		try {
			const updatedMonster = await api.updateCustomBestiaryMonster(
				fieldEditingMonster.name,
				{ monster: { ...draftMonster, source: "CUSTOM" } },
			);
			applyUpdatedCustomMonster(fieldEditingMonster.name, updatedMonster);
			setFieldEditingMonster(null);
		} catch (err) {
			dispatch(
				alert({
					title: lang.t("Error"),
					message: err.message || lang.t("Unknown error"),
				}),
			);
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
		const controller = new AbortController();
		aiEditControllerRef.current = controller;
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
			}, { signal: controller.signal });
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
			if (err.name !== "AbortError") {
				setAiEditError(err.message || lang.t("Unknown error"));
			}
		} finally {
			if (aiEditControllerRef.current === controller) {
				aiEditControllerRef.current = null;
			}
			setIsAiEditingMonster(false);
		}
	};

	const saveAiDraftResponseChanges = async (resources) => {
		if (!aiDraftResponseEntry?.id) return null;
		const updatedEntry = await api.updateAiResponse(
			"bestiary",
			aiDraftResponseEntry.id,
			{
				resources: resources.map((resource) => {
					const sourceResource = aiDraftResponseEntry.changes?.resources?.find(
						(item) => item.id === resource.id,
					);
					const after = {
						...(resource.after || {}),
					};
					if (after && sourceResource?.after?.imageUrl && !after.imageUrl) {
						after.imageUrl = sourceResource.after.imageUrl;
					}
					if (
						after &&
						sourceResource?.after?.originalBestiaryName &&
						!after.originalBestiaryName
					) {
						after.originalBestiaryName =
							sourceResource.after.originalBestiaryName;
					}
					return { ...resource, after };
				}),
			},
		);
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
					selectedName: getFirstChangedMonsterName(
						nextEntry,
						options.resourceIds,
					),
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
				message: lang.t('Delete custom creature "{name}"?', {
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
							favorite.name === monster.name && isCustomSource(favorite.source)
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
					String(monster.name || "")
						.trim()
						.toLowerCase(),
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
		if (isEmbedded) return undefined;
		const syncSelectionFromUrl = () => {
			const currentMonster = selectedMonsterRef.current;

			if (!urlMonsterName) {
				// If URL has no selection and monsters are loaded, select the first one.
				if (
					shouldAutoSelectMonsterRef.current &&
					displayedMonsters.length > 0 &&
					!currentMonster?.name
				) {
					setSelectedMonster(displayedMonsters[0]);
				}
				return;
			}

			// If URL points to the current monster, do nothing.
			if (monsterMatchesUrl(currentMonster, urlMonsterName, urlMonsterSource)) {
				return;
			}

			// Search the visible list for scrolling; details can still be shown for
			// a monster that does not match the active search.
			const foundInList = displayedMonsters.findIndex((m) =>
				monsterMatchesUrl(m, urlMonsterName, urlMonsterSource),
			);

			const monster =
				displayedMonsters[foundInList] ||
				allMonsters.find((m) =>
					monsterMatchesUrl(m, urlMonsterName, urlMonsterSource),
				);

			if (monster) {
				setSelectedMonster(monster);
			} else if (
				monsterMatchesUrl(currentMonster, urlMonsterName, urlMonsterSource)
			) {
				shouldAutoSelectMonsterRef.current = false;
				setSelectedMonster("");
			}
		};

		// Initialize when the full monster list changes.
		if (displayedMonsters.length > 0 || allMonsters.length > 0) {
			syncSelectionFromUrl();
		}

		return undefined;
	}, [
		allMonsters,
		displayedMonsters,
		isEmbedded,
		urlMonsterName,
		urlMonsterSource,
	]);

	useEffect(() => {
		if (isEmbedded) return;
		if (selectedMonster?.name) {
			if (
				urlMonsterName === selectedMonster.name &&
				urlMonsterSource === (selectedMonster.source || "")
			) {
				return;
			}
			setUrlSearchParams((current) => {
				const next = new URLSearchParams(current);
				next.set("monster", selectedMonster.name);
				next.set("m_source", selectedMonster.source || "");
				return next;
			});
		} else if (selectedMonster === "") {
			if (urlMonsterName || urlMonsterSource) {
				clearMonsterUrlSelection();
			}
		}
	}, [
		clearMonsterUrlSelection,
		isEmbedded,
		selectedMonster,
		setUrlSearchParams,
		urlMonsterName,
		urlMonsterSource,
	]);

	useEffect(() => {
		if (
			isEmbedded ||
			hasScrolledToInitialMonsterRef.current ||
			!urlMonsterName
		) {
			return undefined;
		}
		const selectedIndex = getMonsterListIndex(displayedMonsters, selectedMonster);
		if (selectedIndex < 0) return undefined;

		hasScrolledToInitialMonsterRef.current = true;
		const frameId = requestAnimationFrame(() => {
			listRef.current?.scrollTo(selectedIndex);
		});
		return () => cancelAnimationFrame(frameId);
	}, [displayedMonsters, isEmbedded, selectedMonster, urlMonsterName]);

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
			searchHighlight={debouncedSearch}
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
			<MonsterFieldEditModal
				editingMonster={fieldEditingMonster}
				onCancel={closeEditCustomMonster}
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
				onCancelRequest={cancelAiEditCustomMonsterRequest}
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
			{bestiaryModals}
		</Panel>
	);
}
