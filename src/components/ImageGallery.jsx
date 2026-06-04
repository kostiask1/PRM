import React from "react";
import ReactList from "react-list";
import Modal from "./common/Modal";
import Icon from "./common/Icon";
import "../assets/components/ImageGallery.css";
import { prompt } from "../actions/app";
import Button from "./form/Button";
import useImageGallery from "../hooks/useImageGallery";
import ImageTargetSettings from "./ImageTargetSettings";
import { api } from "../api";
import Tooltip from "./common/Tooltip";
import classNames from "../utils/classNames";
import { formatBytes } from "../utils/formatBytes";
import { useAppDispatch } from "../store/appStore";
import { lang } from "../services/localization";

const SUB_LABELS = {
	npc: "NPC",
	players: "Players",
};

const SUB_ICON_NAMES = {
	npc: "folder-npc",
	players: "folder-players",
};

const getImageGalleryModalTitle = (onSelect) =>
	lang.t(
		typeof onSelect === "function" ? "Choose an image" : "Image gallery",
	);

const getImageScrollId = (name) => encodeURIComponent(name || "");

const getGalleryPathKey = (source, category, subcategory = "") =>
	`${source || ""}\u0000${category || ""}\u0000${subcategory || ""}`;

const getGalleryPathEntry = (source, category, subcategory = "") => ({
	source: source || "general",
	category: category || "",
	subcategory: subcategory || "",
	pathKey: getGalleryPathKey(source || "general", category || "", subcategory || ""),
});

const galleryPathEntriesEqual = (left, right) =>
	Boolean(left && right && left.pathKey === right.pathKey);

function isEditableTarget(target) {
	if (!(target instanceof HTMLElement)) return false;
	return Boolean(
		target.closest("input, textarea, select, [contenteditable='true']"),
	);
}

const scrollGalleryImageIntoView = (viewportRef, imageName) => {
	const imageScrollId = getImageScrollId(imageName);
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			const viewport = viewportRef.current;
			const target = viewport?.querySelector(
				`[data-gallery-image-id="${imageScrollId}"]`,
			);
			target?.scrollIntoView({ block: "center", inline: "nearest" });
		});
	});
};

const findPendingGalleryImage = ({ pendingSelection, currentPathKey, images }) => {
	if (!pendingSelection || pendingSelection.pathKey !== currentPathKey) {
		return null;
	}
	return (
		images.find(
			(image) => image.name === pendingSelection.name && !image.globalSearch,
		) || null
	);
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
}) => {
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
};

function ImageGallery({
	isOpen,
	onClose,
	onSelect,
	initialSource,
	initialCategory,
	initialSubcategory,
}) {
	const dispatch = useAppDispatch();
	const galleryViewportRef = React.useRef(null);
	const galleryListRef = React.useRef(null);
	const isApplyingHistoryRef = React.useRef(false);
	const [isMoveModalOpen, setIsMoveModalOpen] = React.useState(false);
	const [previewImage, setPreviewImage] = React.useState(null);
	const [galleryColumns, setGalleryColumns] = React.useState(1);
	const [pendingSelection, setPendingSelection] = React.useState(null);
	const [highlightedImageName, setHighlightedImageName] = React.useState("");
	const [navigationHistory, setNavigationHistory] = React.useState({
		entries: [],
		index: -1,
	});
	const [moveTarget, setMoveTarget] = React.useState({
		slug: "general",
		category: "attachments",
		subcategory: "",
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
		searchQuery,
		setSearchQuery,
		searchMode,
		setSearchMode,
		isSearchResults,
		storageStats,
		selectedFilenames,
		selectedSubs,
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
		isReadonlySub,
		isReadonlyImage,
		isReadonlyCurrentFolder,
		isReadonlyPath,
	} = useImageGallery({
		isOpen,
		initialSource,
		initialCategory,
		initialSubcategory,
	});

	React.useEffect(() => {
		const handleEscapeSelection = (e) => {
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
		if (!highlightedImageName) return undefined;
		const timeout = setTimeout(() => setHighlightedImageName(""), 2800);
		return () => clearTimeout(timeout);
	}, [highlightedImageName]);

	const availableSources = [
		{ slug: "general", name: lang.t("General") },
		...campaigns,
	];
	const canNavigateBack = navigationHistory.index > 0;
	const canNavigateForward =
		navigationHistory.index >= 0 &&
		navigationHistory.index < navigationHistory.entries.length - 1;

	const recordNavigation = React.useCallback((entry) => {
		if (!entry?.category) return;
		setNavigationHistory((current) => {
			const currentEntry = current.entries[current.index];
			if (galleryPathEntriesEqual(currentEntry, entry)) return current;
			const entries = current.entries.slice(0, current.index + 1).concat(entry);
			return {
				entries,
				index: entries.length - 1,
			};
		});
	}, []);

	const applyNavigationEntry = React.useCallback(
		(entry) => {
			if (!entry) return;
			const nextCategory = categories.find((cat) => cat.id === entry.category);
			if (!nextCategory) return;
			isApplyingHistoryRef.current = true;
			setSelectedSource(entry.source);
			setSelectedCat(nextCategory);
			setSelectedSub(entry.subcategory || "");
			setSearchQuery("");
			setSearchMode("local");
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
			setSearchMode,
			clearSelection,
		],
	);

	const navigateHistory = React.useCallback(
		(direction) => {
			const nextIndex = navigationHistory.index + direction;
			const nextEntry = navigationHistory.entries[nextIndex];
			if (!nextEntry) return;
			setNavigationHistory((current) => ({ ...current, index: nextIndex }));
			applyNavigationEntry(nextEntry);
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
		const handleHistoryKeyDown = (event) => {
			if (isEditableTarget(event.target)) return;
			const hasOnlyAlt = event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
			const hasNoModifiers =
				!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
			const shouldNavigateBack =
				(event.key === "Backspace" && hasNoModifiers) ||
				(event.key === "ArrowLeft" && hasOnlyAlt);
			const shouldNavigateForward =
				event.key === "ArrowRight" && hasOnlyAlt;

			if (shouldNavigateBack) {
				if (!canNavigateBack) return;
				event.preventDefault();
				navigateHistory(-1);
				return;
			}
			if (!shouldNavigateForward || !canNavigateForward) return;
			event.preventDefault();
			navigateHistory(1);
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
	const galleryItems = React.useMemo(() => {
		return [
			...allSubs.map((sub) => ({ type: "sub", sub })),
			...images.map((image) => ({ type: "image", image })),
		];
	}, [allSubs, images]);
	const galleryRowCount = Math.ceil(galleryItems.length / galleryColumns);
	const openGlobalResultPath = (image) => {
		if (typeof onSelect === "function" || !image?.globalSearch) return false;
		const nextCategory = categories.find((cat) => cat.id === image.category);
		if (!nextCategory) return false;

		setSelectedSource(image.source || "general");
		setSelectedCat(nextCategory);
		setSelectedSub(image.subcategory || "");
		setSearchQuery("");
		setSearchMode("local");
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

	const renderGalleryItem = (item, itemIndex) => {
		if (item.type === "sub") {
			const sub = item.sub;
			const isReadonly = isReadonlySub(sub);
			const folderIcon = SUB_ICON_NAMES[sub] || "folder";
			return (
				<div
					key={`sub:${sub}`}
					className={classNames(
						"ImageGallery__item",
						"ImageGallery__item__folder",
						{
							is_selected: selectedSubs.has(sub),
							is_drag_over: dragOverTarget?.id === sub,
							is_protected: isReadonly,
						},
					)}
					onClick={(e) => {
						if (isReadonly) return;
						handleItemClick(sub, "sub", itemIndex, e);
					}}
					onDoubleClick={() => {
						const nextPath = selectedSub ? `${selectedSub}/${sub}` : sub;
						setSelectedSub(nextPath);
					}}
					draggable={!isReadonly}
					onDragStart={(e) => handleDragStart(e, sub, "sub")}
					onDragEnd={handleDragEnd}
					onDragOver={(e) => {
						if (isReadonly) return;
						e.preventDefault();
						if (dragOverTarget?.id !== sub) {
							setDragOverTarget({ type: "sub", id: sub });
						}
					}}
					onDragLeave={() => setDragOverTarget(null)}
					onDrop={(e) => {
						const destSub = selectedSub ? `${selectedSub}/${sub}` : sub;
						handleDrop(e, {
							slug: selectedSource,
							category: selectedCat.id,
							subcategory: destSub,
							readonly: isReadonlyPath(destSub),
						});
					}}
				>
					<div className="ImageGallery__image_wrap">
						<Icon name={folderIcon} size={48} />
						{!isReadonly && (
							<div
								className="ImageGallery__checkbox"
								onClick={(e) => toggleSelect(sub, "sub", e)}
							>
								<Icon
									name={selectedSubs.has(sub) ? "check" : "plus"}
									size={12}
								/>
							</div>
						)}
					</div>
					<span className="ImageGallery__name">
						<button
							type="button"
							className="ImageGallery__nameBtn"
							onClick={async (e) => {
								if (isReadonly) return;
								e.stopPropagation();
								const newName = await dispatch(
									prompt({
										title: lang.t("Rename folder"),
										message: lang.t("Enter a new name:"),
										defaultValue: sub,
									}),
								);
								if (newName) handleRenameSub(sub, newName);
							}}
						>
							{lang.t(SUB_LABELS[sub] || sub)}
						</button>
					</span>
				</div>
			);
		}

		const img = item.image;
		const imageReadonly = isReadonlyImage(img);
		return (
			<Tooltip
				key={`image:${img.url}`}
				content={lang.t("Right-click: open fullscreen")}
			>
				<div
					data-gallery-image-id={getImageScrollId(img.name)}
					className={classNames("ImageGallery__item", {
						is_selected: selectedFilenames.has(img.name),
						is_navigated: highlightedImageName === img.name,
						is_protected: imageReadonly,
					})}
					onClick={(e) => {
						e.stopPropagation();
						if (openGlobalResultPath(img)) return;
						handleItemClick(img.name, "image", itemIndex, e);
					}}
					onDoubleClick={() => onSelect?.(img)}
					onContextMenu={(e) => {
						e.preventDefault();
						setPreviewImage(img);
					}}
					draggable={!imageReadonly}
					onDragStart={(e) => handleDragStart(e, img, "image")}
					onDragEnd={handleDragEnd}
				>
					<div className="ImageGallery__image_wrap">
						<img src={img.url} alt="" loading="lazy" decoding="async" />
						{!imageReadonly && (
							<div
								className="ImageGallery__checkbox"
								onClick={(e) => toggleSelect(img.name, "image", e)}
							>
								<Icon
									name={selectedFilenames.has(img.name) ? "check" : "plus"}
									size={12}
								/>
							</div>
						)}
					</div>
					<Tooltip content={img.displayName || img.name}>
						<span className="ImageGallery__name">
							<button
								type="button"
								className="ImageGallery__nameBtn"
								onClick={async (e) => {
									if (imageReadonly) return;
									e.stopPropagation();
									const currentClean = getCleanName(img.name);
									const newBaseName = await dispatch(
										prompt({
											title: lang.t("Rename file"),
											message: lang.t("Enter a new name:"),
											defaultValue: currentClean,
										}),
									);
									if (newBaseName && newBaseName !== currentClean) {
										const ext = img.name.split(".").pop();
										handleRenameImage(img.name, `${newBaseName}.${ext}`);
									}
								}}
							>
								{getCleanName(img.displayName || img.name)}
							</button>
						</span>
					</Tooltip>
					{isSearchResults && img.locationLabel && (
						<span className="ImageGallery__location">{img.locationLabel}</span>
					)}
				</div>
			</Tooltip>
		);
	};

	const renderGalleryRow = (rowIndex, key) => {
		const start = rowIndex * galleryColumns;
		const rowItems = galleryItems.slice(start, start + galleryColumns);
		return (
			<div
				key={key}
				className="ImageGallery__row"
				style={{ "--gallery-columns": galleryColumns }}
			>
				{rowItems.map((item, index) => renderGalleryItem(item, start + index))}
			</div>
		);
	};

	if (!isOpen) return null;

	return (
		<Modal
			title={modalTitle}
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
						onClick={() => setSelectedSource("general")}
						onDragOver={(e) => {
							e.preventDefault();
							if (dragOverTarget?.id !== "general") {
								setDragOverTarget({ type: "source", id: "general" });
							}
						}}
						onDragLeave={() => setDragOverTarget(null)}
						onDrop={(e) =>
							handleDrop(e, {
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
							{formatBytes(sourceSizes.general)}
						</span>
					</button>
					<div className="ImageGallery__sidebar_divider">
						{lang.t("Campaigns")}
					</div>
					{campaigns.map((c) => (
						<button
							key={c.slug}
							className={classNames("SourceBtn", {
								is_active: selectedSource === c.slug,
								is_drag_over: dragOverTarget?.id === c.slug,
							})}
							onClick={() => setSelectedSource(c.slug)}
							onDragOver={(e) => {
								e.preventDefault();
								if (dragOverTarget?.id !== c.slug) {
									setDragOverTarget({ type: "source", id: c.slug });
								}
							}}
							onDragLeave={() => setDragOverTarget(null)}
							onDrop={(e) =>
								handleDrop(e, {
									slug: c.slug,
									category: selectedCat.id,
									subcategory: selectedSub,
									readonly: false,
								})
							}
						>
							<Icon name="map" size={16} />
							<span>{c.name}</span>
							<span className="SourceBtn__size">
								{formatBytes(sourceSizes[c.slug])}
							</span>
						</button>
					))}
				</aside>

				<main className="ImageGallery__main">
					<header className="ImageGallery__tabs">
						{categories.map((cat) => (
							<button
								key={cat.id}
								className={classNames("TabBtn", {
									is_active: selectedCat.id === cat.id,
									is_drag_over: dragOverTarget?.id === cat.id,
								})}
								onClick={() => {
									setSelectedCat(cat);
									setSelectedSub("");
								}}
								onDragOver={(e) => {
									e.preventDefault();
									if (dragOverTarget?.id !== cat.id) {
										setDragOverTarget({ type: "cat", id: cat.id });
									}
								}}
								onDragLeave={() => setDragOverTarget(null)}
								onDrop={(e) =>
									handleDrop(e, {
										slug: selectedSource,
										category: cat.id,
										subcategory: "",
										readonly: false,
									})
								}
							>
								<Icon name={cat.icon} size={14} />
								<span>{lang.t(cat.label)}</span>
							</button>
						))}
					</header>

					<div className="ImageGallery__toolbar">
						<div className="ImageGallery__nav">
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="back"
								onClick={() => navigateHistory(-1)}
								disabled={!canNavigateBack}
								title={lang.t("Back")}
								className="ImageGallery__nav_btn"
							/>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="forward"
								onClick={() => navigateHistory(1)}
								disabled={!canNavigateForward}
								title={lang.t("Forward")}
								className="ImageGallery__nav_btn"
							/>
						</div>
						<div className="ImageGallery__breadcrumbs">
							<button
								className={classNames("BreadcrumbItem", {
									is_active: selectedSub === "",
									is_drag_over:
										dragOverTarget?.type === "breadcrumb" &&
										dragOverTarget?.id === "__root__",
								})}
								onClick={() => setSelectedSub("")}
								onDragOver={(e) => {
									e.preventDefault();
									setDragOverTarget({ type: "breadcrumb", id: "__root__" });
								}}
								onDragLeave={() => setDragOverTarget(null)}
								onDrop={(e) =>
									handleDrop(e, {
										slug: selectedSource,
										category: selectedCat.id,
										subcategory: "",
										readonly: false,
									})
								}
							>
								<Icon name="home" size={14} />
							</button>
							{selectedSub
								.split("/")
								.filter(Boolean)
								.map((part, idx, arr) => (
									<React.Fragment key={idx}>
										<Icon
											name="chevron"
											size={10}
											className="BreadcrumbSeparator"
										/>
										{(() => {
											const breadcrumbPath = arr.slice(0, idx + 1).join("/");
											return (
												<button
													className={classNames("BreadcrumbItem", {
														is_active: idx === arr.length - 1,
														is_drag_over:
															dragOverTarget?.type === "breadcrumb" &&
															dragOverTarget?.id === breadcrumbPath,
													})}
													onClick={() => {
														setSelectedSub(breadcrumbPath);
													}}
													onDragOver={(e) => {
														e.preventDefault();
														setDragOverTarget({
															type: "breadcrumb",
															id: breadcrumbPath,
														});
													}}
													onDragLeave={() => setDragOverTarget(null)}
													onDrop={(e) =>
														handleDrop(e, {
															slug: selectedSource,
															category: selectedCat.id,
															subcategory: breadcrumbPath,
															readonly: isReadonlyPath(breadcrumbPath),
														})
													}
												>
													{lang.t(SUB_LABELS[part] || part)}
												</button>
											);
										})()}
									</React.Fragment>
								))}
							<Icon name="chevron" size={10} className="BreadcrumbSeparator" />
							{!isReadonlyCurrentFolder && (
							<div className="ImageGallery__new_sub">
								{isCreatingSub ? (
									<>
										<input
											autoFocus
											value={newSubName}
											onChange={(e) => setNewSubName(e.target.value)}
											onKeyDown={(e) => e.key === "Enter" && handleCreateSub()}
											placeholder={lang.t("Folder name...")}
										/>
										<Button
											size={Button.SIZES.SMALL}
											icon="check"
											onClick={handleCreateSub}
										/>
										<Button
											size={Button.SIZES.SMALL}
											icon="x"
											onClick={() => setIsCreatingSub(false)}
										/>
									</>
								) : (
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="plus"
										onClick={() => setIsCreatingSub(true)}
										title={lang.t("Create subfolder")}
									/>
								)}
							</div>
							)}
						</div>
						<div className="ImageGallery__search">
							<Icon name="search" size={14} />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder={lang.t("Search images...")}
							/>
							{searchQuery && (
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									icon="x"
									onClick={() => setSearchQuery("")}
									title={lang.t("Clear search")}
								/>
							)}
							<Button
								className="DetailedSearchButton ImageGallery__globalSearchBtn"
								variant={searchMode === "global" ? "primary" : "ghost"}
								size={Button.SIZES.SMALL}
								icon="search-detailed"
								onClick={() =>
									setSearchMode((mode) =>
										mode === "global" ? "local" : "global",
									)
								}
								title={lang.t("Global search")}
							/>
						</div>
						<div className="ImageGallery__storage_stats">
							<span>
								{lang.t("Total gallery size")}:{" "}
								<strong>{formatBytes(storageStats?.totalBytes)}</strong>
							</span>
							<span>
								{lang.t("Tab size")}:{" "}
								<strong>{formatBytes(storageStats?.categoryBytes)}</strong>
							</span>
						</div>
						<div className="ImageGallery__upload_actions">
							{hasSelection && (
								<>
									<Button
										variant="ghost"
										size={Button.SIZES.SMALL}
										icon="move"
										onClick={openMoveModal}
									>
										{lang.t("Move")} (
										{selectedFilenames.size + selectedSubs.size})
									</Button>
									<Button
										className="ImageGallery__deleteBtn"
										variant="danger"
										size={Button.SIZES.SMALL}
										icon="trash"
										onClick={handleBulkDelete}
									>
										{lang.t("Delete")} (
										{selectedFilenames.size + selectedSubs.size})
									</Button>
								</>
							)}
							{!isReadonlyCurrentFolder && (
							<label className="UploadBtn">
								<Icon name="plus" size={14} />
								<span>{lang.t("Upload")}</span>
								<input
									type="file"
									multiple
									accept="image/*"
									hidden
									onChange={(e) => handleFileUpload(e.target.files)}
								/>
							</label>
							)}
						</div>
					</div>

					<div
						ref={galleryViewportRef}
						className={classNames("ImageGallery__grid", {
							is_dragging: isDraggingOver,
						})}
						onDragOver={(e) => {
							e.preventDefault();
							const isSameLocation =
								dragSource &&
								dragSource.slug === selectedSource &&
								dragSource.category === selectedCat.id &&
								dragSource.subcategory === selectedSub;

							if (!isSameLocation && !isReadonlyCurrentFolder) {
								setIsDraggingOver(true);
							}
						}}
						onDragLeave={() => setIsDraggingOver(false)}
						onDrop={(e) =>
							handleDrop(e, {
								slug: selectedSource,
								category: selectedCat.id,
								subcategory: selectedSub,
								readonly: isReadonlyCurrentFolder,
							})
						}
					>
						{isDraggingOver && (
							<div className="ImageGallery__drop_overlay">
								<Icon name="import" size={48} />
								<p>{lang.t("Release to upload here")}</p>
							</div>
						)}

						{galleryRowCount > 0 && (
							<ReactList
								ref={galleryListRef}
								itemRenderer={renderGalleryRow}
								length={galleryRowCount}
								itemSizeEstimator={() => {
									const row =
										galleryViewportRef.current?.querySelector(
											".ImageGallery__row",
										);
									return row?.getBoundingClientRect().height || 170;
								}}
								type="uniform"
							/>
						)}
					</div>
				</main>
			</div>

			{isMoveModalOpen && (
				<Modal
					title={lang.t("Move selected items")}
					onCancel={() => setIsMoveModalOpen(false)}
					onConfirm={async () => {
						const moved = await handleMoveSelection(moveTarget);
						if (moved) setIsMoveModalOpen(false);
					}}
					confirmLabel={lang.t("Move")}
				>
					<ImageTargetSettings
						sources={availableSources.map((source) => ({
							id: source.slug,
							label: source.name,
							icon: source.slug === "general" ? "database" : "map",
						}))}
						categories={categories}
						value={{
							source: moveTarget.slug,
							category: moveTarget.category,
							subcategory: moveTarget.subcategory,
						}}
						onChange={(next) =>
							setMoveTarget({
								slug: next.source,
								category: next.category,
								subcategory: next.subcategory || "",
							})
						}
						loadSubcategories={({ source, category, subcategory }) =>
							api.getSubcategories(source, category, subcategory)
						}
						createSubcategory={({ source, category, fullPath }) =>
							api.createSubcategory(source, category, fullPath)
						}
					/>
				</Modal>
			)}

			{previewImage && (
				<Modal
					title={previewImage.name}
					type="custom"
					className="ImageGallery__previewModal"
					showFooter={false}
					onCancel={() => setPreviewImage(null)}
				>
					<div className="ImageGallery__previewWrap">
						<img
							className="ImageGallery__previewImg"
							src={previewImage.url}
							alt={previewImage.name}
							onClick={() => setPreviewImage(null)}
						/>
					</div>
				</Modal>
			)}
		</Modal>
	);
}

export default ImageGallery;
