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
		categories,
		dragSource,
		dragOverTarget,
		handleDrop,
		selectedSource,
		setDragOverTarget,
		setSelectedSource,
	} = galleryController;
	const dropCategory = categories.find((category) => category.id === dragSource?.category);
	const dropHint = dragSource ? lang.t("Drop in {category}", { category: dropCategory ? lang.t(dropCategory.label) : dragSource.category }) : "";
	return (
		<aside className="ImageGallery__sidebar">
			<button
				type="button"
				aria-pressed={selectedSource === "general"}
				className={classNames("ImageGallery__sourceButton", {
					is_active: selectedSource === "general",
					is_drag_over: dragOverTarget?.type === "source" && dragOverTarget.id === "general",
				})}
				onClick={() => {
					resetContentScope();
					setSelectedSource("general");
				}}
				onDragOver={(event) => {
					if (!dragSource || dragSource.slug === "general") return;
					event.preventDefault();
					if (dragOverTarget?.type !== "source" || dragOverTarget.id !== "general") {
						setDragOverTarget({ type: "source", id: "general" });
					}
				}}
				onDragLeave={() => setDragOverTarget(null)}
				onDrop={(event) => {
					if (!dragSource || dragSource.slug === "general") { event.preventDefault(); event.stopPropagation(); return; }
					void handleDrop(event, {
						slug: "general",
						category: dragSource.category,
						subcategory: "",
						readonly: false,
					});
				}}
			>
				<Icon name="database" size={16} />
				<span>{lang.t("General")}</span>
				<span className="ImageGallery__sourceButton__size">
					{dragOverTarget?.type === "source" && dragOverTarget.id === "general" ? dropHint : formatBytes(sourceSizes.general ?? 0)}
				</span>
			</button>
			<div className="ImageGallery__sidebar_divider">{lang.t("Campaigns")}</div>
			{campaigns.map((campaign) => (
				<button
					key={campaign.slug}
					type="button"
					aria-pressed={selectedSource === campaign.slug}
					className={classNames("ImageGallery__sourceButton", {
						is_active: selectedSource === campaign.slug,
						is_drag_over: dragOverTarget?.type === "source" && dragOverTarget.id === campaign.slug,
					})}
					onClick={() => {
						resetContentScope();
						setSelectedSource(campaign.slug);
					}}
					onDragOver={(event) => {
						if (!dragSource || dragSource.slug === campaign.slug) return;
						event.preventDefault();
						if (dragOverTarget?.type !== "source" || dragOverTarget.id !== campaign.slug) {
							setDragOverTarget({ type: "source", id: campaign.slug });
						}
					}}
					onDragLeave={() => setDragOverTarget(null)}
					onDrop={(event) => {
						if (!dragSource || dragSource.slug === campaign.slug) { event.preventDefault(); event.stopPropagation(); return; }
						void handleDrop(event, {
							slug: campaign.slug,
							category: dragSource.category,
							subcategory: "",
							readonly: false,
						});
					}}
				>
					<Icon name="map" size={16} />
					<span>{campaign.name}</span>
					<span className="ImageGallery__sourceButton__size">
						{dragOverTarget?.type === "source" && dragOverTarget.id === campaign.slug ? dropHint : formatBytes(sourceSizes[campaign.slug] ?? 0)}
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
		dragSource,
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
					type="button"
					aria-pressed={selectedCat.id === category.id}
					className={classNames("ImageGallery__tabButton", {
						is_active: selectedCat.id === category.id,
						is_drag_over: dragOverTarget?.type === "cat" && dragOverTarget.id === category.id,
					})}
					onClick={() => {
						resetContentScope();
						setSelectedCat(category);
						setSelectedSub("");
					}}
					onDragOver={(event) => {
						if (!dragSource || (dragSource.slug === selectedSource && dragSource.category === category.id && !dragSource.subcategory)) return;
						event.preventDefault();
						if (dragOverTarget?.type !== "cat" || dragOverTarget.id !== category.id) {
							setDragOverTarget({ type: "cat", id: category.id });
						}
					}}
					onDragLeave={() => setDragOverTarget(null)}
					onDrop={(event) => {
						if (!dragSource || (dragSource.slug === selectedSource && dragSource.category === category.id && !dragSource.subcategory)) { event.preventDefault(); event.stopPropagation(); return; }
						void handleDrop(event, {
							slug: selectedSource,
							category: category.id,
							subcategory: "",
							readonly: false,
						});
					}}
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
	const { galleryController } = controller;
	const destination = galleryController.moveFeedback;
	const destinationSource = destination?.slug === "general"
		? lang.t("General")
		: galleryController.campaigns.find((campaign) => campaign.slug === destination?.slug)?.name || destination?.slug;
	const destinationCategory = galleryController.categories.find((category) => category.id === destination?.category);
	const destinationLabel = destination
		? [destinationSource, destinationCategory ? lang.t(destinationCategory.label) : destination.category, destination.subcategory].filter(Boolean).join(" / ")
		: "";
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
			{destination && <div className="ImageGallery__moveFeedback" role="status">{lang.t("Items moved to {destination}.", { destination: destinationLabel })}</div>}
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
