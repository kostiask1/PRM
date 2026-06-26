import { useRef, useState } from "react";
import { alert } from "../../actions/app";
import { useAppDispatch } from "../../store/appStore";
import { lang } from "../../services/localization";
import { formatBytes } from "../../utils/formatBytes";
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
} from "../../utils/aiAttachments";
import Button from "../form/Button";
import Icon from "../common/Icon";
import ImageGallery from "../ImageGallery";
import "../../assets/components/AiAttachmentControls.css";

export default function AiAttachmentControls({
	attachedFiles = [],
	attachedImages = [],
	campaignSlug,
	disabled = false,
	fileInputRef,
	setAttachedFiles = () => {},
	setAttachedImages = () => {},
}) {
	const dispatch = useAppDispatch();
	const internalFileInputRef = useRef(null);
	const imageInputRef = useRef(null);
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const resolvedFileInputRef = fileInputRef || internalFileInputRef;

	const addAttachedImage = (image) => {
		if (!image) return;
		setAttachedImages((prev) => {
			const key = getAttachedImageKey(image);
			if (prev.some((item) => getAttachedImageKey(item) === key)) return prev;
			return [...prev, image].slice(0, MAX_AI_ATTACHMENTS);
		});
	};

	const removeAttachedImage = (indexToRemove) => {
		setAttachedImages((prev) =>
			prev.filter((_, index) => index !== indexToRemove),
		);
	};

	const handleAttachImages = async (event) => {
		const selectedFiles = Array.from(event.target.files || []);
		event.target.value = "";
		if (selectedFiles.length === 0) return;

		const availableSlots = Math.max(
			0,
			MAX_AI_ATTACHMENTS - attachedImages.length,
		);
		if (availableSlots === 0) return;

		const nextImages = [];
		const skipped = [];
		for (const file of selectedFiles.slice(0, availableSlots)) {
			const mimeType = getSupportedAiImageMimeType(file);
			if (!mimeType || file.size > MAX_AI_IMAGE_BYTES) {
				skipped.push(file.name);
				continue;
			}
			try {
				const data = await readFileAsBase64(file);
				nextImages.push({
					name: file.name,
					mimeType,
					sizeBytes: file.size,
					data,
					previewUrl: `data:${mimeType};base64,${data}`,
				});
			} catch {
				skipped.push(file.name);
			}
		}

		if (nextImages.length > 0) {
			setAttachedImages((prev) => {
				const existing = new Set(prev.map(getAttachedImageKey));
				const uniqueNext = nextImages.filter((image) => {
					const key = getAttachedImageKey(image);
					if (existing.has(key)) return false;
					existing.add(key);
					return true;
				});
				return [...prev, ...uniqueNext].slice(0, MAX_AI_ATTACHMENTS);
			});
		}
		if (skipped.length > 0 || selectedFiles.length > availableSlots) {
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

	const handleAttachFiles = async (event) => {
		const selectedFiles = Array.from(event.target.files || []);
		event.target.value = "";
		if (selectedFiles.length === 0) return;

		const availableSlots = Math.max(
			0,
			MAX_AI_ATTACHMENTS - attachedFiles.length,
		);
		if (availableSlots === 0) return;

		const nextFiles = [];
		const skipped = [];
		for (const file of selectedFiles.slice(0, availableSlots)) {
			const mimeType = getSupportedAiFileMimeType(file);
			if (!mimeType) {
				skipped.push(file.name);
				continue;
			}
			if (file.size > MAX_AI_FILE_BYTES) {
				skipped.push(file.name);
				continue;
			}
			try {
				nextFiles.push({
					name: file.name,
					mimeType,
					sizeBytes: file.size,
					data: await readFileAsBase64(file),
				});
			} catch {
				skipped.push(file.name);
			}
		}

		if (nextFiles.length > 0) {
			setAttachedFiles((prev) => {
				const existing = new Set(prev.map(getAttachedFileKey));
				const uniqueNext = nextFiles.filter((file) => {
					const key = getAttachedFileKey(file);
					if (existing.has(key)) return false;
					existing.add(key);
					return true;
				});
				return [...prev, ...uniqueNext].slice(0, MAX_AI_ATTACHMENTS);
			});
		}
		if (skipped.length > 0 || selectedFiles.length > availableSlots) {
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

	const removeAttachedFile = (indexToRemove) => {
		setAttachedFiles((prev) =>
			prev.filter((_, index) => index !== indexToRemove),
		);
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
			{attachedImages.length < MAX_AI_ATTACHMENTS && (
				<div className="AiAttachmentControls__file_actions">
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
				</div>
			)}
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
			<div className="AiAttachmentControls__file_actions">
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
				onSelect={(img) => {
					if (img?.url) {
						addAttachedImage({
							name: img.name || String(img.url).split("/").pop() || img.url,
							url: img.url,
							previewUrl: img.url,
						});
					}
					setIsGalleryOpen(false);
				}}
				initialSource={campaignSlug || "general"}
				initialCategory="attachments"
				initialSubcategory=""
			/>
		</div>
	);
}
