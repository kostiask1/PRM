import type { ReactNode } from "react";
import { Button, Tooltip } from "../../../shared/ui/index.js";
import { Modal } from "../../modal/index.js";
import { lang } from "../../../shared/lib/index.js";
import type useImageAssetFieldController from "../model/useImageAssetFieldController.ts";
import type { ImageAssetFieldContentState } from "../model/imageAssetField.ts";
import ImageDropzone from "./ImageDropzone";
import ImageGallery from "./ImageGallery";

type ImageAssetFieldController = ReturnType<typeof useImageAssetFieldController>;

interface ImageAssetValidContentProps {
	controller: ImageAssetFieldController;
	imageAlt: string;
	wrapperClassName?: string;
	deleteButtonClassName?: string;
	showClearButton: boolean;
	enableContextReplace: boolean;
}

function ImageAssetValidContent({
	controller,
	imageAlt,
	wrapperClassName,
	deleteButtonClassName,
	showClearButton,
	enableContextReplace,
}: ImageAssetValidContentProps) {
	return (
		<div className={wrapperClassName}>
			<Tooltip
				content={lang.t("Right-click: replace image via gallery")}
				disabled={!enableContextReplace}
			>
				<img
					src={controller.presentation.resolvedImageUrl}
					alt={imageAlt}
					onError={controller.markImageMissing}
					onClick={controller.handleImageClick}
					onContextMenu={controller.handleImageContextMenu}
				/>
			</Tooltip>
			{showClearButton && (
				<Button
					variant="danger"
					size={Button.SIZES.SMALL}
					icon="x"
					className={deleteButtonClassName}
					onClick={controller.clearImage}
				/>
			)}
		</div>
	);
}

function ImageAssetMissingContent({
	controller,
}: {
	controller: ImageAssetFieldController;
}) {
	const imageUrl = controller.presentation.resolvedImageUrl;
	return (
		<div className="ImageAssetField__missing">
			<div className="ImageAssetField__missing_title">
				{lang.t("Image not found")}
			</div>
			<div className="ImageAssetField__missing_url" title={imageUrl}>
				{imageUrl}
			</div>
			<div className="ImageAssetField__missing_actions">
				<Button
					variant="danger"
					size={Button.SIZES.SMALL}
					icon="x"
					onClick={controller.clearImage}
				>
					{lang.t("Clear image")}
				</Button>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="image"
					onClick={controller.chooseImage}
				>
					{lang.t("Choose image")}
				</Button>
			</div>
		</div>
	);
}

interface ImageAssetEmptyContentProps {
	controller: ImageAssetFieldController;
	campaignSlug?: string | null;
}

function ImageAssetEmptyContent({
	controller,
	campaignSlug,
}: ImageAssetEmptyContentProps) {
	return (
		<ImageDropzone
			campaignSlug={campaignSlug}
			initialSource={controller.location.source}
			initialCategory={controller.location.category}
			initialSubcategory={controller.location.subcategory}
			onUploadSuccess={controller.acceptUploadedImage}
		/>
	);
}

interface ImageAssetFieldContentProps extends ImageAssetValidContentProps {
	campaignSlug?: string | null;
}

function ImageAssetFieldContent(props: ImageAssetFieldContentProps) {
	const contents: Record<ImageAssetFieldContentState, ReactNode> = {
		valid: <ImageAssetValidContent {...props} />,
		missing: <ImageAssetMissingContent controller={props.controller} />,
		empty: (
			<ImageAssetEmptyContent
				controller={props.controller}
				campaignSlug={props.campaignSlug}
			/>
		),
	};
	return contents[props.controller.presentation.contentState];
}

interface ImageAssetPreviewProps {
	controller: ImageAssetFieldController;
	imageAlt: string;
	previewTitle: string;
	previewModalClassName?: string;
	previewContentClassName?: string;
}

function ImageAssetPreview({
	controller,
	imageAlt,
	previewTitle,
	previewModalClassName,
	previewContentClassName,
}: ImageAssetPreviewProps) {
	if (!controller.presentation.showPreview) return null;
	return (
		<Modal
			title={previewTitle}
			type="custom"
			className={previewModalClassName}
			onConfirm={controller.closePreview}
			onCancel={controller.closePreview}
			showFooter={false}
		>
			<div
				className={previewContentClassName}
				onClick={controller.closePreview}
			>
				<img
					src={controller.presentation.resolvedImageUrl}
					alt={imageAlt}
				/>
			</div>
		</Modal>
	);
}

function ImageAssetGalleryDialog({
	controller,
}: {
	controller: ImageAssetFieldController;
}) {
	return (
		<ImageGallery
			isOpen={controller.isGalleryOpen}
			onClose={controller.closeGallery}
			onSelect={controller.selectGalleryImage}
			initialSource={controller.location.source}
			initialCategory={controller.location.category}
			initialSubcategory={controller.location.subcategory}
		/>
	);
}

export interface ImageAssetFieldViewProps {
	controller: ImageAssetFieldController;
	campaignSlug?: string | null;
	showClearButton: boolean;
	enableContextReplace: boolean;
	imageAlt: string;
	containerClassName?: string;
	wrapperClassName?: string;
	deleteButtonClassName?: string;
	previewTitle: string;
	previewModalClassName?: string;
	previewContentClassName?: string;
}

export default function ImageAssetFieldView({
	controller,
	campaignSlug,
	showClearButton,
	enableContextReplace,
	imageAlt,
	containerClassName,
	wrapperClassName,
	deleteButtonClassName,
	previewTitle,
	previewModalClassName,
	previewContentClassName,
}: ImageAssetFieldViewProps) {
	return (
		<>
			<div className={containerClassName}>
				<ImageAssetFieldContent
					controller={controller}
					campaignSlug={campaignSlug}
					imageAlt={imageAlt}
					wrapperClassName={wrapperClassName}
					deleteButtonClassName={deleteButtonClassName}
					showClearButton={showClearButton}
					enableContextReplace={enableContextReplace}
				/>
			</div>
			<ImageAssetPreview
				controller={controller}
				imageAlt={imageAlt}
				previewTitle={previewTitle}
				previewModalClassName={previewModalClassName}
				previewContentClassName={previewContentClassName}
			/>
			<ImageAssetGalleryDialog controller={controller} />
		</>
	);
}
