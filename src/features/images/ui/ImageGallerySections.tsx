import {
	Fragment,
	type Dispatch,
	type DragEvent,
	type ReactNode,
	type RefObject,
	type SetStateAction,
} from "react";
import { Button, Icon, Modal, Tooltip } from "../../../shared/ui/index.js";
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
	type GalleryGridDragOverPlan,
	type GalleryGridDropPlan,
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
		dragOverTarget,
		handleCreateSub,
		handleDrop,
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
							dragOverTarget.id === "__root__",
					})}
					onClick={() => {
						resetContentScope();
						setSelectedSub("");
					}}
					onDragOver={(event) => {
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
							<Icon name="chevron" size={10} className="BreadcrumbSeparator" />
							<Tooltip content={breadcrumbLabel} disabled={!isBestiaryBreadcrumb}>
								<button
									className={classNames("BreadcrumbItem", {
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
				<Icon name="chevron" size={10} className="BreadcrumbSeparator" />
				{!isReadonlyCurrentFolder && (
					<div className="ImageGallery__new_sub">
						{isCreatingSub ? (
							<>
								<input
									autoFocus
									value={newSubName}
									onChange={(event) => setNewSubName(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") void handleCreateSub();
									}}
									placeholder={lang.t("Folder name...")}
								/>
								<Button size={Button.SIZES.SMALL} icon="check" onClick={handleCreateSub} />
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
			className="DetailedSearchButton ImageGallery__globalSearchBtn ImageGallery__scopeBtn"
			variant={control.isActive ? "primary" : "ghost"}
			size={Button.SIZES.SMALL}
			icon={control.icon}
			onClick={() => setContentScope(control.nextScope)}
			title={lang.t(control.titleKey)}
		/>
	);
}

export function ImageGallerySearch({
	canShowDatabaseTokens,
	controller,
}: {
	canShowDatabaseTokens: boolean;
	controller: ImageGalleryController;
}) {
	const {
		contentScope,
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
	return (
		<div className="ImageGallery__search">
			<ImageGallerySearchInput
				presentation={presentation}
				searchQuery={searchQuery}
				setSearchQuery={setSearchQuery}
			/>
			{presentation.scopeControls.map((control) => (
				<ImageGalleryScopeButton
					key={control.scope}
					control={control}
					setContentScope={setContentScope}
				/>
			))}
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
				{lang.t("Move")} ({presentation.selectionCount})
			</Button>
			<Button
				className="ImageGallery__deleteBtn"
				variant="danger"
				size={Button.SIZES.SMALL}
				icon="trash"
				onClick={onDelete}
			>
				{lang.t("Delete")} ({presentation.selectionCount})
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
	if (!presentation.showUpload) return null;
	return (
		<label className="UploadBtn">
			<Icon name="plus" size={14} />
			<span>{lang.t("Upload")}</span>
			<input
				type="file"
				multiple
				accept="image/*"
				hidden
				onChange={(event) => {
					if (event.target.files) onUpload(event.target.files);
				}}
			/>
		</label>
	);
}

export function ImageGalleryStatsAndActions({
	controller,
	onOpenMove,
}: {
	controller: ImageGalleryController;
	onOpenMove: () => void;
}) {
	const {
		handleBulkDelete,
		handleFileUpload,
		hasSelection,
		isReadonlyCurrentFolder,
		selectedFilenames,
		selectedSubs,
		storageStats,
	} = controller;
	const presentation = getGalleryStatsAndActionsPresentation({
		hasSelection,
		isReadonlyCurrentFolder,
		selectedFilenameCount: selectedFilenames.size,
		selectedSubfolderCount: selectedSubs.size,
		storageStats,
	});
	return (
		<>
			<ImageGalleryStorageStats presentation={presentation} />
			<div className="ImageGallery__upload_actions">
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
	isMoveOpen,
	moveTarget,
	previewImage,
	setIsMoveOpen,
	setMoveTarget,
	setPreviewImage,
}: {
	availableSources: GalleryDialogSource[];
	controller: ImageGalleryController;
	isMoveOpen: boolean;
	moveTarget: ImageLocation;
	previewImage: GalleryImage | null;
	setIsMoveOpen: Dispatch<SetStateAction<boolean>>;
	setMoveTarget: Dispatch<SetStateAction<ImageLocation>>;
	setPreviewImage: Dispatch<SetStateAction<GalleryImage | null>>;
}) {
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
					title={previewImage.name}
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
						<img
							className="ImageGallery__previewImg"
							src={previewImage.url}
							alt={previewImage.name}
						/>
					</div>
				</Modal>
			)}
		</>
	);
}
