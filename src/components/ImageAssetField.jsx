import { useEffect, useMemo, useState } from "react";
import Button from "./form/Button";
import ImageDropzone from "./ImageDropzone";
import ImageGallery from "./ImageGallery";
import Modal from "./common/Modal";
import Tooltip from "./common/Tooltip";
import { lang } from "../services/localization";

const TARGET_PRESETS = {
	character: { category: "characters", subcategory: "players" },
	npc: { category: "tokens", subcategory: "npc" },
	scene: { category: "scenes", subcategory: "" },
};

function decodeSegment(value) {
	try {
		return decodeURIComponent(value || "");
	} catch {
		return String(value || "");
	}
}

function parseGalleryLocationFromImageUrl(imageUrl) {
	if (!imageUrl) return null;

	let pathname = "";
	try {
		if (typeof window !== "undefined") {
			pathname = new URL(imageUrl, window.location.origin).pathname;
		} else {
			pathname = String(imageUrl || "");
		}
	} catch {
		pathname = String(imageUrl || "");
	}

	const parts = pathname.split("/").filter(Boolean);
	if (parts.length < 5 || parts[0] !== "api" || parts[1] !== "images") {
		return null;
	}

	const source = decodeSegment(parts[2]);
	const category = decodeSegment(parts[3]);
	const tail = parts.slice(4);
	if (!source || !category || tail.length === 0) return null;

	const subcategory = tail
		.slice(0, -1)
		.map((segment) => decodeSegment(segment))
		.filter(Boolean)
		.join("/");

	return {
		source,
		category,
		subcategory,
	};
}

function getPreset(target, campaignSlug) {
	const preset = TARGET_PRESETS[target] || TARGET_PRESETS.character;
	return {
		source: campaignSlug || "general",
		category: preset.category,
		subcategory: preset.subcategory,
	};
}

export default function ImageAssetField({
	imageUrl,
	campaignSlug,
	target = "character",
	isEditing = false,
	showClearButton = false,
	enableContextReplace = true,
	onImageChange,
	imageAlt = lang.t("Image"),
	containerClassName,
	wrapperClassName,
	deleteButtonClassName,
	previewTitle = lang.t("Preview"),
	previewModalClassName,
	previewContentClassName,
}) {
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
	const [hasImageError, setHasImageError] = useState(false);

	const location = useMemo(() => {
		const parsed = parseGalleryLocationFromImageUrl(imageUrl);
		if (parsed) return parsed;
		return getPreset(target, campaignSlug);
	}, [imageUrl, target, campaignSlug]);

	useEffect(() => {
		setHasImageError(false);
	}, [imageUrl]);

	const hasValidImage = Boolean(imageUrl) && !hasImageError;

	const openGallery = () => setIsGalleryOpen(true);

	return (
		<>
			<div className={containerClassName}>
				{hasValidImage ? (
					<div className={wrapperClassName}>
						<Tooltip
							content={lang.t("Right-click: replace image via gallery")}
							disabled={!enableContextReplace}
						>
							<img
								src={imageUrl}
								alt={imageAlt}
								onError={() => setHasImageError(true)}
								onClick={(event) => {
									event.stopPropagation();
									if (isEditing) {
										openGallery();
										return;
									}
									setIsImagePreviewOpen(true);
								}}
								onContextMenu={(event) => {
									if (!enableContextReplace) return;
									event.preventDefault();
									event.stopPropagation();
									openGallery();
								}}
							/>
						</Tooltip>
						{showClearButton && (
							<Button
								variant="danger"
								size={Button.SIZES.SMALL}
								icon="x"
								className={deleteButtonClassName}
								onClick={(event) => {
									event.stopPropagation();
									onImageChange?.(null);
								}}
							/>
						)}
					</div>
				) : (
					<ImageDropzone
						campaignSlug={campaignSlug}
						initialSource={location.source}
						initialCategory={location.category}
						initialSubcategory={location.subcategory}
						onUploadSuccess={(result) => onImageChange?.(result.url)}
					/>
				)}
			</div>

			{isImagePreviewOpen && hasValidImage && !isEditing && (
				<Modal
					title={previewTitle}
					type="custom"
					className={previewModalClassName}
					onCancel={() => setIsImagePreviewOpen(false)}
					showFooter={false}
				>
					<div
						className={previewContentClassName}
						onClick={() => setIsImagePreviewOpen(false)}
					>
						<img src={imageUrl} alt={imageAlt} />
					</div>
				</Modal>
			)}

			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
				onSelect={(img) => {
					onImageChange?.(img.url);
					setIsGalleryOpen(false);
				}}
				initialSource={location.source}
				initialCategory={location.category}
				initialSubcategory={location.subcategory}
			/>
		</>
	);
}
