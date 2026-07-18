import { type ChangeEvent, type RefObject, useRef, useState } from "react";

import { formatBytes, lang } from "../../../shared/lib/index.js";
import { alert, useAppDispatch } from "../../../shared/model/index.js";
import { Button, Icon } from "../../../shared/ui/index.js";
import { ImageGallery, type ImageAsset } from "../../images/index.js";
import {
	AI_FILE_ACCEPT,
	AI_IMAGE_ACCEPT,
	getAttachedFileKey,
	getAttachedImageKey,
	getSupportedAiFileMimeType,
	getSupportedAiImageMimeType,
	MAX_AI_ATTACHMENTS,
	MAX_AI_FILE_BYTES,
	MAX_AI_IMAGE_BYTES,
	readFileAsBase64,
} from "../model/aiAttachments.ts";
import {
	getAvailableAiAttachmentSlots,
	mergeUniqueAiAttachments,
	prepareAiAttachmentSelection,
	removeAiAttachmentAt,
	shouldReportAiAttachmentSelectionError,
} from "./presentationModel.ts";
import type { AiAttachmentStateSetter, AiUiAttachment } from "./types.ts";
import "../../../assets/components/AiAttachmentControls.css";

const ignoreAttachmentUpdate: AiAttachmentStateSetter = () => {};

export interface AiAttachmentControlsProps {
	attachedFiles?: AiUiAttachment[];
	attachedImages?: AiUiAttachment[];
	campaignSlug?: string | null;
	disabled?: boolean;
	fileInputRef?: RefObject<HTMLInputElement>;
	setAttachedFiles?: AiAttachmentStateSetter;
	setAttachedImages?: AiAttachmentStateSetter;
}

export default function AiAttachmentControls({
	attachedFiles = [],
	attachedImages = [],
	campaignSlug,
	disabled = false,
	fileInputRef,
	setAttachedFiles = ignoreAttachmentUpdate,
	setAttachedImages = ignoreAttachmentUpdate,
}: AiAttachmentControlsProps) {
	const dispatch = useAppDispatch();
	const internalFileInputRef = useRef<HTMLInputElement>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const resolvedFileInputRef = fileInputRef || internalFileInputRef;

	const addAttachedImage = (image: AiUiAttachment | null | undefined) => {
		if (!image) return;
		setAttachedImages((current) =>
			mergeUniqueAiAttachments(
				current,
				[image],
				getAttachedImageKey,
				MAX_AI_ATTACHMENTS,
			),
		);
	};

	const removeAttachedImage = (indexToRemove: number) => {
		setAttachedImages((current) =>
			removeAiAttachmentAt(current, indexToRemove),
		);
	};

	const handleAttachImages = async (event: ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = Array.from(event.target.files || []);
		event.target.value = "";
		if (selectedFiles.length === 0) return;

		const availableSlots = getAvailableAiAttachmentSlots(
			attachedImages.length,
			MAX_AI_ATTACHMENTS,
		);
		if (availableSlots === 0) return;
		const selection = await prepareAiAttachmentSelection({
			availableSlots,
			files: selectedFiles,
			getMimeType: getSupportedAiImageMimeType,
			includePreview: true,
			maxBytes: MAX_AI_IMAGE_BYTES,
			readBase64: readFileAsBase64,
		});

		if (selection.attachments.length > 0) {
			setAttachedImages((current) =>
				mergeUniqueAiAttachments(
					current,
					selection.attachments,
					getAttachedImageKey,
					MAX_AI_ATTACHMENTS,
				),
			);
		}
		if (
			shouldReportAiAttachmentSelectionError(
				selectedFiles.length,
				availableSlots,
				selection.skippedNames.length,
			)
		) {
			dispatch(
				alert({
					title: lang.t("Image attachment error"),
					message: lang.t(
						"Some images could not be attached. Supported images: JPG, PNG, WEBP, GIF. Maximum size: 10 MB.",
					),
				}),
			);
		}
	};

	const handleAttachFiles = async (event: ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = Array.from(event.target.files || []);
		event.target.value = "";
		if (selectedFiles.length === 0) return;

		const availableSlots = getAvailableAiAttachmentSlots(
			attachedFiles.length,
			MAX_AI_ATTACHMENTS,
		);
		if (availableSlots === 0) return;
		const selection = await prepareAiAttachmentSelection({
			availableSlots,
			files: selectedFiles,
			getMimeType: getSupportedAiFileMimeType,
			includePreview: false,
			maxBytes: MAX_AI_FILE_BYTES,
			readBase64: readFileAsBase64,
		});

		if (selection.attachments.length > 0) {
			setAttachedFiles((current) =>
				mergeUniqueAiAttachments(
					current,
					selection.attachments,
					getAttachedFileKey,
					MAX_AI_ATTACHMENTS,
				),
			);
		}
		if (
			shouldReportAiAttachmentSelectionError(
				selectedFiles.length,
				availableSlots,
				selection.skippedNames.length,
			)
		) {
			dispatch(
				alert({
					title: lang.t("File attachment error"),
					message: lang.t(
						"Some files could not be attached. Supported files: TXT, MD, JSON, CSV, HTML, XML, YAML, PDF. Maximum size: 10 MB.",
					),
				}),
			);
		}
	};

	const removeAttachedFile = (indexToRemove: number) => {
		setAttachedFiles((current) =>
			removeAiAttachmentAt(current, indexToRemove),
		);
	};

	const selectGalleryImage = (image: ImageAsset | null | undefined) => {
		if (image?.url) {
			addAttachedImage({
				name: image.name || String(image.url).split("/").pop() || image.url,
				url: image.url,
				previewUrl: image.url,
			});
		}
		setIsGalleryOpen(false);
	};

	return (
		<div className="AiAttachmentControls">
			<input
				ref={resolvedFileInputRef}
				type="file"
				multiple
				accept={AI_FILE_ACCEPT}
				className="AiAttachmentControls__file_input"
				onChange={handleAttachFiles}
			/>
			<input
				ref={imageInputRef}
				type="file"
				multiple
				accept={AI_IMAGE_ACCEPT}
				className="AiAttachmentControls__file_input"
				onChange={handleAttachImages}
			/>
			<div className="AiAttachmentControls__file_actions">
				{attachedImages.length < MAX_AI_ATTACHMENTS && (
					<>
						<Button
							variant="ghost"
							icon="image"
							onClick={() => imageInputRef.current?.click()}
							disabled={disabled}
							title={lang.t("Attach images")}
						>
							{lang.t("Attach images")}
						</Button>
						<Button
							variant="ghost"
							icon="database"
							onClick={() => setIsGalleryOpen(true)}
							disabled={disabled}
							title={lang.t("From gallery")}
						>
							{lang.t("From gallery")}
						</Button>
					</>
				)}
				<Button
					variant="ghost"
					icon="file-plus"
					onClick={() => resolvedFileInputRef.current?.click()}
					disabled={disabled || attachedFiles.length >= MAX_AI_ATTACHMENTS}
					title={lang.t("Attach files")}
				>
					{lang.t("Attach files")}
				</Button>
			</div>
			{attachedImages.length > 0 && (
				<div className="AiAttachmentControls__list">
					{attachedImages.map((image, index) => (
						<div
							key={`${image.url || image.name}-${index}`}
							className="AiAttachmentControls__item"
						>
							<img
								src={image.previewUrl || image.url}
								alt={image.name || lang.t("Attached image")}
							/>
							<span title={image.name || image.url}>
								{image.name || image.url}
							</span>
							<Button
								variant="danger"
								size={Button.SIZES.SMALL}
								icon="x"
								onClick={() => removeAttachedImage(index)}
								disabled={disabled}
								title={lang.t("Remove image")}
							/>
						</div>
					))}
				</div>
			)}
			{attachedFiles.length > 0 && (
				<div className="AiAttachmentControls__list">
					{attachedFiles.map((file, index) => (
						<div
							key={`${file.name}-${file.sizeBytes}-${index}`}
							className="AiAttachmentControls__item"
						>
							<div className="AiAttachmentControls__file_icon">
								<Icon name="file" size={22} />
							</div>
							<span title={file.name}>
								{file.name}
								{file.sizeBytes ? ` (${formatBytes(file.sizeBytes)})` : ""}
							</span>
							<Button
								variant="danger"
								size={Button.SIZES.SMALL}
								icon="x"
								onClick={() => removeAttachedFile(index)}
								disabled={disabled}
								title={lang.t("Remove file")}
							/>
						</div>
					))}
				</div>
			)}
			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
				onSelect={selectGalleryImage}
				initialSource={campaignSlug || "general"}
				initialCategory="attachments"
				initialSubcategory=""
			/>
		</div>
	);
}
