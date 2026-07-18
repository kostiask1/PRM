import { Fragment, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import { Button, Icon, Tooltip } from "../../../shared/ui/index.js";
import { classNames, formatBytes, lang } from "../../../shared/lib/index.js";
import { Modal } from "../../modal/index.js";
import type { ImageLocation } from "../api/imageApi.ts";
import { imageApi as api } from "../api/imageApi.ts";
import type { GalleryHistoryDirection } from "../model/imageGalleryPresentation.ts";
import type { GalleryImage } from "../model/contracts.ts";
import type useImageGallery from "../model/useImageGallery.ts";
import ImageTargetSettings from "./ImageTargetSettings.tsx";

type ImageGalleryController = ReturnType<typeof useImageGallery>;

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
	return (
		<div className="ImageGallery__search">
			<Icon name="search" size={14} />
			<input
				type="text"
				value={searchQuery}
				onChange={(event) => setSearchQuery(event.target.value)}
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
				className="DetailedSearchButton ImageGallery__globalSearchBtn ImageGallery__scopeBtn"
				variant={contentScope === "source" ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				icon="map"
				onClick={() =>
					setContentScope((scope) =>
						scope === "source" ? "local" : "source",
					)
				}
				title={lang.t(
					selectedSource === "general"
						? "Show all general content"
						: "Show all campaign content",
				)}
			/>
			{canShowDatabaseTokens && (
				<Button
					className="DetailedSearchButton ImageGallery__globalSearchBtn ImageGallery__scopeBtn"
					variant={contentScope === "databaseTokens" ? "primary" : "ghost"}
					size={Button.SIZES.SMALL}
					icon="book"
					onClick={() =>
						setContentScope((scope) =>
							scope === "databaseTokens" ? "local" : "databaseTokens",
						)
					}
					title={lang.t("Show all database tokens")}
				/>
			)}
			<Button
				className="DetailedSearchButton ImageGallery__globalSearchBtn ImageGallery__scopeBtn"
				variant={contentScope === "all" ? "primary" : "ghost"}
				size={Button.SIZES.SMALL}
				icon="layers"
				onClick={() =>
					setContentScope((scope) => (scope === "all" ? "local" : "all"))
				}
				title={lang.t("Show all gallery content")}
			/>
		</div>
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
	const selectionCount = selectedFilenames.size + selectedSubs.size;
	return (
		<>
			<div className="ImageGallery__storage_stats">
				<span>
					{lang.t("Total gallery size")}: {" "}
					<strong>{formatBytes(storageStats?.totalBytes ?? 0)}</strong>
				</span>
				<span>
					{lang.t("Tab size")}: {" "}
					<strong>{formatBytes(storageStats?.categoryBytes ?? 0)}</strong>
				</span>
			</div>
			<div className="ImageGallery__upload_actions">
				{hasSelection && (
					<>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="export"
							onClick={onOpenMove}
						>
							{lang.t("Move")} ({selectionCount})
						</Button>
						<Button
							className="ImageGallery__deleteBtn"
							variant="danger"
							size={Button.SIZES.SMALL}
							icon="trash"
							onClick={handleBulkDelete}
						>
							{lang.t("Delete")} ({selectionCount})
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
							onChange={(event) => {
								if (event.target.files) void handleFileUpload(event.target.files);
							}}
						/>
					</label>
				)}
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
	return (
		<div
			ref={viewportRef}
			className={classNames("ImageGallery__grid", {
				is_dragging: isDraggingOver,
			})}
			onDragOver={(event) => {
				event.preventDefault();
				if (isSearchResults) {
					setIsDraggingOver(false);
					return;
				}
				const isSameLocation =
					dragSource?.slug === selectedSource &&
					dragSource.category === selectedCat.id &&
					dragSource.subcategory === selectedSub;
				if (!isSameLocation && !isReadonlyCurrentFolder) setIsDraggingOver(true);
			}}
			onDragLeave={() => setIsDraggingOver(false)}
			onDrop={(event) => {
				if (isSearchResults) {
					event.preventDefault();
					setIsDraggingOver(false);
					return;
				}
				void handleDrop(event, {
					slug: selectedSource,
					category: selectedCat.id,
					subcategory: selectedSub,
					readonly: isReadonlyCurrentFolder,
				});
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
