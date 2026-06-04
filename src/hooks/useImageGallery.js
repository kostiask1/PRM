import { useCallback, useEffect, useMemo, useState } from "react";

import { alert, confirm } from "../actions/app";
import { api } from "../api";
import { useAppDispatch } from "../store/appStore";
import { lang } from "../services/localization";
import { IMAGE_GALLERY_CATEGORIES } from "../features/images/imageGalleryConfig";
import useDebounce from "./useDebounce";

export default function useImageGallery({
	isOpen,
	initialSource,
	initialCategory,
	initialSubcategory,
}) {
	const dispatch = useAppDispatch();

	const [campaigns, setCampaigns] = useState([]);
	const [selectedSource, setSelectedSource] = useState("general");
	const [selectedCat, setSelectedCat] = useState(IMAGE_GALLERY_CATEGORIES[0]);
	const [selectedSub, setSelectedSub] = useState("");
	const [dynamicSubs, setDynamicSubs] = useState([]);
	const [officialSubs, setOfficialSubs] = useState(new Set());
	const [officialRootSubs, setOfficialRootSubs] = useState(new Set());
	const [images, setImages] = useState([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchMode, setSearchMode] = useState("local");
	const [storageStats, setStorageStats] = useState(null);
	const [selectedFilenames, setSelectedFilenames] = useState(new Set());
	const [selectedSubs, setSelectedSubs] = useState(new Set());
	const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
	const [loading, setLoading] = useState(false);
	const [isCreatingSub, setIsCreatingSub] = useState(false);
	const [newSubName, setNewSubName] = useState("");
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [dragSource, setDragSource] = useState(null);
	const [dragOverTarget, setDragOverTarget] = useState(null);
	const debouncedSearchQuery = useDebounce(searchQuery, 250);
	const normalizedSearchQuery = searchQuery.trim()
		? debouncedSearchQuery.trim().toLowerCase()
		: "";
	const activeSearchQuery = normalizedSearchQuery ? debouncedSearchQuery : "";
	const isGlobalSearch = searchMode === "global" && normalizedSearchQuery;
	const isSearchResults = Boolean(normalizedSearchQuery);
	const isGeneralTokens =
		selectedSource === "general" && selectedCat.id === "tokens";
	const selectedSubRoot = selectedSub.split("/").filter(Boolean)[0] || "";

	const clearSelection = useCallback(() => {
		setSelectedFilenames(new Set());
		setSelectedSubs(new Set());
		setLastSelectedIndex(null);
	}, []);
	const isProtectedSystemSub = useCallback(
		(name) =>
			selectedSub === "" &&
			(selectedCat.id === "tokens" || selectedCat.id === "characters") &&
			(name === "players" || name === "npc"),
		[selectedCat.id, selectedSub],
	);
	const isReadonlySub = useCallback(
		(name) => isProtectedSystemSub(name) || officialSubs.has(name),
		[isProtectedSystemSub, officialSubs],
	);
	const isReadonlyImage = useCallback(
		(image) => Boolean(image?.readonly || image?.globalSearch),
		[],
	);
	const isReadonlyPath = useCallback(
		(subcategory = "") => {
			const root = String(subcategory || "")
				.split("/")
				.filter(Boolean)[0];
			return Boolean(isGeneralTokens && root && officialRootSubs.has(root));
		},
		[isGeneralTokens, officialRootSubs],
	);
	const isReadonlyCurrentFolder =
		isGeneralTokens && selectedSubRoot && isReadonlyPath(selectedSub);
	const selectImageByName = useCallback(
		(name) => {
			const image = images.find((item) => item.name === name);
			if (!image) return false;
			setSelectedFilenames(new Set([name]));
			setSelectedSubs(new Set());
			setLastSelectedIndex(null);
			return true;
		},
		[images],
	);
	const hasSelection = useMemo(
		() =>
			images.some(
				(image) => selectedFilenames.has(image.name) && !isReadonlyImage(image),
			) || Array.from(selectedSubs).some((name) => !isReadonlySub(name)),
		[
			images,
			selectedFilenames,
			selectedSubs,
			isReadonlyImage,
			isReadonlySub,
		],
	);

	const getCleanName = useCallback((name) => {
		return name.replace(/\.[^/.]+$/, "").replace(/-\d{10,}$/, "");
	}, []);

	const loadSubcategories = useCallback(async () => {
		if (normalizedSearchQuery) {
			setDynamicSubs([]);
			setOfficialSubs(new Set());
			return;
		}
		try {
			const [subs, officialAssets, officialRootAssets] = await Promise.all([
				api.getSubcategories(selectedSource, selectedCat.id, selectedSub),
				isGeneralTokens
					? api.getBestiaryTokenAssets(selectedSub, activeSearchQuery)
					: Promise.resolve(null),
				isGeneralTokens
					? api.getBestiaryTokenAssets("", "")
					: Promise.resolve(null),
			]);
			const nextSubs = Array.isArray(subs) ? subs : [];
			const nextOfficialSubs = Array.isArray(officialAssets?.subcategories)
				? officialAssets.subcategories
				: [];
			const nextOfficialRootSubs = Array.isArray(
				officialRootAssets?.subcategories,
			)
				? officialRootAssets.subcategories
				: nextOfficialSubs;
			setOfficialSubs(new Set(nextOfficialSubs));
			setOfficialRootSubs(new Set(nextOfficialRootSubs));
			setDynamicSubs(
				[...nextSubs, ...nextOfficialSubs].filter((sub) =>
					normalizedSearchQuery
						? sub.toLowerCase().includes(normalizedSearchQuery)
						: true,
				),
			);
		} catch (err) {
			console.error(err);
			setOfficialSubs(new Set());
			setOfficialRootSubs(new Set());
		}
	}, [
		selectedSource,
		selectedCat.id,
		selectedSub,
		isGeneralTokens,
		activeSearchQuery,
		normalizedSearchQuery,
	]);

	const loadImages = useCallback(async () => {
		setLoading(true);
		try {
			if (normalizedSearchQuery) {
				const result = await api.searchImageGallery({
					search: debouncedSearchQuery,
					source: isGlobalSearch ? "" : selectedSource,
					category: isGlobalSearch ? "" : selectedCat.id,
					subcategory: isGlobalSearch ? "" : selectedSub,
					categories: IMAGE_GALLERY_CATEGORIES.map((category) => category.id),
				});
				setImages(Array.isArray(result?.images) ? result.images : []);
				return;
			}
			const [data, officialAssets] = await Promise.all([
				api.getImages(selectedSource, selectedCat.id, selectedSub),
				isGeneralTokens
					? api.getBestiaryTokenAssets(selectedSub, activeSearchQuery)
					: Promise.resolve(null),
			]);
			const userImages = (Array.isArray(data) ? data : []).filter((image) =>
				normalizedSearchQuery
					? image.name.toLowerCase().includes(normalizedSearchQuery)
					: true,
			);
			const officialImages = Array.isArray(officialAssets?.images)
				? officialAssets.images
				: [];
			setImages([...userImages, ...officialImages]);
		} catch (err) {
			console.error("Failed to load images:", err);
			setImages([]);
		} finally {
			setLoading(false);
		}
	}, [
		selectedSource,
		selectedCat.id,
		selectedSub,
		isGeneralTokens,
		isGlobalSearch,
		activeSearchQuery,
		debouncedSearchQuery,
		normalizedSearchQuery,
	]);

	const loadStorageStats = useCallback(async () => {
		try {
			const stats = await api.getImageGalleryStats(
				selectedSource,
				selectedCat.id,
				selectedSub,
				IMAGE_GALLERY_CATEGORIES.map((category) => category.id),
			);
			setStorageStats(stats || null);
		} catch (err) {
			console.error("Failed to load image gallery storage stats:", err);
			setStorageStats(null);
		}
	}, [selectedSource, selectedCat.id, selectedSub]);

	useEffect(() => {
		if (isOpen) {
			api.listCampaigns().then(setCampaigns);

			if (initialSource) setSelectedSource(initialSource);
			if (initialCategory) {
				const cat = IMAGE_GALLERY_CATEGORIES.find(
					(c) => c.id === initialCategory,
				);
				if (cat) {
					setSelectedCat(cat);
					setSelectedSub(initialSubcategory || "");
				}
			}
		}
	}, [isOpen, initialSource, initialCategory, initialSubcategory]);

	useEffect(() => {
		if (isOpen) {
			loadImages();
			loadSubcategories();
			loadStorageStats();
		}
		setSelectedFilenames(new Set());
		setSelectedSubs(new Set());
		setLastSelectedIndex(null);
	}, [
		selectedSource,
		selectedCat,
		selectedSub,
		isOpen,
		searchMode,
		loadImages,
		loadSubcategories,
		loadStorageStats,
	]);

	const handleFileUpload = useCallback(
		async (files) => {
			if (isReadonlyCurrentFolder) return;
			setLoading(true);
			try {
				for (const file of Array.from(files || [])) {
					if (!file.type.startsWith("image/")) continue;
					await api.uploadImage(
						selectedSource,
						selectedCat.id,
						selectedSub,
						file,
					);
				}
				loadImages();
				loadStorageStats();
			} catch (err) {
				console.error("Upload failed:", err);
			} finally {
				setLoading(false);
			}
		},
		[
			selectedSource,
			selectedCat.id,
			selectedSub,
			isReadonlyCurrentFolder,
			loadImages,
			loadStorageStats,
		],
	);

	const handleDrop = useCallback(
		async (e, dest) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDraggingOver(false);
			setDragOverTarget(null);
			setDragSource(null);
			if (dest.readonly) return;
			setLoading(true);

			try {
				const jsonData = e.dataTransfer.getData("application/json");

				if (jsonData) {
					const data = JSON.parse(jsonData);
					if (!data.items?.length) return;

					const sSub = data.src.subcategory || "";
					const dSub = dest.subcategory || "";

					if (
						data.src.slug === dest.slug &&
						data.src.category === dest.category &&
						sSub === dSub
					) {
						setLoading(false);
						return;
					}

					await api.moveImages({
						items: data.items,
						src: data.src,
						dest,
					});
					setSelectedFilenames(new Set());
					setSelectedSubs(new Set());
					loadImages();
					loadSubcategories();
					loadStorageStats();
				} else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
					await handleFileUpload(e.dataTransfer.files);
					return;
				}
			} catch (err) {
				console.error("Move failed", err);
			} finally {
				setLoading(false);
			}
		},
		[handleFileUpload, loadImages, loadSubcategories, loadStorageStats],
	);

	const getMovableSelectedItems = useCallback(() => {
		const safeSubs = Array.from(selectedSubs).filter(
			(name) => !isReadonlySub(name),
		);
		const safeFilenames = images
			.filter(
				(image) => selectedFilenames.has(image.name) && !isReadonlyImage(image),
			)
			.map((image) => image.name);
		return { safeFilenames, safeSubs, items: [...safeFilenames, ...safeSubs] };
	}, [
		selectedFilenames,
		selectedSubs,
		images,
		isReadonlyImage,
		isReadonlySub,
	]);

	const handleMoveSelection = useCallback(
		async (dest) => {
			const { items } = getMovableSelectedItems();
			if (!items.length) return false;

			const src = {
				slug: selectedSource,
				category: selectedCat.id,
				subcategory: selectedSub,
			};
			const sSub = src.subcategory || "";
			const dSub = dest.subcategory || "";
			if (
				src.slug === dest.slug &&
				src.category === dest.category &&
				sSub === dSub
			) {
				return false;
			}

			setLoading(true);
			try {
				await api.moveImages({ items, src, dest });
				setSelectedFilenames(new Set());
				setSelectedSubs(new Set());
				setLastSelectedIndex(null);
				loadImages();
				loadSubcategories();
				loadStorageStats();
				return true;
			} catch (err) {
				console.error("Move failed", err);
				dispatch(alert({ title: lang.t("Move error"), message: err.message }));
				return false;
			} finally {
				setLoading(false);
			}
		},
		[
			getMovableSelectedItems,
			selectedSource,
			selectedCat.id,
			selectedSub,
			loadImages,
			loadSubcategories,
			loadStorageStats,
			dispatch,
		],
	);

	const handleCreateSub = useCallback(async () => {
		if (isReadonlyCurrentFolder) return;
		if (!newSubName.trim()) return;
		try {
			const fullPath = selectedSub
				? `${selectedSub}/${newSubName}`
				: newSubName;
			await api.createSubcategory(selectedSource, selectedCat.id, fullPath);
			setNewSubName("");
			setIsCreatingSub(false);
			loadSubcategories();
			setSelectedSub(fullPath);
		} catch (err) {
			dispatch(alert({ title: lang.t("Error"), message: err.message }));
		}
	}, [
		newSubName,
		selectedSub,
		selectedSource,
		selectedCat.id,
		isReadonlyCurrentFolder,
		loadSubcategories,
		dispatch,
	]);

	const handleRenameSub = useCallback(
		async (oldName, newName) => {
			if (!newName.trim() || oldName === newName) {
				return;
			}
			try {
				const oldPath = selectedSub ? `${selectedSub}/${oldName}` : oldName;
				const newPath = selectedSub ? `${selectedSub}/${newName}` : newName;

				await api.renameSubcategory(
					selectedSource,
					selectedCat.id,
					oldPath,
					newPath,
				);
				loadSubcategories();
				loadImages();
				if (selectedSub === oldName) setSelectedSub(newName);
			} catch (err) {
				dispatch(
					alert({ title: lang.t("Rename error"), message: err.message }),
				);
			}
		},
		[
			selectedSub,
			selectedSource,
			selectedCat.id,
			loadSubcategories,
			loadImages,
			dispatch,
		],
	);

	const handleRenameImage = useCallback(
		async (oldName, newName) => {
			if (!newName.trim() || oldName === newName) return;
			try {
				await api.renameImage(
					selectedSource,
					selectedCat.id,
					selectedSub,
					oldName,
					newName,
				);
				loadImages();
				loadStorageStats();
			} catch (err) {
				dispatch(alert({ title: lang.t("Error"), message: err.message }));
			}
		},
		[
			selectedSource,
			selectedCat.id,
			selectedSub,
			loadImages,
			loadStorageStats,
			dispatch,
		],
	);

	const toggleSelect = useCallback(
		(name, type, e) => {
			e.stopPropagation();
			if (type === "image") {
				const image = images.find((item) => item.name === name);
				if (isReadonlyImage(image)) return;
				const next = new Set(selectedFilenames);
				if (next.has(name)) next.delete(name);
				else next.add(name);
				setSelectedFilenames(next);
			} else {
				if (isReadonlySub(name)) return;
				const next = new Set(selectedSubs);
				if (next.has(name)) next.delete(name);
				else next.add(name);
				setSelectedSubs(next);
			}
		},
		[selectedFilenames, selectedSubs, images, isReadonlyImage, isReadonlySub],
	);

	const handleBulkDelete = useCallback(async () => {
		const { safeFilenames, safeSubs, items } = getMovableSelectedItems();
		const total = safeFilenames.length + safeSubs.length;
		if (!total) return;

		setLoading(true);
		try {
			let hasNonEmptySelectedFolders = false;
			if (safeSubs.length > 0) {
				const checks = await Promise.all(
					safeSubs.map(async (folderName) => {
						const folderPath = selectedSub
							? `${selectedSub}/${folderName}`
							: folderName;
						const [folderImages, nestedFolders] = await Promise.all([
							api.getImages(selectedSource, selectedCat.id, folderPath),
							api.getSubcategories(selectedSource, selectedCat.id, folderPath),
						]);
						return (
							(Array.isArray(folderImages) ? folderImages.length : 0) > 0 ||
							(Array.isArray(nestedFolders) ? nestedFolders.length : 0) > 0
						);
					}),
				);
				hasNonEmptySelectedFolders = checks.some(Boolean);
			}

			const confirmed = await dispatch(
				confirm({
					title: lang.t("Delete"),
					message: lang.t("Delete selected items ({count})?", { count: total }),
					checkboxLabel: hasNonEmptySelectedFolders
						? lang.t("Extract contents from folder?")
						: null,
					checkboxDefaultChecked: false,
					getConfirmValue: (_value, extractFolderContents) => ({
						confirmed: true,
						extractFolderContents: Boolean(extractFolderContents),
					}),
				}),
			);

			if (!confirmed?.confirmed) return;

			await api.deleteImages({
				items,
				src: {
					slug: selectedSource,
					category: selectedCat.id,
					subcategory: selectedSub,
				},
				options: {
					extractFolderContents:
						hasNonEmptySelectedFolders &&
						Boolean(confirmed.extractFolderContents),
				},
			});
			setSelectedFilenames(new Set());
			setSelectedSubs(new Set());
			loadImages();
			loadSubcategories();
			loadStorageStats();
		} catch (err) {
			dispatch(alert({ title: lang.t("Delete error"), message: err.message }));
		} finally {
			setLoading(false);
		}
	}, [
		getMovableSelectedItems,
		selectedSource,
		selectedCat.id,
		selectedSub,
		loadImages,
		loadSubcategories,
		loadStorageStats,
		dispatch,
	]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!isOpen) return;
			if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
				return;

			if (e.key === "Delete") {
				handleBulkDelete();
			} else if (e.key === "Backspace") {
				e.preventDefault();
				if (selectedSub) {
					const parts = selectedSub.split("/").filter(Boolean);
					parts.pop();
					setSelectedSub(parts.join("/"));
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedSub, isOpen, handleBulkDelete]);

	const allSubs = useMemo(
		() =>
			normalizedSearchQuery
				? []
				: Array.from(
						new Set([
							...(selectedSub === "" ? selectedCat.subs || [] : []),
							...dynamicSubs,
						]),
					),
		[normalizedSearchQuery, selectedSub, selectedCat.subs, dynamicSubs],
	);

	const handleItemClick = useCallback(
		(name, type, index, e) => {
			e.stopPropagation();

			if (e.shiftKey && lastSelectedIndex !== null) {
				const start = Math.min(index, lastSelectedIndex);
				const end = Math.max(index, lastSelectedIndex);
				const isAdditive = e.ctrlKey || e.metaKey;
				const nextFilenames = new Set(isAdditive ? selectedFilenames : []);
				const nextSubs = new Set(isAdditive ? selectedSubs : []);

				const combinedItems = [
					...allSubs.map((s) => ({ name: s, type: "sub" })),
					...images.map((i) => ({ name: i.name, type: "image" })),
				];

				for (let i = start; i <= end; i++) {
					const item = combinedItems[i];
					if (item.type === "sub") {
						if (!isReadonlySub(item.name)) nextSubs.add(item.name);
					} else {
						const image = images.find(
							(imageItem) => imageItem.name === item.name,
						);
						if (!isReadonlyImage(image)) nextFilenames.add(item.name);
					}
				}

				setSelectedFilenames(nextFilenames);
				setSelectedSubs(nextSubs);
			} else if (e.ctrlKey || e.metaKey) {
				toggleSelect(name, type, e);
				setLastSelectedIndex(index);
			} else {
				if (type === "sub" && isReadonlySub(name)) return;
				if (
					type === "image" &&
					isReadonlyImage(images.find((image) => image.name === name))
				) {
					return;
				}
				const isSelected =
					type === "image"
						? selectedFilenames.has(name)
						: selectedSubs.has(name);
				const totalSelected = selectedFilenames.size + selectedSubs.size;

				if (isSelected && totalSelected === 1) {
					setSelectedFilenames(new Set());
					setSelectedSubs(new Set());
					setLastSelectedIndex(null);
				} else {
					setSelectedFilenames(type === "image" ? new Set([name]) : new Set());
					setSelectedSubs(type === "sub" ? new Set([name]) : new Set());
					setLastSelectedIndex(index);
				}
			}
		},
		[
			allSubs,
			images,
			lastSelectedIndex,
			selectedFilenames,
			selectedSubs,
			toggleSelect,
			isReadonlyImage,
			isReadonlySub,
		],
	);

	const handleDragStart = useCallback(
		(e, item, type = "image") => {
			const itemName = type === "image" ? item.name : item;
			if (type === "sub" && isReadonlySub(itemName)) {
				e.preventDefault();
				return;
			}
			if (type === "image" && isReadonlyImage(item)) {
				e.preventDefault();
				return;
			}
			const isSelected =
				type === "image"
					? selectedFilenames.has(itemName)
					: selectedSubs.has(itemName);

			const itemsToMove = isSelected
				? getMovableSelectedItems().items
				: [itemName];
			if (!itemsToMove.length) {
				e.preventDefault();
				return;
			}

			e.dataTransfer.setData(
				"application/json",
				JSON.stringify({
					items: itemsToMove,
					src: {
						slug: selectedSource,
						category: selectedCat.id,
						subcategory: selectedSub,
					},
				}),
			);
			e.dataTransfer.effectAllowed = "move";
			setDragSource({
				slug: selectedSource,
				category: selectedCat.id,
				subcategory: selectedSub,
			});
		},
		[
			selectedFilenames,
			selectedSubs,
			getMovableSelectedItems,
			isReadonlyImage,
			isReadonlySub,
			selectedSource,
			selectedCat.id,
			selectedSub,
		],
	);

	const handleDragEnd = useCallback(() => {
		setDragSource(null);
		setDragOverTarget(null);
	}, []);

	return {
		campaigns,
		categories: IMAGE_GALLERY_CATEGORIES,
		selectedSource,
		setSelectedSource,
		selectedCat,
		setSelectedCat,
		selectedSub,
		setSelectedSub,
		images,
		searchQuery,
		setSearchQuery,
		searchMode,
		setSearchMode,
		isGlobalSearch,
		isSearchResults,
		isReadonlyCurrentFolder,
		isReadonlyPath,
		storageStats,
		selectedFilenames,
		selectedSubs,
		loading,
		isCreatingSub,
		setIsCreatingSub,
		newSubName,
		setNewSubName,
		isDraggingOver,
		setIsDraggingOver,
		dragSource,
		dragOverTarget,
		setDragOverTarget,
		hasSelection,
		clearSelection,
		selectImageByName,
		allSubs,
		handleCreateSub,
		handleBulkDelete,
		handleMoveSelection,
		handleFileUpload,
		handleDrop,
		handleItemClick,
		toggleSelect,
		handleRenameSub,
		handleDragStart,
		handleDragEnd,
		getCleanName,
		handleRenameImage,
		isProtectedSystemSub,
		isReadonlySub,
		isReadonlyImage,
	};
}
