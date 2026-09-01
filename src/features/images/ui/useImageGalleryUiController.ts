import React from "react";
import type ReactList from "react-list";

import { lang } from "../../../shared/lib/index.js";
import type { ImageLocation } from "../api/imageApi.ts";
import type { GalleryImage } from "../model/contracts.ts";
import {
	getGalleryEscapePlan,
	type GalleryEscapePlan,
} from "../model/imageGalleryInteraction.ts";
import {
	buildGalleryPresentationItems,
	deduplicateGalleryImages,
	findPendingGalleryImage,
	getGlobalGalleryResultNavigationPlan,
	getGalleryColumnCount,
	getGalleryHistoryKeyboardPlan,
	getGalleryNavigationEntry,
	getGalleryPathEntry,
	getGalleryPathKey,
	recordGalleryNavigation,
	type GalleryHistoryDirection,
	type GalleryNavigationState,
	type GalleryPathEntry,
	type GalleryPendingSelection,
} from "../model/imageGalleryPresentation.ts";
import useImageGallery from "../model/useImageGallery.ts";

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest("input, textarea, select, [contenteditable='true']"),
	);
}

function executeGalleryHistoryKeyboardPlan(
	plan: ReturnType<typeof getGalleryHistoryKeyboardPlan>,
	event: Pick<globalThis.KeyboardEvent, "preventDefault">,
	navigateHistory: (direction: GalleryHistoryDirection) => void,
): void {
	if (plan.action === "none") return;
	event.preventDefault();
	navigateHistory(plan.direction);
}

function executeGalleryEscapePlan(
	plan: GalleryEscapePlan,
	event: Pick<globalThis.KeyboardEvent, "preventDefault" | "stopPropagation">,
	clearSelection: () => void,
	closePreview: () => void,
): void {
	if (plan.action === "none") return;
	event.preventDefault();
	event.stopPropagation();
	if (plan.action === "close-preview") closePreview();
	else clearSelection();
}

function getImageScrollId(name: string): string {
	return encodeURIComponent(name || "");
}

function scrollGalleryImageIntoView(
	viewportRef: React.RefObject<HTMLDivElement>,
	imageName: string,
): void {
	const imageScrollId = getImageScrollId(imageName);
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			const viewport = viewportRef.current;
			const target = viewport?.querySelector<HTMLElement>(
				`[data-gallery-image-id="${imageScrollId}"]`,
			);
			target?.scrollIntoView({ block: "center", inline: "nearest" });
		});
	});
}

function scrollGalleryToTop(
	listRef: React.RefObject<ReactList>,
	viewportRef: React.RefObject<HTMLDivElement>,
): void {
	requestAnimationFrame(() => {
		listRef.current?.scrollTo(0);
		if (viewportRef.current) viewportRef.current.scrollTop = 0;
	});
}

function resolvePendingGallerySelection({
	allSubsLength,
	currentPathKey,
	galleryColumns,
	images,
	listRef,
	pendingSelection,
	selectImageByName,
	setHighlightedImageName,
	setPendingSelection,
	viewportRef,
}: {
	allSubsLength: number;
	currentPathKey: string;
	galleryColumns: number;
	images: GalleryImage[];
	listRef: React.RefObject<ReactList>;
	pendingSelection: GalleryPendingSelection | null;
	selectImageByName: (name: string) => boolean;
	setHighlightedImageName: React.Dispatch<React.SetStateAction<string>>;
	setPendingSelection: React.Dispatch<
		React.SetStateAction<GalleryPendingSelection | null>
	>;
	viewportRef: React.RefObject<HTMLDivElement>;
}): void {
	const targetImage = findPendingGalleryImage({
		pendingSelection,
		currentPathKey,
		images,
	});
	if (!targetImage || !selectImageByName(targetImage.name)) return;
	const imageIndex = images.findIndex(
		(image) => image.name === targetImage.name && !image.globalSearch,
	);
	const rowIndex = Math.floor((allSubsLength + imageIndex) / galleryColumns);
	setHighlightedImageName("");
	requestAnimationFrame(() => {
		listRef.current?.scrollTo(rowIndex);
		scrollGalleryImageIntoView(viewportRef, targetImage.name);
		setHighlightedImageName(targetImage.name);
	});
	setPendingSelection(null);
}

export function useImageGalleryUiController({
	initialCategory,
	initialSource,
	initialSubcategory,
	isOpen,
	isSelectionMode,
}: {
	initialCategory?: string;
	initialSource?: string;
	initialSubcategory?: string;
	isOpen: boolean;
	isSelectionMode: boolean;
}) {
	const galleryViewportRef = React.useRef<HTMLDivElement>(null);
	const galleryListRef = React.useRef<ReactList>(null);
	const isApplyingHistoryRef = React.useRef(false);
	const pendingSelectionRef = React.useRef<GalleryPendingSelection | null>(null);
	const [isMoveModalOpen, setIsMoveModalOpen] = React.useState(false);
	const [previewImage, setPreviewImage] = React.useState<GalleryImage | null>(null);
	const [galleryColumns, setGalleryColumns] = React.useState(1);
	const [pendingSelection, setPendingSelection] =
		React.useState<GalleryPendingSelection | null>(null);
	const [highlightedImageName, setHighlightedImageName] = React.useState("");
	const [navigationHistory, setNavigationHistory] =
		React.useState<GalleryNavigationState>({ entries: [], index: -1 });
	const [moveTarget, setMoveTarget] = React.useState<ImageLocation>({
		slug: "general",
		category: "attachments",
		subcategory: "",
	});
	const galleryController = useImageGallery({
		isOpen,
		initialSource,
		initialCategory,
		initialSubcategory,
	});
	const {
		allSubs,
		campaigns,
		categories,
		clearSelection,
		hasSelection,
		images,
		selectedCat,
		selectedSource,
		selectedSub,
		selectImageByName,
		setContentScope,
		setSearchQuery,
		setSelectedCat,
		setSelectedSource,
		setSelectedSub,
		storageStats,
	} = galleryController;

	pendingSelectionRef.current = pendingSelection;

	React.useEffect(() => {
		const handleEscapeSelection = (event: globalThis.KeyboardEvent) => {
			const plan = getGalleryEscapePlan({
				hasPreview: Boolean(previewImage),
				hasSelection,
				key: event.key,
			});
			executeGalleryEscapePlan(
				plan,
				event,
				clearSelection,
				() => setPreviewImage(null),
			);
		};
		window.addEventListener("keydown", handleEscapeSelection, true);
		return () =>
			window.removeEventListener("keydown", handleEscapeSelection, true);
	}, [hasSelection, clearSelection, previewImage]);

	React.useEffect(() => {
		if (!isOpen) return undefined;
		const element = galleryViewportRef.current;
		if (!element) return undefined;
		const updateColumns = () => {
			const styles = window.getComputedStyle(element);
			const nextColumns = getGalleryColumnCount(
				element.clientWidth,
				styles.columnGap,
			);
			setGalleryColumns((current) =>
				current === nextColumns ? current : nextColumns,
			);
		};
		updateColumns();
		const resizeObserver = new ResizeObserver(updateColumns);
		resizeObserver.observe(element);
		return () => resizeObserver.disconnect();
	}, [isOpen]);

	React.useEffect(() => {
		resolvePendingGallerySelection({
			pendingSelection,
			currentPathKey: getGalleryPathKey(
				selectedSource,
				selectedCat.id,
				selectedSub,
			),
			images,
			allSubsLength: allSubs.length,
			galleryColumns,
			selectImageByName,
			listRef: galleryListRef,
			viewportRef: galleryViewportRef,
			setPendingSelection,
			setHighlightedImageName,
		});
	}, [
		pendingSelection,
		selectImageByName,
		images,
		allSubs.length,
		galleryColumns,
		selectedSource,
		selectedCat.id,
		selectedSub,
	]);

	React.useEffect(() => {
		if (!isOpen || pendingSelectionRef.current) return;
		scrollGalleryToTop(galleryListRef, galleryViewportRef);
	}, [isOpen, selectedSource, selectedCat.id, selectedSub]);

	React.useEffect(() => {
		if (!highlightedImageName) return undefined;
		const timeout = setTimeout(() => setHighlightedImageName(""), 2800);
		return () => clearTimeout(timeout);
	}, [highlightedImageName]);

	const availableSources = [
		{ slug: "general", name: lang.t("General") },
		...campaigns,
	];
	const canShowDatabaseTokens =
		selectedSource === "general" && selectedCat.id === "tokens";
	const resetContentScope = React.useCallback(() => {
		setContentScope("local");
	}, [setContentScope]);
	const canNavigateBack = navigationHistory.index > 0;
	const canNavigateForward =
		navigationHistory.index >= 0 &&
		navigationHistory.index < navigationHistory.entries.length - 1;
	const recordNavigation = React.useCallback((entry: GalleryPathEntry) => {
		setNavigationHistory((current) => recordGalleryNavigation(current, entry));
	}, []);
	const applyNavigationEntry = React.useCallback(
		(entry: GalleryPathEntry) => {
			if (!entry) return;
			const nextCategory = categories.find(
				(category) => category.id === entry.category,
			);
			if (!nextCategory) return;
			isApplyingHistoryRef.current = true;
			setSelectedSource(entry.source);
			setSelectedCat(nextCategory);
			setSelectedSub(entry.subcategory || "");
			setSearchQuery("");
			setContentScope("local");
			setPendingSelection(null);
			setHighlightedImageName("");
			clearSelection();
		},
		[
			categories,
			setSelectedSource,
			setSelectedCat,
			setSelectedSub,
			setSearchQuery,
			setContentScope,
			clearSelection,
		],
	);
	const navigateHistory = React.useCallback(
		(direction: GalleryHistoryDirection) => {
			const target = getGalleryNavigationEntry(navigationHistory, direction);
			if (!target) return;
			setNavigationHistory((current) => ({ ...current, index: target.index }));
			applyNavigationEntry(target.entry);
		},
		[applyNavigationEntry, navigationHistory],
	);

	React.useEffect(() => {
		if (!isOpen) return;
		if (isApplyingHistoryRef.current) {
			isApplyingHistoryRef.current = false;
			return;
		}
		recordNavigation(
			getGalleryPathEntry(selectedSource, selectedCat.id, selectedSub),
		);
	}, [isOpen, recordNavigation, selectedSource, selectedCat.id, selectedSub]);

	React.useEffect(() => {
		const handleHistoryKeyDown = (event: globalThis.KeyboardEvent) => {
			const plan = getGalleryHistoryKeyboardPlan({
				altKey: event.altKey,
				canNavigateBack,
				canNavigateForward,
				ctrlKey: event.ctrlKey,
				isEditableTarget: isEditableTarget(event.target),
				isOpen,
				key: event.key,
				metaKey: event.metaKey,
				shiftKey: event.shiftKey,
			});
			executeGalleryHistoryKeyboardPlan(plan, event, navigateHistory);
		};
		window.addEventListener("keydown", handleHistoryKeyDown);
		return () => window.removeEventListener("keydown", handleHistoryKeyDown);
	}, [canNavigateBack, canNavigateForward, isOpen, navigateHistory]);

	const openMoveModal = () => {
		setMoveTarget({
			slug: selectedSource,
			category: selectedCat.id,
			subcategory: selectedSub,
		});
		setIsMoveModalOpen(true);
	};
	const sourceSizes = storageStats?.sourceSizes || {};
	const displayImages = React.useMemo(() => {
		const fallbackPath = {
			source: selectedSource,
			category: selectedCat.id,
			subcategory: selectedSub,
		};
		return deduplicateGalleryImages(images, fallbackPath);
	}, [images, selectedSource, selectedCat.id, selectedSub]);
	const galleryItems = React.useMemo(
		() => buildGalleryPresentationItems(allSubs, displayImages),
		[allSubs, displayImages],
	);
	const galleryRowCount = Math.ceil(galleryItems.length / galleryColumns);
	const openGlobalResultPath = (image: GalleryImage) => {
		const plan = getGlobalGalleryResultNavigationPlan({
			categories,
			image,
			isSelectionMode,
		});
		if (!plan) return false;
		setSelectedSource(plan.path.source);
		setSelectedCat(plan.category);
		setSelectedSub(plan.path.subcategory);
		setSearchQuery(plan.searchQuery);
		setContentScope(plan.contentScope);
		setPendingSelection(plan.pendingSelection);
		clearSelection();
		return true;
	};

	return {
		availableSources,
		canNavigateBack,
		canNavigateForward,
		canShowDatabaseTokens,
		galleryColumns,
		galleryController,
		galleryItems,
		galleryListRef,
		galleryRowCount,
		galleryViewportRef,
		highlightedImageName,
		isMoveModalOpen,
		moveTarget,
		navigateHistory,
		openGlobalResultPath,
		openMoveModal,
		previewImage,
		resetContentScope,
		setIsMoveModalOpen,
		setMoveTarget,
		setPreviewImage,
		sourceSizes,
	};
}

export type ImageGalleryUiController = ReturnType<
	typeof useImageGalleryUiController
>;
