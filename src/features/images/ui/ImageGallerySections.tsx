import {
	Fragment,
	useId,
	useRef,
	useState,
	type Dispatch,
	type DragEvent,
	type ReactNode,
	type RefObject,
	type SetStateAction,
} from "react";
import { Button, Icon, Modal, Tooltip, usePointerDownOutsideDismissal } from "../../../shared/ui/index.js";
import { classNames, formatBytes, lang } from "../../../shared/lib/index.js";
import type { ImageLocation } from "../api/imageApi.ts";
import { imageApi as api } from "../api/imageApi.ts";
import {
	getGalleryStatsAndActionsPresentation,
	getGallerySearchPresentation,
	type GalleryHistoryDirection,
	type GallerySearchPresentation,
	type GallerySearchScopeControl,
	type GalleryStatsAndActionsPresentation,
} from "../model/imageGalleryPresentation.ts";
import type { GalleryImage } from "../model/contracts.ts";
import type useImageGallery from "../model/useImageGallery.ts";
import {
	getGalleryGridDragOverPlan,
	getGalleryGridDropPlan,
	getGalleryGridDropTarget,
	getGalleryPreviewNavigationState,
	type GalleryGridDragOverPlan,
	type GalleryGridDropPlan,
	type GalleryPreviewDirection,
	type GalleryPreviewNavigationState,
} from "../model/imageGalleryInteraction.ts";
import ImageTargetSettings from "./ImageTargetSettings.tsx";

type ImageGalleryController = ReturnType<typeof useImageGallery>;

function executeGalleryGridDragOverPlan(
	plan: GalleryGridDragOverPlan,
	event: Pick<DragEvent, "preventDefault">,
	setIsDraggingOver: (value: boolean) => void,
): void {
	event.preventDefault();
	if (plan.nextDraggingOver !== null) {
		setIsDraggingOver(plan.nextDraggingOver);
	}
}

function executeGalleryGridDropPlan(
	plan: GalleryGridDropPlan,
	event: DragEvent,
	setIsDraggingOver: (value: boolean) => void,
	handleDrop: ImageGalleryController["handleDrop"],
): void {
	if (plan.action === "reject-search") {
		event.preventDefault();
		setIsDraggingOver(plan.nextDraggingOver);
		return;
	}
	void handleDrop(event, plan.target);
}

export function ImageGalleryNavigation({
	canNavigateBack,
	canNavigateForward,
	controller,
	formatFolderLabel,
	navigateHistory,
	resetContentScope,
}: {
	canNavigateBack: boolean;
	canNavigateForward: boolean;
	controller: ImageGalleryController;
	formatFolderLabel: (value: string, isBestiaryPath: boolean) => string;
	navigateHistory: (direction: GalleryHistoryDirection) => void;
	resetContentScope: () => void;
}) {
	const {
		dragSource,
		dragOverTarget,
		handleCreateSub,
		handleDrop,
		isAllCategory,
		isCreatingSub,
		isReadonlyCurrentFolder,
		isReadonlyPath,
		newSubName,
		selectedCat,
		selectedSource,
		selectedSub,
		setDragOverTarget,
		setIsCreatingSub,
		setNewSubName,
		setSelectedSub,
	} = controller;
	const pathParts = selectedSub.split("/").filter(Boolean);
	return (
		<>
			<div className="ImageGallery__nav">
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="back"
					aria-label={lang.t("Back")}
					onClick={() => navigateHistory(-1)}
					disabled={!canNavigateBack}
					title={lang.t("Back")}
					className="ImageGallery__nav_btn"
				/>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="forward"
					aria-label={lang.t("Forward")}
					onClick={() => navigateHistory(1)}
					disabled={!canNavigateForward}
					title={lang.t("Forward")}
					className="ImageGallery__nav_btn"
				/>
			</div>
			{!isAllCategory && <div className="ImageGallery__breadcrumbs">
				<button
					type="button"
					aria-label={lang.t("Root folder")}
					className={classNames("ImageGallery__breadcrumbItem", {
						is_active: selectedSub === "",
						is_drag_over:
							dragOverTarget?.type === "breadcrumb" &&
							dragOverTarget.id === "__root__",
					})}
					onClick={() => {
						resetContentScope();
						setSelectedSub("");
					}}
					onDragOver={(event) => {
						if (!dragSource || !selectedSub) return;
						event.preventDefault();
						setDragOverTarget({ type: "breadcrumb", id: "__root__" });
					}}
					onDragLeave={() => setDragOverTarget(null)}
					onDrop={(event) =>
						void handleDrop(event, {
							slug: selectedSource,
							category: selectedCat.id,
							subcategory: "",
							readonly: false,
						})
					}
				>
					<Icon name="home" size={14} />
				</button>
				{pathParts.map((part, index) => {
					const breadcrumbPath = pathParts.slice(0, index + 1).join("/");
					const isBestiaryBreadcrumb = isReadonlyPath(breadcrumbPath);
					const breadcrumbLabel = formatFolderLabel(
						part,
						isBestiaryBreadcrumb,
					);
					return (
						<Fragment key={breadcrumbPath}>
							<Icon name="chevron" size={10} className="ImageGallery__breadcrumbSeparator" />
							<Tooltip content={breadcrumbLabel} disabled={!isBestiaryBreadcrumb}>
								<button
									className={classNames("ImageGallery__breadcrumbItem", {
										is_active: index === pathParts.length - 1,
										is_drag_over:
											dragOverTarget?.type === "breadcrumb" &&
											dragOverTarget.id === breadcrumbPath,
									})}
									onClick={() => {
										resetContentScope();
										setSelectedSub(breadcrumbPath);
									}}
									onDragOver={(event) => {
										if (!dragSource || isBestiaryBreadcrumb || breadcrumbPath === selectedSub) return;
										event.preventDefault();
										setDragOverTarget({
											type: "breadcrumb",
											id: breadcrumbPath,
										});
									}}
									onDragLeave={() => setDragOverTarget(null)}
									onDrop={(event) =>
										void handleDrop(event, {
											slug: selectedSource,
											category: selectedCat.id,
											subcategory: breadcrumbPath,
											readonly: isReadonlyPath(breadcrumbPath),
										})
									}
								>
									{breadcrumbLabel}
								</button>
							</Tooltip>
						</Fragment>
					);
				})}
				<Icon name="chevron" size={10} className="ImageGallery__breadcrumbSeparator" />
				{!isReadonlyCurrentFolder && (
					<div className="ImageGallery__new_sub">
						{isCreatingSub ? (
							<>
								<input
									autoFocus
									aria-label={lang.t("Folder name...")}
									value={newSubName}
									onChange={(event) => setNewSubName(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") void handleCreateSub();
									}}
									placeholder={lang.t("Folder name...")}
								/>
								<Button size={Button.SIZES.SMALL} icon="check" aria-label={lang.t("Create subfolder")} onClick={handleCreateSub} />
								<Button
									size={Button.SIZES.SMALL}
									icon="x"
									aria-label={lang.t("Cancel")}
									onClick={() => setIsCreatingSub(false)}
								/>
							</>
						) : (
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="plus"
								aria-label={lang.t("Create subfolder")}
								onClick={() => setIsCreatingSub(true)}
								title={lang.t("Create subfolder")}
							/>
						)}
					</div>
				)}
			</div>}
		</>
	);
}

function ImageGallerySearchInput({
	presentation,
	searchQuery,
	setSearchQuery,
}: {
	presentation: GallerySearchPresentation;
	searchQuery: string;
	setSearchQuery: (value: string) => void;
}) {
	return (
		<>
			<Icon name="search" size={14} />
			<input
				type="text"
				aria-label={lang.t(presentation.placeholderKey)}
				value={searchQuery}
				onChange={(event) => setSearchQuery(event.target.value)}
				placeholder={lang.t(presentation.placeholderKey)}
			/>
			{presentation.showClearButton && (
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="x"
					onClick={() => setSearchQuery(presentation.clearSearchQuery)}
					aria-label={lang.t(presentation.clearTitleKey)}
					title={lang.t(presentation.clearTitleKey)}
				/>
			)}
		</>
	);
}

function ImageGalleryScopeButton({
	control,
	setContentScope,
}: {
	control: GallerySearchScopeControl;
	setContentScope: (scope: GallerySearchScopeControl["nextScope"]) => void;
}) {
	return (
		<Button
			className="ImageGallery__scopeBtn"
			variant={control.isActive ? "primary" : "ghost"}
			size={Button.SIZES.SMALL}
			onClick={() => setContentScope(control.scope)}
			aria-pressed={control.isActive}
			title={lang.t(control.titleKey)}
		>
			{lang.t(control.scope === "source" ? "Current library" : control.scope === "all" ? "Entire gallery" : "Database tokens")}
		</Button>
	);
}

export function ImageGallerySearch({
	canShowDatabaseTokens,
	controller,
}: {
	canShowDatabaseTokens: boolean;
	controller: ImageGalleryController;
}) {
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
	const searchAreaRef = useRef<HTMLDivElement>(null);
	usePointerDownOutsideDismissal({ containerRef: searchAreaRef, isOpen: isAdvancedOpen, setIsOpen: setIsAdvancedOpen });
	const searchScopesId = useId();
	const {
		contentScope,
		isAllCategory,
		searchQuery,
		selectedSource,
		setContentScope,
		setSearchQuery,
	} = controller;
	const presentation = getGallerySearchPresentation({
		canShowDatabaseTokens,
		contentScope,
		searchQuery,
		selectedSource,
	});
	const scopeDescription = contentScope === "all"
		? "Search by name across all libraries, groups, and subfolders."
		: contentScope === "source"
			? "Search by name across this library, its groups, and subfolders."
			: contentScope === "databaseTokens"
				? "Search official database tokens by name."
				: "Search by name in this folder and its subfolders.";
	return (
		<div ref={searchAreaRef} className="ImageGallery__searchArea" onKeyDown={(event) => {
			if (event.key !== "Escape" || !isAdvancedOpen) return;
			event.stopPropagation();
			setIsAdvancedOpen(false);
			searchAreaRef.current?.querySelector<HTMLButtonElement>("[aria-expanded]")?.focus();
		}}>
			<div className="ImageGallery__searchRow">
				<div className="ImageGallery__search">
					<ImageGallerySearchInput
						presentation={presentation}
						searchQuery={searchQuery}
						setSearchQuery={setSearchQuery}
					/>
				</div>
				<Button variant={isAdvancedOpen ? "primary" : "ghost"} size={Button.SIZES.SMALL} icon="search-detailed" onClick={() => setIsAdvancedOpen((open) => !open)} aria-expanded={isAdvancedOpen} aria-controls={isAdvancedOpen ? searchScopesId : undefined}>
					{lang.t("Advanced search")}
					{!isAdvancedOpen && contentScope !== "local" && !(isAllCategory && contentScope === "source") && ` · ${lang.t(contentScope === "source" ? "Current library" : contentScope === "all" ? "Entire gallery" : "Database tokens")}`}
				</Button>
			</div>
			{isAdvancedOpen && (
				<div id={searchScopesId} className="ImageGallery__searchScopes" role="group" aria-label={lang.t("Search scope")}>
					<div className="ImageGallery__searchScopesHeader">
						<span className="ImageGallery__searchScopesLabel">{lang.t("Search scope")}</span>
						<Button variant="ghost" size={Button.SIZES.SMALL} onClick={() => { setSearchQuery(""); setContentScope("local"); }} disabled={!searchQuery && contentScope === (isAllCategory ? "source" : "local")}>{lang.t("Reset")}</Button>
					</div>
					<div className="ImageGallery__scopeButtons">
						{!isAllCategory && <Button className="ImageGallery__scopeBtn" variant={contentScope === "local" ? "primary" : "ghost"} size={Button.SIZES.SMALL} onClick={() => setContentScope("local")} aria-pressed={contentScope === "local"}>
							{lang.t("This folder")}
						</Button>}
						{presentation.scopeControls.map((control) => (
							<ImageGalleryScopeButton key={control.scope} control={control} setContentScope={setContentScope} />
						))}
					</div>
					<p className="ImageGallery__scopeDescription">{lang.t(scopeDescription)}</p>
				</div>
			)}
		</div>
	);
}

function ImageGalleryStorageStats({
	presentation,
}: {
	presentation: GalleryStatsAndActionsPresentation;
}) {
	return (
		<div className="ImageGallery__storage_stats">
			{presentation.storageItems.map((item) => (
				<span key={item.id}>
					{lang.t(item.labelKey)}: {" "}
					<strong>{formatBytes(item.bytes)}</strong>
				</span>
			))}
		</div>
	);
}

function ImageGallerySelectionActions({
	onDelete,
	onOpenMove,
	presentation,
}: {
	onDelete: () => void;
	onOpenMove: () => void;
	presentation: GalleryStatsAndActionsPresentation;
}) {
	if (!presentation.showSelectionActions) return null;
	return (
		<>
			<Button
				variant="ghost"
				size={Button.SIZES.SMALL}
				icon="export"
				onClick={onOpenMove}
			>
				({presentation.selectionCount})
			</Button>
			<Button
				variant="danger"
				size={Button.SIZES.SMALL}
				icon="trash"
				onClick={onDelete}
			>
				({presentation.selectionCount})
			</Button>
		</>
	);
}

function ImageGalleryUploadControl({
	onUpload,
	presentation,
}: {
	onUpload: (files: FileList) => void;
	presentation: GalleryStatsAndActionsPresentation;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	if (!presentation.showUpload) return null;
	return (
		<>
			<button type="button" className="ImageGallery__uploadButton" onClick={() => inputRef.current?.click()}>
				<Icon name="plus" size={14} />
				<span>{lang.t("Upload")}</span>
			</button>
			<input
				ref={inputRef}
				type="file"
				multiple
				accept="image/*"
				hidden
				onChange={(event) => {
					if (event.target.files) onUpload(event.target.files);
					event.target.value = "";
				}}
			/>
		</>
	);
}

export function ImageGalleryStatsAndActions({
	controller,
	onOpenMove,
	onSelect,
	isSelectionMode = false,
}: {
	controller: ImageGalleryController;
	onOpenMove: () => void;
	onSelect?: () => void;
	isSelectionMode?: boolean;
}) {
	const {
		handleBulkDelete,
		handleFileUpload,
		hasSelection,
		isReadonlyCurrentFolder,
		isAllCategory,
		selectedFilenames,
		selectedSubs,
		storageStats,
	} = controller;
	const presentation = getGalleryStatsAndActionsPresentation({
		hasSelection,
		isReadonlyCurrentFolder,
		selectedFilenameCount: selectedFilenames.size,
		selectedSubfolderCount: selectedSubs.size,
		storageStats: isAllCategory && storageStats ? { ...storageStats, categoryBytes: storageStats.sourceBytes } : storageStats,
	});
	return (
		<>
			<ImageGalleryStorageStats presentation={presentation} />
			<div className={classNames("ImageGallery__upload_actions", { is_selection_mode: isSelectionMode })}>
				{isSelectionMode && <Button variant="primary" size={Button.SIZES.SMALL} icon="check" disabled={!onSelect} onClick={onSelect}>{lang.t("Choose")}</Button>}
				<ImageGallerySelectionActions
					onDelete={handleBulkDelete}
					onOpenMove={onOpenMove}
					presentation={presentation}
				/>
				<ImageGalleryUploadControl
					onUpload={(files) => void handleFileUpload(files)}
					presentation={presentation}
				/>
			</div>
		</>
	);
}

export function ImageGalleryGrid({
	children,
	controller,
	viewportRef,
}: {
	children: ReactNode;
	controller: ImageGalleryController;
	viewportRef: RefObject<HTMLDivElement>;
}) {
	const {
		dragSource,
		handleDrop,
		isDraggingOver,
		isReadonlyCurrentFolder,
		isSearchResults,
		selectedCat,
		selectedSource,
		selectedSub,
		setIsDraggingOver,
	} = controller;
	const dropTarget = getGalleryGridDropTarget({
		category: selectedCat.id,
		isReadonly: isReadonlyCurrentFolder,
		slug: selectedSource,
		subcategory: selectedSub,
	});
	return (
		<div
			ref={viewportRef}
			className={classNames("ImageGallery__grid", {
				is_dragging: isDraggingOver,
			})}
			onDragOver={(event) => {
				const plan = getGalleryGridDragOverPlan({
					dragSource,
					isSearchResults,
					target: dropTarget,
				});
				executeGalleryGridDragOverPlan(plan, event, setIsDraggingOver);
			}}
			onDragLeave={() => setIsDraggingOver(false)}
			onDrop={(event) => {
				const plan = getGalleryGridDropPlan({
					isSearchResults,
					target: dropTarget,
				});
				executeGalleryGridDropPlan(
					plan,
					event,
					setIsDraggingOver,
					handleDrop,
				);
			}}
		>
			{isDraggingOver && (
				<div className="ImageGallery__drop_overlay">
					<Icon name="import" size={48} />
					<p>{lang.t("Release to upload here")}</p>
				</div>
			)}
			{children}
		</div>
	);
}

export interface GalleryDialogSource {
	slug: string;
	name: string;
}

export function ImageGalleryDialogs({
	availableSources,
	controller,
	displayImages,
	isMoveOpen,
	moveTarget,
	navigatePreview,
	previewImage,
	previewNavigation,
	setIsMoveOpen,
	setMoveTarget,
	setPreviewImage,
}: {
	availableSources: GalleryDialogSource[];
	controller: ImageGalleryController;
	displayImages?: readonly GalleryImage[];
	isMoveOpen: boolean;
	moveTarget: ImageLocation;
	navigatePreview?: (direction: GalleryPreviewDirection) => void;
	previewImage: GalleryImage | null;
	previewNavigation?: GalleryPreviewNavigationState;
	setIsMoveOpen: Dispatch<SetStateAction<boolean>>;
	setMoveTarget: Dispatch<SetStateAction<ImageLocation>>;
	setPreviewImage: Dispatch<SetStateAction<GalleryImage | null>>;
}) {
	const navigation = previewNavigation ?? getGalleryPreviewNavigationState({
		currentImage: previewImage,
		images: displayImages ?? [],
	});
	const previewTitle = previewImage
		? navigation.totalCount > 1 && navigation.currentIndex >= 0
			? `${previewImage.displayName || previewImage.name} (${navigation.currentIndex + 1} / ${navigation.totalCount})`
			: (previewImage.displayName || previewImage.name)
		: "";
	return (
		<>
			{isMoveOpen && (
				<Modal
					title={lang.t("Move selected items")}
					onCancel={() => setIsMoveOpen(false)}
					onConfirm={async () => {
						const moved = await controller.handleMoveSelection(moveTarget);
						if (moved) setIsMoveOpen(false);
					}}
					confirmLabel={lang.t("Move")}
				>
					<ImageTargetSettings
						sources={availableSources.map((source) => ({
							id: source.slug,
							label: source.name,
							icon: source.slug === "general" ? "database" : "map",
						}))}
						categories={controller.categories}
						value={{
							source: moveTarget.slug,
							category: moveTarget.category,
							subcategory: moveTarget.subcategory || "",
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
					title={previewTitle}
					onConfirm={() => setPreviewImage(null)}
					type="custom"
					className="ImageGallery__previewModal"
					showFooter={false}
					onCancel={() => setPreviewImage(null)}
				>
					<div
						className="ImageGallery__previewWrap"
						onClick={() => setPreviewImage(null)}
					>
						{navigation.totalCount > 1 && (
							<button
								type="button"
								className="ImageGallery__previewNav is_prev"
								aria-label={lang.t("Previous image")}
								title={lang.t("Previous image")}
								disabled={!navigation.canNavigatePrev}
								onClick={(event) => {
									event.stopPropagation();
									if (navigatePreview) {
										navigatePreview(-1);
									} else if (navigation.prevImage) {
										setPreviewImage(navigation.prevImage);
									}
								}}
							>
								<Icon name="back" size={24} />
							</button>
						)}
						<img
							className="ImageGallery__previewImg"
							src={previewImage.url}
							alt={previewImage.displayName || previewImage.name}
							onClick={(event) => event.stopPropagation()}
						/>
						{navigation.totalCount > 1 && (
							<button
								type="button"
								className="ImageGallery__previewNav is_next"
								aria-label={lang.t("Next image")}
								title={lang.t("Next image")}
								disabled={!navigation.canNavigateNext}
								onClick={(event) => {
									event.stopPropagation();
									if (navigatePreview) {
										navigatePreview(1);
									} else if (navigation.nextImage) {
										setPreviewImage(navigation.nextImage);
									}
								}}
							>
								<Icon name="forward" size={24} />
							</button>
						)}
					</div>
				</Modal>
			)}
		</>
	);
}
