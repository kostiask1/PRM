import React from "react";
import ReactList from "react-list";
import { Modal } from "../../modal/index.js";
import { Icon } from "../../../shared/ui/index.js";
import "../../../assets/components/ImageGallery.css";
import useImageGallery from "../model/useImageGallery.ts";
import { classNames } from "../../../shared/lib/index.js";
import { formatBytes } from "../../../shared/lib/index.js";
import { useAppDispatch } from "../../../shared/model/index.js";
import { lang } from "../../../shared/lib/index.js";
import { getSourceFullName } from "../../../entities/reference/index.js";
import type { ImageAsset } from "../api/imageApi.ts";
import type {
	GalleryHistoryDirection,
	GalleryNavigationState,
	GalleryPathEntry,
	GalleryPendingSelection,
	GalleryPresentationItem,
} from "../model/imageGalleryPresentation.ts";
import type { GalleryImage } from "../model/contracts.ts";
import type { ImageLocation } from "../api/imageApi.ts";
import type { IconName } from "../../../shared/ui/index.js";
import ImageGalleryItem from "./ImageGalleryItem.tsx";
import {
	ImageGalleryDialogs,
	ImageGalleryGrid,
	ImageGalleryNavigation,
	ImageGallerySearch,
	ImageGalleryStatsAndActions,
} from "./ImageGallerySections.tsx";
import {
	buildGalleryPresentationItems,
	deduplicateGalleryImages,
	findPendingGalleryImage,
	getGalleryHistoryKeyDirection,
	getGalleryNavigationEntry,
	getGalleryPathEntry,
	getGalleryPathKey,
	recordGalleryNavigation,
} from "../model/imageGalleryPresentation.ts";

const SUB_LABELS: Readonly<Record<string, string>> = {
	npc: "NPC",
	players: "Players",
};

const getImageGalleryModalTitle = (onSelect?: ImageGalleryProps["onSelect"]) =>
	lang.t(typeof onSelect === "function" ? "Choose an image" : "Image gallery");

const getImageScrollId = (name: string) => encodeURIComponent(name || "");

const formatBestiaryFolderLabel = (
	value: string,
	isBestiaryPath: boolean,
): string => {
	const label = lang.t(SUB_LABELS[value] || value);
	return isBestiaryPath ? getSourceFullName(label) : label;
};

const formatImageLocationLabel = (label: string): string =>
	String(label || "")
		.split("/")
		.map((part) => getSourceFullName(part))
		.join("/");

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest("input, textarea, select, [contenteditable='true']"),
	);
}

const scrollGalleryImageIntoView = (
	viewportRef: React.RefObject<HTMLDivElement>,
	imageName: string,
) => {
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
};

const scrollGalleryToTop = (
	listRef: React.RefObject<ReactList>,
	viewportRef: React.RefObject<HTMLDivElement>,
) => {
	requestAnimationFrame(() => {
		listRef.current?.scrollTo(0);
		if (viewportRef.current) {
			viewportRef.current.scrollTop = 0;
		}
	});
};

const resolvePendingGallerySelection = ({
	pendingSelection,
	currentPathKey,
	images,
	allSubsLength,
	galleryColumns,
	selectImageByName,
	listRef,
	viewportRef,
	setPendingSelection,
	setHighlightedImageName,
}: {
	pendingSelection: GalleryPendingSelection | null;
	currentPathKey: string;
	images: GalleryImage[];
	allSubsLength: number;
	galleryColumns: number;
	selectImageByName: (name: string) => boolean;
	listRef: React.RefObject<ReactList>;
	viewportRef: React.RefObject<HTMLDivElement>;
	setPendingSelection: React.Dispatch<
		React.SetStateAction<GalleryPendingSelection | null>
	>;
	setHighlightedImageName: React.Dispatch<React.SetStateAction<string>>;
}) => {
	const targetImage = findPendingGalleryImage({
		pendingSelection,
		currentPathKey,
		images,
	});
	if (!targetImage || !selectImageByName(targetImage.name)) return;
	const imageIndex = images.findIndex(
		(image: GalleryImage) =>
			image.name === targetImage.name && !image.globalSearch,
	);
	const rowIndex = Math.floor((allSubsLength + imageIndex) / galleryColumns);
	setHighlightedImageName("");
	requestAnimationFrame(() => {
		listRef.current?.scrollTo(rowIndex);
		scrollGalleryImageIntoView(viewportRef, targetImage.name);
		setHighlightedImageName(targetImage.name);
	});
	setPendingSelection(null);
};

export interface ImageGalleryProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect?: (image: ImageAsset | null | undefined) => void;
	initialSource?: string;
	initialCategory?: string;
	initialSubcategory?: string;
}

function ImageGallery({
	isOpen,
	onClose,
	onSelect,
	initialSource,
	initialCategory,
	initialSubcategory,
}: ImageGalleryProps) {
	const dispatch = useAppDispatch();
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
		React.useState<GalleryNavigationState>({
		entries: [],
		index: -1,
	});
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
		campaigns,
		categories,
		selectedSource,
		setSelectedSource,
		selectedCat,
		setSelectedCat,
		selectedSub,
		setSelectedSub,
		images,
		setSearchQuery,
		setContentScope,
		storageStats,
	dragOverTarget,
	setDragOverTarget,
	hasSelection,
	clearSelection,
		selectImageByName,
		allSubs,
		handleDrop,
		isReadonlyPath,
	} = galleryController;

	pendingSelectionRef.current = pendingSelection;

	React.useEffect(() => {
		const handleEscapeSelection = (e: globalThis.KeyboardEvent) => {
			if (e.key !== "Escape") return;

			// Fullscreen preview has priority on Escape.
			if (previewImage) {
				e.preventDefault();
				e.stopPropagation();
				setPreviewImage(null);
				return;
			}

			if (hasSelection) {
				e.preventDefault();
				e.stopPropagation();
				clearSelection();
			}
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
			const gap = Number.parseFloat(styles.columnGap) || 16;
			const minItemWidth = 120;
			const nextColumns = Math.max(
				1,
				Math.floor((element.clientWidth + gap) / (minItemWidth + gap)),
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
			const nextCategory = categories.find((cat) => cat.id === entry.category);
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
			if (isEditableTarget(event.target)) return;
			const direction = getGalleryHistoryKeyDirection(event);
			if (!direction) return;
			if (direction === -1 && !canNavigateBack) return;
			if (direction === 1 && !canNavigateForward) return;
			event.preventDefault();
			navigateHistory(direction);
		};

		window.addEventListener("keydown", handleHistoryKeyDown);
		return () => window.removeEventListener("keydown", handleHistoryKeyDown);
	}, [canNavigateBack, canNavigateForward, navigateHistory]);

	const openMoveModal = () => {
		setMoveTarget({
			slug: selectedSource,
			category: selectedCat.id,
			subcategory: selectedSub,
		});
		setIsMoveModalOpen(true);
	};
	const modalTitle = getImageGalleryModalTitle(onSelect);
	const sourceSizes = storageStats?.sourceSizes || {};
	const displayImages = React.useMemo(() => {
		const fallbackPath = {
			source: selectedSource,
			category: selectedCat.id,
			subcategory: selectedSub,
		};
		return deduplicateGalleryImages(images, fallbackPath);
	}, [images, selectedSource, selectedCat.id, selectedSub]);
	const galleryItems = React.useMemo(() => {
		return buildGalleryPresentationItems(allSubs, displayImages);
	}, [allSubs, displayImages]);
	const galleryRowCount = Math.ceil(galleryItems.length / galleryColumns);
	const galleryRenderThreshold = 400;
	const openGlobalResultPath = (image: GalleryImage) => {
		if (typeof onSelect === "function" || !image?.globalSearch) return false;
		const nextCategory = categories.find((cat) => cat.id === image.category);
		if (!nextCategory) return false;

		setSelectedSource(image.source || "general");
		setSelectedCat(nextCategory);
		setSelectedSub(image.subcategory || "");
		setSearchQuery("");
		setContentScope("local");
		setPendingSelection({
			name: image.name,
			pathKey: getGalleryPathKey(
				image.source || "general",
				image.category,
				image.subcategory || "",
			),
		});
		clearSelection();
		return true;
	};

	const renderGalleryItem = (
		item: GalleryPresentationItem,
		itemIndex: number,
	) => (
		<ImageGalleryItem
			controller={galleryController}
			dispatch={dispatch}
			formatFolderLabel={formatBestiaryFolderLabel}
			formatLocationLabel={formatImageLocationLabel}
			highlightedImageName={highlightedImageName}
			item={item}
			itemIndex={itemIndex}
			onOpenGlobalResult={openGlobalResultPath}
			onSelect={onSelect}
			resetContentScope={resetContentScope}
			setPreviewImage={setPreviewImage}
		/>
	);
	const renderGalleryRow = (rowIndex: number, key: number | string) => {
		const start = rowIndex * galleryColumns;
		const rowItems = galleryItems.slice(start, start + galleryColumns);
		const rowKey = rowItems.map((item) => item.key).join("|") || key;
		return (
			<div
				key={rowKey}
				className="ImageGallery__row"
				style={
					{ "--gallery-columns": galleryColumns } as React.CSSProperties &
						Record<"--gallery-columns", number>
				}
			>
				{rowItems.map((item, index) => (
					<React.Fragment key={item.key}>
						{renderGalleryItem(item, start + index)}
					</React.Fragment>
				))}
			</div>
		);
	};

	if (!isOpen) return null;

	return (
		<Modal
			title={modalTitle}
			onConfirm={onClose}
			onCancel={onClose}
			showFooter={false}
			type="custom"
		>
			<div className="ImageGallery">
				<aside className="ImageGallery__sidebar">
					<button
						className={classNames("SourceBtn", {
							is_active: selectedSource === "general",
							is_drag_over: dragOverTarget?.id === "general",
						})}
						onClick={() => {
							resetContentScope();
							setSelectedSource("general");
						}}
						onDragOver={(event) => {
							event.preventDefault();
							if (dragOverTarget?.id !== "general") {
								setDragOverTarget({ type: "source", id: "general" });
							}
						}}
						onDragLeave={() => setDragOverTarget(null)}
						onDrop={(event) =>
							void handleDrop(event, {
								slug: "general",
								category: selectedCat.id,
								subcategory: selectedSub,
								readonly: isReadonlyPath(selectedSub),
							})
						}
					>
						<Icon name="database" size={16} />
						<span>{lang.t("General")}</span>
						<span className="SourceBtn__size">
							{formatBytes(sourceSizes.general ?? 0)}
						</span>
					</button>
					<div className="ImageGallery__sidebar_divider">
						{lang.t("Campaigns")}
					</div>
					{campaigns.map((campaign) => (
						<button
							key={campaign.slug}
							className={classNames("SourceBtn", {
								is_active: selectedSource === campaign.slug,
								is_drag_over: dragOverTarget?.id === campaign.slug,
							})}
							onClick={() => {
								resetContentScope();
								setSelectedSource(campaign.slug);
							}}
							onDragOver={(event) => {
								event.preventDefault();
								if (dragOverTarget?.id !== campaign.slug) {
									setDragOverTarget({ type: "source", id: campaign.slug });
								}
							}}
							onDragLeave={() => setDragOverTarget(null)}
							onDrop={(event) =>
								void handleDrop(event, {
									slug: campaign.slug,
									category: selectedCat.id,
									subcategory: selectedSub,
									readonly: false,
								})
							}
						>
							<Icon name="map" size={16} />
							<span>{campaign.name}</span>
							<span className="SourceBtn__size">
								{formatBytes(sourceSizes[campaign.slug] ?? 0)}
							</span>
						</button>
					))}
				</aside>
				<main className="ImageGallery__main">
					<header className="ImageGallery__tabs">
						{categories.map((category) => (
							<button
								key={category.id}
								className={classNames("TabBtn", {
									is_active: selectedCat.id === category.id,
									is_drag_over: dragOverTarget?.id === category.id,
								})}
								onClick={() => {
									resetContentScope();
									setSelectedCat(category);
									setSelectedSub("");
								}}
								onDragOver={(event) => {
									event.preventDefault();
									if (dragOverTarget?.id !== category.id) {
										setDragOverTarget({ type: "cat", id: category.id });
									}
								}}
								onDragLeave={() => setDragOverTarget(null)}
								onDrop={(event) =>
									void handleDrop(event, {
										slug: selectedSource,
										category: category.id,
										subcategory: "",
										readonly: false,
									})
								}
							>
								<Icon name={category.icon as IconName} size={14} />
								<span>{lang.t(category.label)}</span>
							</button>
						))}
					</header>
					<div className="ImageGallery__toolbar">
						<ImageGalleryNavigation
							canNavigateBack={canNavigateBack}
							canNavigateForward={canNavigateForward}
							controller={galleryController}
							formatFolderLabel={formatBestiaryFolderLabel}
							navigateHistory={navigateHistory}
							resetContentScope={resetContentScope}
						/>
						<ImageGallerySearch
							canShowDatabaseTokens={canShowDatabaseTokens}
							controller={galleryController}
						/>
						<ImageGalleryStatsAndActions
							controller={galleryController}
							onOpenMove={openMoveModal}
						/>
					</div>
					<ImageGalleryGrid
						controller={galleryController}
						viewportRef={galleryViewportRef}
					>
						{galleryRowCount > 0 && (
							<ReactList
								ref={galleryListRef}
								itemRenderer={renderGalleryRow}
								length={galleryRowCount}
								threshold={galleryRenderThreshold}
								itemSizeEstimator={() => {
									const row = galleryViewportRef.current?.querySelector(
										".ImageGallery__row",
									);
									return row?.getBoundingClientRect().height || 170;
								}}
								type="uniform"
							/>
						)}
					</ImageGalleryGrid>
				</main>
			</div>
			<ImageGalleryDialogs
				availableSources={availableSources}
				controller={galleryController}
				isMoveOpen={isMoveModalOpen}
				moveTarget={moveTarget}
				previewImage={previewImage}
				setIsMoveOpen={setIsMoveModalOpen}
				setMoveTarget={setMoveTarget}
				setPreviewImage={setPreviewImage}
			/>
		</Modal>
	);
}

export default ImageGallery;
