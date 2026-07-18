import type { Dispatch, SetStateAction } from "react";
import { Icon, Tooltip, type IconName } from "../../../shared/ui/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";
import { prompt, type useAppDispatch } from "../../../shared/model/index.js";
import type { ImageAsset } from "../api/imageApi.ts";
import type { GalleryImage } from "../model/contracts.ts";
import type { GalleryPresentationItem } from "../model/imageGalleryPresentation.ts";
import type useImageGallery from "../model/useImageGallery.ts";

type ImageGalleryController = ReturnType<typeof useImageGallery>;

const SUB_ICON_NAMES: Readonly<Record<string, IconName>> = {
	npc: "folder-npc",
	players: "folder-players",
};

interface ImageGalleryItemProps {
	controller: ImageGalleryController;
	dispatch: ReturnType<typeof useAppDispatch>;
	formatFolderLabel: (value: string, isBestiaryPath: boolean) => string;
	formatLocationLabel: (label: string) => string;
	highlightedImageName: string;
	item: GalleryPresentationItem;
	itemIndex: number;
	onOpenGlobalResult: (image: GalleryImage) => boolean;
	onSelect?: (image: ImageAsset | null | undefined) => void;
	resetContentScope: () => void;
	setPreviewImage: Dispatch<SetStateAction<GalleryImage | null>>;
}

export default function ImageGalleryItem(props: ImageGalleryItemProps) {
	return props.item.type === "sub" ? (
		<ImageGalleryFolderItem {...props} item={props.item} />
	) : (
		<ImageGalleryImageItem {...props} item={props.item} />
	);
}

function ImageGalleryFolderItem({
	controller,
	dispatch,
	formatFolderLabel,
	item,
	itemIndex,
	resetContentScope,
}: ImageGalleryItemProps & {
	item: Extract<GalleryPresentationItem, { type: "sub" }>;
}) {
	const {
		dragOverTarget,
		handleDragEnd,
		handleDragStart,
		handleDrop,
		handleItemClick,
		handleRenameSub,
		isOfficialSub,
		isReadonlyPath,
		isReadonlySub,
		selectedCat,
		selectedSource,
		selectedSub,
		selectedSubs,
		setDragOverTarget,
		setSelectedSub,
		subDetails,
		toggleSelect,
	} = controller;
	const { sub } = item;
	const isReadonly = isReadonlySub(sub);
	const isBestiaryFolder = isOfficialSub(sub);
	const hasFiles = Boolean(subDetails[sub]?.hasFiles);
	const folderLabel = formatFolderLabel(sub, isBestiaryFolder);
	const folderIcon: IconName = isBestiaryFolder
		? "folder-bestiary"
		: SUB_ICON_NAMES[sub] || "folder";

	return (
		<div
			className={classNames(
				"ImageGallery__item",
				"ImageGallery__item__folder",
				{
					is_selected: selectedSubs.has(sub),
					is_drag_over: dragOverTarget?.id === sub,
					is_protected: isReadonly,
					is_bestiary: isBestiaryFolder,
					has_files: hasFiles,
				},
			)}
			onClick={(event) => {
				if (!isReadonly) handleItemClick(sub, "sub", itemIndex, event);
			}}
			onDoubleClick={() => {
				resetContentScope();
				setSelectedSub(selectedSub ? `${selectedSub}/${sub}` : sub);
			}}
			draggable={!isReadonly}
			onDragStart={(event) => handleDragStart(event, sub, "sub")}
			onDragEnd={handleDragEnd}
			onDragOver={(event) => {
				if (isReadonly) return;
				event.preventDefault();
				if (dragOverTarget?.id !== sub) {
					setDragOverTarget({ type: "sub", id: sub });
				}
			}}
			onDragLeave={() => setDragOverTarget(null)}
			onDrop={(event) => {
				const subcategory = selectedSub ? `${selectedSub}/${sub}` : sub;
				void handleDrop(event, {
					slug: selectedSource,
					category: selectedCat.id,
					subcategory,
					readonly: isReadonlyPath(subcategory),
				});
			}}
		>
			<div className="ImageGallery__image_wrap">
				<Icon name={folderIcon} size={48} />
				{hasFiles && (
					<span className="ImageGallery__folder_file_badge" aria-hidden="true">
						<Icon name="file" size={18} />
					</span>
				)}
				{!isReadonly && (
					<div
						className="ImageGallery__checkbox"
						onClick={(event) => toggleSelect(sub, "sub", event)}
					>
						<Icon name={selectedSubs.has(sub) ? "check" : "plus"} size={12} />
					</div>
				)}
			</div>
			<Tooltip content={folderLabel} disabled={!isBestiaryFolder}>
				<span className="ImageGallery__name">
					<button
						type="button"
						className="ImageGallery__nameBtn"
						onClick={async (event) => {
							if (isReadonly) return;
							event.stopPropagation();
							const newName = await dispatch(
								prompt({
									title: lang.t("Rename folder"),
									message: lang.t("Enter a new name:"),
									defaultValue: sub,
								}),
							);
							if (typeof newName === "string" && newName) {
								void handleRenameSub(sub, newName);
							}
						}}
					>
						{folderLabel}
					</button>
				</span>
			</Tooltip>
		</div>
	);
}

function ImageGalleryImageItem({
	controller,
	dispatch,
	formatLocationLabel,
	highlightedImageName,
	item,
	itemIndex,
	onOpenGlobalResult,
	onSelect,
	setPreviewImage,
}: ImageGalleryItemProps & {
	item: Extract<GalleryPresentationItem, { type: "image" }>;
}) {
	const {
		getCleanName,
		handleDragEnd,
		handleDragStart,
		handleItemClick,
		handleRenameImage,
		isReadonlyImage,
		isSearchResults,
		selectedFilenames,
		toggleSelect,
	} = controller;
	const { image } = item;
	const imageReadonly = isReadonlyImage(image);

	return (
		<Tooltip content={lang.t("Right-click: open fullscreen")}>
			<div
				data-gallery-image-id={encodeURIComponent(image.name)}
				className={classNames("ImageGallery__item", {
					is_selected: selectedFilenames.has(image.name),
					is_navigated: highlightedImageName === image.name,
					is_protected: imageReadonly,
				})}
				onClick={(event) => {
					event.stopPropagation();
					handleItemClick(image.name, "image", itemIndex, event);
				}}
				onDoubleClick={() => onSelect?.(image)}
				onContextMenu={(event) => {
					event.preventDefault();
					setPreviewImage(image);
				}}
				draggable={!imageReadonly && !image.globalSearch}
				onDragStart={(event) => {
					if (image.globalSearch) {
						event.preventDefault();
						return;
					}
					handleDragStart(event, image, "image");
				}}
				onDragEnd={handleDragEnd}
			>
				<div className="ImageGallery__image_wrap">
					<img src={image.url} alt="" loading="lazy" decoding="async" draggable={false} />
					{!imageReadonly && (
						<div
							className="ImageGallery__checkbox"
							onClick={(event) => toggleSelect(image.name, "image", event)}
						>
							<Icon
								name={selectedFilenames.has(image.name) ? "check" : "plus"}
								size={12}
							/>
						</div>
					)}
				</div>
				<Tooltip content={image.displayName || image.name}>
					<span className="ImageGallery__name">
						<button
							type="button"
							className="ImageGallery__nameBtn"
							onClick={async (event) => {
								if (imageReadonly) return;
								event.stopPropagation();
								const currentClean = getCleanName(image.name);
								const newBaseName = await dispatch(
									prompt({
										title: lang.t("Rename file"),
										message: lang.t("Enter a new name:"),
										defaultValue: currentClean,
									}),
								);
								if (
									typeof newBaseName === "string" &&
									newBaseName &&
									newBaseName !== currentClean
								) {
									const extension = image.name.split(".").pop();
									void handleRenameImage(
										image.name,
										`${newBaseName}.${extension}`,
									);
								}
							}}
						>
							{getCleanName(image.displayName || image.name)}
						</button>
					</span>
				</Tooltip>
				<ImageGalleryImageLocation
					formatLocationLabel={formatLocationLabel}
					image={image}
					isSearchResults={isSearchResults}
					onOpenGlobalResult={onOpenGlobalResult}
				/>
			</div>
		</Tooltip>
	);
}

function ImageGalleryImageLocation({
	formatLocationLabel,
	image,
	isSearchResults,
	onOpenGlobalResult,
}: {
	formatLocationLabel: (label: string) => string;
	image: GalleryImage;
	isSearchResults: boolean;
	onOpenGlobalResult: (image: GalleryImage) => boolean;
}) {
	if (!isSearchResults || !image.locationLabel) return null;
	const label = formatLocationLabel(image.locationLabel);
	return (
		<Tooltip content={label}>
			<button
				type="button"
				className="ImageGallery__location"
				onClick={(event) => {
					event.stopPropagation();
					onOpenGlobalResult(image);
				}}
			>
				{label}
			</button>
		</Tooltip>
	);
}
