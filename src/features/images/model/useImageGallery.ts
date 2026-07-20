import {
	type DragEvent,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

import { alert, confirm } from "../../../shared/model/index.js";
import {
	campaignApi,
	type CampaignRecord,
} from "../../../entities/campaign/index.js";
import {
	imageApi,
	type ImageGalleryStats,
	type ImageLocation,
} from "../api/imageApi.ts";

const api = { ...campaignApi, ...imageApi };
import { useAppDispatch, useAppSelector } from "../../../shared/model/index.js";
import { lang } from "../../../shared/lib/index.js";
import { IMAGE_GALLERY_CATEGORIES } from "../imageGalleryConfig.js";
import { useDebounce } from "../../../shared/lib/index.js";
import {
	getCampaignIgnoreSourcesList,
	type CampaignSourceSettings,
} from "../../../entities/reference/index.js";
import type {
	GalleryDropTarget,
	GalleryDragOverTarget,
	GalleryImage,
	GalleryItemType,
	GalleryMoveGroup,
	GallerySubcategoryDetailsMap,
	ImageGalleryCategory,
	ImageGalleryContentScope,
	UseImageGalleryOptions,
} from "./contracts.ts";
import {
	buildGalleryBulkDeletePayloads,
	buildGalleryMovePayloads,
	createGalleryBulkDeleteConfirmation,
	getGalleryBulkDeleteConfirmationPlan,
	getGalleryBulkDeleteSummary,
	getGalleryDragPlan,
	getGalleryDropPlan,
	getGalleryKeyboardPlan,
	getGallerySelectionPlan,
	getGallerySubcategoryRenamePlan,
	normalizeGalleryBulkDeleteConfirmation,
	type GalleryKeyboardPlan,
} from "./imageGalleryInteraction.ts";
import {
	hasNonEmptyGalleryFolders,
	loadGalleryImages,
	loadGallerySubcategoryData,
} from "./imageGalleryLoading.ts";

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function getGalleryKeyboardTargetTagName(
	target: EventTarget | null,
): string | null {
	return target instanceof HTMLElement ? target.tagName : null;
}

function executeGalleryKeyboardPlan(
	plan: GalleryKeyboardPlan,
	event: Pick<globalThis.KeyboardEvent, "preventDefault">,
	deleteSelection: () => void,
	setSelectedSub: (subcategory: string) => void,
): void {
	if (plan.preventDefault) event.preventDefault();
	switch (plan.action) {
		case "delete-selection":
			deleteSelection();
			break;
		case "navigate-parent":
			setSelectedSub(plan.subcategory);
			break;
	}
}

export default function useImageGallery({
	isOpen,
	initialSource,
	initialCategory,
	initialSubcategory,
}: UseImageGalleryOptions) {
	const dispatch = useAppDispatch();
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const globalIgnoreSourcesList = useAppSelector(
		(state) => state.ui.ignoreSourcesList || [],
	);
	const ignoreSourcesList = useMemo(
		() =>
			getCampaignIgnoreSourcesList(
				activeCampaign as CampaignSourceSettings | null,
				globalIgnoreSourcesList,
			),
		[activeCampaign, globalIgnoreSourcesList],
	);

	const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
	const [selectedSource, setSelectedSource] = useState("general");
	const [selectedCat, setSelectedCat] = useState<ImageGalleryCategory>(
		IMAGE_GALLERY_CATEGORIES[0],
	);
	const [selectedSub, setSelectedSub] = useState("");
	const [dynamicSubs, setDynamicSubs] = useState<string[]>([]);
	const [subDetails, setSubDetails] = useState<GallerySubcategoryDetailsMap>({});
	const [officialSubs, setOfficialSubs] = useState<Set<string>>(new Set());
	const [officialRootSubs, setOfficialRootSubs] = useState<Set<string>>(new Set());
	const [images, setImages] = useState<GalleryImage[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [contentScope, setContentScope] =
		useState<ImageGalleryContentScope>("local");
	const [storageStats, setStorageStats] = useState<ImageGalleryStats | null>(null);
	const [selectedFilenames, setSelectedFilenames] = useState<Set<string>>(new Set());
	const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
	const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [isCreatingSub, setIsCreatingSub] = useState(false);
	const [newSubName, setNewSubName] = useState("");
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [dragSource, setDragSource] = useState<ImageLocation | null>(null);
	const [dragOverTarget, setDragOverTarget] =
		useState<GalleryDragOverTarget | null>(null);
	const debouncedSearchQuery = useDebounce(
		searchQuery,
		useSearchDebounce ? 250 : 0,
	);
	const normalizedSearchQuery = searchQuery.trim()
		? debouncedSearchQuery.trim().toLowerCase()
		: "";
	const activeSearchQuery = normalizedSearchQuery ? debouncedSearchQuery : "";
	const isScopedContent = contentScope !== "local";
	const isGlobalSearch = contentScope === "all";
	const isSearchResults = Boolean(normalizedSearchQuery || isScopedContent);
	const isGeneralTokens =
		selectedSource === "general" && selectedCat.id === "tokens";
	const selectedSubRoot = selectedSub.split("/").filter(Boolean)[0] || "";

	const clearSelection = useCallback(() => {
		setSelectedFilenames(new Set());
		setSelectedSubs(new Set());
		setLastSelectedIndex(null);
	}, []);
	const isProtectedSystemSub = useCallback(
		(name: string) =>
			selectedSub === "" &&
			(selectedCat.id === "tokens" || selectedCat.id === "characters") &&
			(name === "players" || name === "npc"),
		[selectedCat.id, selectedSub],
	);
	const isReadonlySub = useCallback(
		(name: string) => isProtectedSystemSub(name) || officialSubs.has(name),
		[isProtectedSystemSub, officialSubs],
	);
	const isOfficialSub = useCallback((name: string) => officialSubs.has(name), [officialSubs]);
	const isReadonlyImage = useCallback((image?: GalleryImage) => Boolean(image?.readonly), []);
	const isReadonlyPath = useCallback(
		(subcategory = "") => {
			const root = String(subcategory || "")
				.split("/")
				.filter(Boolean)[0];
			return Boolean(isGeneralTokens && root && officialRootSubs.has(root));
		},
		[isGeneralTokens, officialRootSubs],
	);
	const isReadonlyCurrentFolder = Boolean(
		isGeneralTokens && selectedSubRoot && isReadonlyPath(selectedSub),
	);
	const selectImageByName = useCallback(
		(name: string) => {
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

	const getCleanName = useCallback((name: string) => {
		return name.replace(/\.[^/.]+$/, "").replace(/-\d{10,}$/, "");
	}, []);

	const resetSubcategories = useCallback(() => {
		setDynamicSubs([]);
		setSubDetails({});
		setOfficialSubs(new Set());
		setOfficialRootSubs(new Set());
	}, []);

	const loadSubcategories = useCallback(async () => {
		if (Boolean(normalizedSearchQuery || isScopedContent)) {
			resetSubcategories();
			return;
		}
		try {
			const result = await loadGallerySubcategoryData({
				activeSearchQuery,
				api,
				category: selectedCat.id,
				ignoreSourcesList,
				isGeneralTokens,
				selectedSub,
				selectedSource,
			});
			setOfficialSubs(result.officialSubs);
			setOfficialRootSubs(result.officialRootSubs);
			setSubDetails(result.subDetails);
			setDynamicSubs(result.dynamicSubs);
		} catch (err) {
			console.error(err);
			resetSubcategories();
		}
	}, [
		selectedSource,
		selectedCat.id,
		selectedSub,
		isGeneralTokens,
		activeSearchQuery,
		ignoreSourcesList,
		isScopedContent,
		normalizedSearchQuery,
		resetSubcategories,
	]);

	const loadImages = useCallback(async () => {
		setLoading(true);
		try {
			setImages(
				await loadGalleryImages({
					activeSearchQuery,
					api,
					categories: IMAGE_GALLERY_CATEGORIES.map(
						(category) => category.id,
					),
					category: selectedCat.id,
					contentScope,
					ignoreSourcesList,
					isGeneralTokens,
					isScopedContent,
					normalizedSearchQuery,
					search: debouncedSearchQuery,
					selectedSub,
					selectedSource,
				}),
			);
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
		contentScope,
		isScopedContent,
		activeSearchQuery,
		debouncedSearchQuery,
		ignoreSourcesList,
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
			void api.listCampaigns().then((items) => setCampaigns(items || []));

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
		contentScope,
		loadImages,
		loadSubcategories,
		loadStorageStats,
	]);

	const handleFileUpload = useCallback(
		async (files: FileList | File[]) => {
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
		async (e: DragEvent, dest: GalleryDropTarget) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDraggingOver(false);
			setDragOverTarget(null);
			setDragSource(null);
			const plan = getGalleryDropPlan({
				dest,
				hasFiles: e.dataTransfer.files.length > 0,
				jsonData: e.dataTransfer.getData("application/json"),
			});
			if (plan.kind === "ignore") return;
			if (plan.kind === "upload") {
				await handleFileUpload(e.dataTransfer.files);
				return;
			}
			setLoading(true);
			try {
				await api.moveImages(plan.payload);
				setSelectedFilenames(new Set());
				setSelectedSubs(new Set());
				loadImages();
				loadSubcategories();
				loadStorageStats();
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
		const selectedImages = images.filter(
			(image) => selectedFilenames.has(image.name) && !isReadonlyImage(image),
		);
		const imageGroupsMap = new Map<string, GalleryMoveGroup>();
		for (const image of selectedImages) {
			const src = {
				slug: image.source || selectedSource,
				category: image.category || selectedCat.id,
				subcategory: image.subcategory || selectedSub,
			};
			const key = [src.slug, src.category, src.subcategory].join("\u0000");
			const group = imageGroupsMap.get(key) || { src, items: [] };
			group.items.push(image.name);
			imageGroupsMap.set(key, group);
		}
		const imageGroups = Array.from(imageGroupsMap.values());
		const safeFilenames = selectedImages.map((image) => image.name);
		return {
			safeFilenames,
			safeSubs,
			imageGroups,
			items: [...safeFilenames, ...safeSubs],
		};
	}, [
		selectedFilenames,
		selectedSubs,
		images,
		isReadonlyImage,
		isReadonlySub,
		selectedSource,
		selectedCat.id,
		selectedSub,
	]);

	const handleMoveSelection = useCallback(
		async (dest: ImageLocation) => {
			const { items, imageGroups, safeSubs } = getMovableSelectedItems();
			if (!items.length) return false;
			const src = {
				slug: selectedSource,
				category: selectedCat.id,
				subcategory: selectedSub,
			};
			const movePayloads = buildGalleryMovePayloads({
				dest,
				imageGroups,
				safeSubs,
				src,
			});
			if (movePayloads.length === 0) return false;
			setLoading(true);
			try {
				await Promise.all(movePayloads.map((payload) => api.moveImages(payload)));
				setSelectedFilenames(new Set());
				setSelectedSubs(new Set());
				setLastSelectedIndex(null);
				loadImages();
				loadSubcategories();
				loadStorageStats();
				return true;
			} catch (err) {
				console.error("Move failed", err);
				dispatch(alert({ title: lang.t("Move error"), message: getErrorMessage(err) }));
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
			dispatch(alert({ title: lang.t("Error"), message: getErrorMessage(err) }));
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
		async (oldName: string, newName: string) => {
			const plan = getGallerySubcategoryRenamePlan({
				newName,
				oldName,
				selectedSub,
			});
			if (!plan) return;
			try {
				await api.renameSubcategory(
					selectedSource,
					selectedCat.id,
					plan.oldPath,
					plan.newPath,
				);
				loadSubcategories();
				loadImages();
				if (plan.selectedSubcategory !== null) {
					setSelectedSub(plan.selectedSubcategory);
				}
			} catch (err) {
				dispatch(
					alert({ title: lang.t("Rename error"), message: getErrorMessage(err) }),
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
		async (oldName: string, newName: string) => {
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
				dispatch(alert({ title: lang.t("Error"), message: getErrorMessage(err) }));
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
		(name: string, type: GalleryItemType, e: ReactMouseEvent) => {
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
		const { safeFilenames, safeSubs, imageGroups } =
			getMovableSelectedItems();
		const summary = getGalleryBulkDeleteSummary({ safeFilenames, safeSubs });
		if (!summary) return;

		setLoading(true);
		try {
			const hasNonEmptySelectedFolders = summary.hasFolders
				? await hasNonEmptyGalleryFolders({
						api,
						category: selectedCat.id,
						folderNames: safeSubs,
						selectedSource,
						selectedSub,
					})
				: false;
			const confirmationPlan = getGalleryBulkDeleteConfirmationPlan({
				hasNonEmptySelectedFolders,
				total: summary.total,
			});

			const confirmed = normalizeGalleryBulkDeleteConfirmation(
				await dispatch(
				confirm({
					title: lang.t("Delete"),
					message: lang.t("Delete selected items ({count})?", {
						count: confirmationPlan.count,
					}),
					checkboxLabel: confirmationPlan.showExtractFolderContents
						? lang.t("Extract contents from folder?")
						: null,
					checkboxDefaultChecked: false,
					getConfirmValue: (
						_value: unknown,
						extractFolderContents: boolean,
					) => createGalleryBulkDeleteConfirmation(extractFolderContents),
				}),
				),
			);

			if (!confirmed) return;

			const deletePayloads = buildGalleryBulkDeletePayloads({
				extractFolderContents: confirmed.extractFolderContents,
				hasNonEmptySelectedFolders,
				imageGroups,
				safeSubs,
				src: {
					slug: selectedSource,
					category: selectedCat.id,
					subcategory: selectedSub,
				},
			});
			await Promise.all(deletePayloads.map((payload) => api.deleteImages(payload)));
			setSelectedFilenames(new Set());
			setSelectedSubs(new Set());
			loadImages();
			loadSubcategories();
			loadStorageStats();
		} catch (err) {
			dispatch(alert({ title: lang.t("Delete error"), message: getErrorMessage(err) }));
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
		const handleKeyDown = (e: globalThis.KeyboardEvent) => {
			const plan = getGalleryKeyboardPlan({
				isOpen,
				key: e.key,
				selectedSub,
				targetTagName: getGalleryKeyboardTargetTagName(e.target),
			});
			executeGalleryKeyboardPlan(
				plan,
				e,
				handleBulkDelete,
				setSelectedSub,
			);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedSub, isOpen, handleBulkDelete]);

	const allSubs = useMemo(
		() =>
			normalizedSearchQuery || isScopedContent
				? []
				: Array.from(
						new Set([
							...(selectedSub === "" ? selectedCat.subs || [] : []),
							...dynamicSubs,
						]),
					),
		[
			normalizedSearchQuery,
			isScopedContent,
			selectedSub,
			selectedCat.subs,
			dynamicSubs,
		],
	);

	const handleItemClick = useCallback(
		(name: string, type: GalleryItemType, index: number, e: ReactMouseEvent) => {
			e.stopPropagation();
			const plan = getGallerySelectionPlan({
				allSubs,
				filenames: selectedFilenames,
				images,
				index,
				isAdditive: e.ctrlKey || e.metaKey,
				isReadonlyImage,
				isReadonlySub,
				isShift: e.shiftKey,
				lastIndex: lastSelectedIndex,
				name,
				subfolders: selectedSubs,
				type,
			});
			if (!plan) return;
			setSelectedFilenames(plan.filenames);
			setSelectedSubs(plan.subfolders);
			setLastSelectedIndex(plan.lastIndex);
		},
		[
			allSubs,
			images,
			lastSelectedIndex,
			selectedFilenames,
			selectedSubs,
			isReadonlyImage,
			isReadonlySub,
		],
	);

	const handleDragStart = useCallback(
		(e: DragEvent, item: GalleryImage | string, type: GalleryItemType = "image") => {
			const location = {
				slug: selectedSource,
				category: selectedCat.id,
				subcategory: selectedSub,
			};
			const plan = getGalleryDragPlan({
				item,
				location,
				getMovableSelection: () => getMovableSelectedItems().items,
				selectedFilenames,
				selectedSubs,
				type,
				isReadonlyImage,
				isReadonlySub,
			});
			if (!plan) {
				e.preventDefault();
				return;
			}
			e.dataTransfer.setData(
				"application/json",
				JSON.stringify(plan),
			);
			e.dataTransfer.effectAllowed = "move";
			setDragSource(plan.src);
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
		contentScope,
		setContentScope,
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
		subDetails,
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
		isOfficialSub,
		isReadonlySub,
		isReadonlyImage,
	};
}
