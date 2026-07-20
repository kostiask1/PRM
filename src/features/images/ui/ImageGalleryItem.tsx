import type { Dispatch, SetStateAction } from "react";
import { Icon, Tooltip } from "../../../shared/ui/index.js";
import { classNames, lang } from "../../../shared/lib/index.js";
import { prompt, type useAppDispatch } from "../../../shared/model/index.js";
import type { ImageAsset } from "../api/imageApi.ts";
import type { GalleryDragOverTarget, GalleryImage } from "../model/contracts.ts";
import {
	getGalleryFolderPresentation,
	type GalleryFolderPresentation,
	type GalleryPresentationItem,
} from "../model/imageGalleryPresentation.ts";
import {
	getGalleryFolderDragOverPlan,
	getGalleryFolderDropTarget,
	getGalleryFolderRenameName,
	type GalleryFolderDragOverPlan,
} from "../model/imageGalleryInteraction.ts";
import type useImageGallery from "../model/useImageGallery.ts";

type ImageGalleryController = ReturnType<typeof useImageGallery>;

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

function executeGalleryFolderClick<TEvent>(
	canInteract: boolean,
	event: TEvent,
	onClick: (event: TEvent) => void,
): void {
	if (canInteract) onClick(event);
}

function executeGalleryFolderDragOver(
	event: { preventDefault: () => void },
	plan: GalleryFolderDragOverPlan,
	setDragOverTarget: (target: GalleryDragOverTarget) => void,
): void {
	if (plan.preventDefault) event.preventDefault();
	if (plan.target) setDragOverTarget(plan.target);
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
	const presentation = getGalleryFolderPresentation({
		dragOverTargetId: dragOverTarget?.id,
		hasFiles: Boolean(subDetails[sub]?.hasFiles),
		isBestiaryFolder: isOfficialSub(sub),
		isReadonly: isReadonlySub(sub),
		isSelected: selectedSubs.has(sub),
		selectedSub,
		sub,
	});
	const folderLabel = formatFolderLabel(sub, presentation.isBestiaryFolder);
	const dragOverPlan = getGalleryFolderDragOverPlan({
		currentTargetId: dragOverTarget?.id,
		isReadonly: presentation.isReadonly,
		sub,
	});

	return (
		<div
			className={classNames(
				"ImageGallery__item",
				"ImageGallery__item__folder",
				{
					is_selected: presentation.isSelected,
					is_drag_over: presentation.isDragOver,
					is_protected: presentation.isReadonly,
					is_bestiary: presentation.isBestiaryFolder,
					has_files: presentation.hasFiles,
				},
			)}
			onClick={(event) =>
				executeGalleryFolderClick(presentation.canInteract, event, (clickEvent) =>
					handleItemClick(sub, "sub", itemIndex, clickEvent),
				)
			}
			onDoubleClick={() => {
				resetContentScope();
				setSelectedSub(presentation.subcategory);
			}}
			draggable={presentation.canInteract}
			onDragStart={(event) => handleDragStart(event, sub, "sub")}
			onDragEnd={handleDragEnd}
			onDragOver={(event) =>
				executeGalleryFolderDragOver(
					event,
					dragOverPlan,
					setDragOverTarget,
				)
			}
			onDragLeave={() => setDragOverTarget(null)}
			onDrop={(event) => {
				const target = getGalleryFolderDropTarget({
					slug: selectedSource,
					category: selectedCat.id,
					subcategory: presentation.subcategory,
					isReadonly: isReadonlyPath(presentation.subcategory),
				});
				void handleDrop(event, target);
			}}
		>
			<ImageGalleryFolderVisual
				presentation={presentation}
				sub={sub}
				toggleSelect={toggleSelect}
			/>
			<ImageGalleryFolderName
				dispatch={dispatch}
				folderLabel={folderLabel}
				handleRenameSub={handleRenameSub}
				presentation={presentation}
				sub={sub}
			/>
		</div>
	);
}

function ImageGalleryFolderVisual({
	presentation,
	sub,
	toggleSelect,
}: {
	presentation: GalleryFolderPresentation;
	sub: string;
	toggleSelect: ImageGalleryController["toggleSelect"];
}) {
	return (
		<div className="ImageGallery__image_wrap">
			<Icon name={presentation.folderIcon} size={48} />
			{presentation.hasFiles && (
				<span className="ImageGallery__folder_file_badge" aria-hidden="true">
					<Icon name="file" size={18} />
				</span>
			)}
			{presentation.canInteract && (
				<div
					className="ImageGallery__checkbox"
					onClick={(event) => toggleSelect(sub, "sub", event)}
				>
					<Icon name={presentation.checkboxIcon} size={12} />
				</div>
			)}
		</div>
	);
}

function ImageGalleryFolderName({
	dispatch,
	folderLabel,
	handleRenameSub,
	presentation,
	sub,
}: {
	dispatch: ReturnType<typeof useAppDispatch>;
	folderLabel: string;
	handleRenameSub: ImageGalleryController["handleRenameSub"];
	presentation: GalleryFolderPresentation;
	sub: string;
}) {
	return (
		<Tooltip content={folderLabel} disabled={!presentation.isBestiaryFolder}>
			<span className="ImageGallery__name">
				<button
					type="button"
					className="ImageGallery__nameBtn"
					onClick={async (event) => {
						if (!presentation.canInteract) return;
						event.stopPropagation();
						const result = await dispatch(
							prompt({
								title: lang.t("Rename folder"),
								message: lang.t("Enter a new name:"),
								defaultValue: sub,
							}),
						);
						const newName = getGalleryFolderRenameName(result);
						if (newName) void handleRenameSub(sub, newName);
					}}
				>
					{folderLabel}
				</button>
			</span>
		</Tooltip>
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
