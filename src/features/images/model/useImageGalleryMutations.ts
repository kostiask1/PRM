import {
	type Dispatch,
	type DragEvent,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";

import { lang } from "../../../shared/lib/index.js";
import {
	alert,
	confirm,
	useAppDispatch,
} from "../../../shared/model/index.js";
import {
	imageApi,
	type ImageLocation,
} from "../api/imageApi.ts";
import type {
	GalleryDragOverTarget,
	GalleryDropTarget,
	GalleryImage,
	GalleryItemType,
	GalleryMoveGroup,
	ImageGalleryCategory,
	ImageGalleryContentScope,
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
	getGallerySubcategoryRenamePlan,
	normalizeGalleryBulkDeleteConfirmation,
	type GalleryKeyboardPlan,
} from "./imageGalleryInteraction.ts";
import { hasNonEmptyGalleryFolders } from "./imageGalleryLoading.ts";

const api = imageApi;

interface GalleryMovableSelection {
	imageGroups: GalleryMoveGroup[];
	items: string[];
	safeFilenames: string[];
	safeSubs: string[];
}

interface ImageGalleryMutationOptions {
	clearSelection: () => void;
	contentScope: ImageGalleryContentScope;
	getMovableSelectedItems: () => GalleryMovableSelection;
	isOpen: boolean;
	isReadonlyCurrentFolder: boolean;
	isReadonlyImage: (image?: GalleryImage) => boolean;
	isReadonlySub: (name: string) => boolean;
	loadImages: () => Promise<void>;
	loadStorageStats: () => Promise<void>;
	loadSubcategories: () => Promise<void>;
	selectedCat: ImageGalleryCategory;
	selectedFilenames: Set<string>;
	selectedSource: string;
	selectedSub: string;
	selectedSubs: Set<string>;
	setLoading: Dispatch<SetStateAction<boolean>>;
	setSelectedFilenames: Dispatch<SetStateAction<Set<string>>>;
	setSelectedSub: Dispatch<SetStateAction<string>>;
	setSelectedSubs: Dispatch<SetStateAction<Set<string>>>;
}

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

export function useImageGalleryMutations({
	clearSelection,
	contentScope,
	getMovableSelectedItems,
	isOpen,
	isReadonlyCurrentFolder,
	isReadonlyImage,
	isReadonlySub,
	loadImages,
	loadStorageStats,
	loadSubcategories,
	selectedCat,
	selectedFilenames,
	selectedSource,
	selectedSub,
	selectedSubs,
	setLoading,
	setSelectedFilenames,
	setSelectedSub,
	setSelectedSubs,
}: ImageGalleryMutationOptions) {
	const dispatch = useAppDispatch();
	const [isCreatingSub, setIsCreatingSub] = useState(false);
	const [newSubName, setNewSubName] = useState("");
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [dragSource, setDragSource] = useState<ImageLocation | null>(null);
	const [dragOverTarget, setDragOverTarget] =
		useState<GalleryDragOverTarget | null>(null);

	const getCleanName = useCallback((name: string) => {
		return name.replace(/\.[^/.]+$/, "").replace(/-\d{10,}$/, "");
	}, []);

	useEffect(() => {
		if (isOpen) {
			void loadImages();
			void loadSubcategories();
			void loadStorageStats();
		}
		clearSelection();
	}, [
		clearSelection,
		contentScope,
		isOpen,
		loadImages,
		loadStorageStats,
		loadSubcategories,
		selectedCat,
		selectedSource,
		selectedSub,
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
				void loadImages();
				void loadStorageStats();
			} catch (error) {
				console.error("Upload failed:", error);
			} finally {
				setLoading(false);
			}
		},
		[
			isReadonlyCurrentFolder,
			loadImages,
			loadStorageStats,
			selectedCat.id,
			selectedSource,
			selectedSub,
			setLoading,
		],
	);

	const handleDrop = useCallback(
		async (event: DragEvent, dest: GalleryDropTarget) => {
			event.preventDefault();
			event.stopPropagation();
			setIsDraggingOver(false);
			setDragOverTarget(null);
			setDragSource(null);
			const plan = getGalleryDropPlan({
				dest,
				hasFiles: event.dataTransfer.files.length > 0,
				jsonData: event.dataTransfer.getData("application/json"),
			});
			if (plan.kind === "ignore") return;
			if (plan.kind === "upload") {
				await handleFileUpload(event.dataTransfer.files);
				return;
			}
			setLoading(true);
			try {
				await api.moveImages(plan.payload);
				setSelectedFilenames(new Set());
				setSelectedSubs(new Set());
				void loadImages();
				void loadSubcategories();
				void loadStorageStats();
			} catch (error) {
				console.error("Move failed", error);
			} finally {
				setLoading(false);
			}
		},
		[
			handleFileUpload,
			loadImages,
			loadStorageStats,
			loadSubcategories,
			setLoading,
			setSelectedFilenames,
			setSelectedSubs,
		],
	);

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
				clearSelection();
				void loadImages();
				void loadSubcategories();
				void loadStorageStats();
				return true;
			} catch (error) {
				console.error("Move failed", error);
				dispatch(
					alert({ title: lang.t("Move error"), message: getErrorMessage(error) }),
				);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[
			clearSelection,
			dispatch,
			getMovableSelectedItems,
			loadImages,
			loadStorageStats,
			loadSubcategories,
			selectedCat.id,
			selectedSource,
			selectedSub,
			setLoading,
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
			void loadSubcategories();
			setSelectedSub(fullPath);
		} catch (error) {
			dispatch(alert({ title: lang.t("Error"), message: getErrorMessage(error) }));
		}
	}, [
		dispatch,
		isReadonlyCurrentFolder,
		loadSubcategories,
		newSubName,
		selectedCat.id,
		selectedSource,
		selectedSub,
		setSelectedSub,
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
				void loadSubcategories();
				void loadImages();
				if (plan.selectedSubcategory !== null) {
					setSelectedSub(plan.selectedSubcategory);
				}
			} catch (error) {
				dispatch(
					alert({
						title: lang.t("Rename error"),
						message: getErrorMessage(error),
					}),
				);
			}
		},
		[
			dispatch,
			loadImages,
			loadSubcategories,
			selectedCat.id,
			selectedSource,
			selectedSub,
			setSelectedSub,
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
				void loadImages();
				void loadStorageStats();
			} catch (error) {
				dispatch(alert({ title: lang.t("Error"), message: getErrorMessage(error) }));
			}
		},
		[
			dispatch,
			loadImages,
			loadStorageStats,
			selectedCat.id,
			selectedSource,
			selectedSub,
		],
	);

	const handleBulkDelete = useCallback(async () => {
		const { safeFilenames, safeSubs, imageGroups } = getMovableSelectedItems();
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
			await Promise.all(
				deletePayloads.map((payload) => api.deleteImages(payload)),
			);
			setSelectedFilenames(new Set());
			setSelectedSubs(new Set());
			void loadImages();
			void loadSubcategories();
			void loadStorageStats();
		} catch (error) {
			dispatch(
				alert({ title: lang.t("Delete error"), message: getErrorMessage(error) }),
			);
		} finally {
			setLoading(false);
		}
	}, [
		dispatch,
		getMovableSelectedItems,
		loadImages,
		loadStorageStats,
		loadSubcategories,
		selectedCat.id,
		selectedSource,
		selectedSub,
		setLoading,
		setSelectedFilenames,
		setSelectedSubs,
	]);

	useEffect(() => {
		const handleKeyDown = (event: globalThis.KeyboardEvent) => {
			const plan = getGalleryKeyboardPlan({
				isOpen,
				key: event.key,
				selectedSub,
				targetTagName: getGalleryKeyboardTargetTagName(event.target),
			});
			executeGalleryKeyboardPlan(
				plan,
				event,
				handleBulkDelete,
				setSelectedSub,
			);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleBulkDelete, isOpen, selectedSub, setSelectedSub]);

	const handleDragStart = useCallback(
		(
			event: DragEvent,
			item: GalleryImage | string,
			type: GalleryItemType = "image",
		) => {
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
				event.preventDefault();
				return;
			}
			event.dataTransfer.setData("application/json", JSON.stringify(plan));
			event.dataTransfer.effectAllowed = "move";
			setDragSource(plan.src);
		},
		[
			getMovableSelectedItems,
			isReadonlyImage,
			isReadonlySub,
			selectedCat.id,
			selectedFilenames,
			selectedSource,
			selectedSub,
			selectedSubs,
		],
	);

	const handleDragEnd = useCallback(() => {
		setDragSource(null);
		setDragOverTarget(null);
	}, []);

	return {
		dragOverTarget,
		dragSource,
		getCleanName,
		handleBulkDelete,
		handleCreateSub,
		handleDragEnd,
		handleDragStart,
		handleDrop,
		handleFileUpload,
		handleMoveSelection,
		handleRenameImage,
		handleRenameSub,
		isCreatingSub,
		isDraggingOver,
		newSubName,
		setDragOverTarget,
		setIsCreatingSub,
		setIsDraggingOver,
		setNewSubName,
	};
}
