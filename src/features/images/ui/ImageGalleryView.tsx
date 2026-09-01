import React from "react";
import ReactList from "react-list";

import { getSourceFullName } from "../../../entities/reference/index.js";
import { classNames, formatBytes, lang } from "../../../shared/lib/index.js";
import { Icon, Modal, type IconName } from "../../../shared/ui/index.js";
import type { ImageAsset } from "../api/imageApi.ts";
import type { GalleryPresentationItem } from "../model/imageGalleryPresentation.ts";
import { useImageGalleryRuntime } from "../model/ImageGalleryRuntime.tsx";
import ImageGalleryItem from "./ImageGalleryItem.tsx";
import {
	ImageGalleryDialogs,
	ImageGalleryGrid,
	ImageGalleryNavigation,
	ImageGallerySearch,
	ImageGalleryStatsAndActions,
} from "./ImageGallerySections.tsx";
import type { ImageGalleryUiController } from "./useImageGalleryUiController.ts";

const SUB_LABELS: Readonly<Record<string, string>> = {
	npc: "NPC",
	players: "Players",
};

function getImageGalleryModalTitle(isSelectionMode: boolean): string {
	return lang.t(isSelectionMode ? "Choose an image" : "Image gallery");
}

function formatBestiaryFolderLabel(
	value: string,
	isBestiaryPath: boolean,
): string {
	const label = lang.t(SUB_LABELS[value] || value);
	return isBestiaryPath ? getSourceFullName(label) : label;
}

function formatImageLocationLabel(label: string): string {
	return String(label || "")
		.split("/")
		.map((part) => getSourceFullName(part))
		.join("/");
}

function ImageGallerySidebar({
	controller,
}: {
	controller: ImageGalleryUiController;
}) {
	const {
		galleryController,
		resetContentScope,
		sourceSizes,
	} = controller;
	const {
		campaigns,
		dragOverTarget,
		handleDrop,
		isReadonlyPath,
		selectedCat,
		selectedSource,
		selectedSub,
		setDragOverTarget,
		setSelectedSource,
	} = galleryController;
	return (
		<aside className="ImageGallery__sidebar">
			<button
				className={classNames("ImageGallery__sourceButton", {
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
				<span className="ImageGallery__sourceButton__size">
					{formatBytes(sourceSizes.general ?? 0)}
				</span>
			</button>
			<div className="ImageGallery__sidebar_divider">{lang.t("Campaigns")}</div>
			{campaigns.map((campaign) => (
				<button
					key={campaign.slug}
					className={classNames("ImageGallery__sourceButton", {
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
					<span className="ImageGallery__sourceButton__size">
						{formatBytes(sourceSizes[campaign.slug] ?? 0)}
					</span>
				</button>
			))}
		</aside>
	);
}

function ImageGalleryTabs({ controller }: { controller: ImageGalleryUiController }) {
	const { galleryController, resetContentScope } = controller;
	const {
		categories,
		dragOverTarget,
		handleDrop,
		selectedCat,
		selectedSource,
		setDragOverTarget,
		setSelectedCat,
		setSelectedSub,
	} = galleryController;
	return (
		<header className="ImageGallery__tabs">
			{categories.map((category) => (
				<button
					key={category.id}
					className={classNames("ImageGallery__tabButton", {
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
	);
}

function ImageGalleryToolbar({
	controller,
}: {
	controller: ImageGalleryUiController;
}) {
	return (
		<div className="ImageGallery__toolbar">
			<ImageGalleryNavigation
				canNavigateBack={controller.canNavigateBack}
				canNavigateForward={controller.canNavigateForward}
				controller={controller.galleryController}
				formatFolderLabel={formatBestiaryFolderLabel}
				navigateHistory={controller.navigateHistory}
				resetContentScope={controller.resetContentScope}
			/>
			<ImageGallerySearch
				canShowDatabaseTokens={controller.canShowDatabaseTokens}
				controller={controller.galleryController}
			/>
			<ImageGalleryStatsAndActions
				controller={controller.galleryController}
				onOpenMove={controller.openMoveModal}
			/>
		</div>
	);
}

function ImageGalleryItems({
	controller,
	onSelect,
}: {
	controller: ImageGalleryUiController;
	onSelect?: (image: ImageAsset | null | undefined) => void;
}) {
	const { requestPrompt } = useImageGalleryRuntime();
	const {
		galleryColumns,
		galleryController,
		galleryItems,
		galleryListRef,
		galleryRowCount,
		galleryViewportRef,
		highlightedImageName,
		openGlobalResultPath,
		resetContentScope,
		setPreviewImage,
	} = controller;
	const renderGalleryItem = (
		item: GalleryPresentationItem,
		itemIndex: number,
	) => (
		<ImageGalleryItem
			controller={galleryController}
			formatFolderLabel={formatBestiaryFolderLabel}
			formatLocationLabel={formatImageLocationLabel}
			highlightedImageName={highlightedImageName}
			item={item}
			itemIndex={itemIndex}
			onOpenGlobalResult={openGlobalResultPath}
			onSelect={onSelect}
			requestPrompt={requestPrompt}
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
	return (
		<ImageGalleryGrid
			controller={galleryController}
			viewportRef={galleryViewportRef}
		>
			{galleryRowCount > 0 && (
				<ReactList
					ref={galleryListRef}
					itemRenderer={renderGalleryRow}
					length={galleryRowCount}
					threshold={400}
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
	);
}

function ImageGalleryLayout({
	controller,
	onSelect,
}: {
	controller: ImageGalleryUiController;
	onSelect?: (image: ImageAsset | null | undefined) => void;
}) {
	return (
		<div className="ImageGallery">
			<ImageGallerySidebar controller={controller} />
			<main className="ImageGallery__main">
				<ImageGalleryTabs controller={controller} />
				<ImageGalleryToolbar controller={controller} />
				<ImageGalleryItems controller={controller} onSelect={onSelect} />
			</main>
		</div>
	);
}

export function ImageGalleryView({
	controller,
	onClose,
	onSelect,
}: {
	controller: ImageGalleryUiController;
	onClose: () => void;
	onSelect?: (image: ImageAsset | null | undefined) => void;
}) {
	return (
		<Modal
			title={getImageGalleryModalTitle(typeof onSelect === "function")}
			onConfirm={onClose}
			onCancel={onClose}
			showFooter={false}
			type="custom"
		>
			<ImageGalleryLayout controller={controller} onSelect={onSelect} />
			<ImageGalleryDialogs
				availableSources={controller.availableSources}
				controller={controller.galleryController}
				isMoveOpen={controller.isMoveModalOpen}
				moveTarget={controller.moveTarget}
				previewImage={controller.previewImage}
				setIsMoveOpen={controller.setIsMoveModalOpen}
				setMoveTarget={controller.setMoveTarget}
				setPreviewImage={controller.setPreviewImage}
			/>
		</Modal>
	);
}
