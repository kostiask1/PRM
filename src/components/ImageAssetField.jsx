import { useEffect, useMemo, useState } from "react";
import Button from "./form/Button";
import ImageDropzone from "./ImageDropzone";
import ImageGallery from "./ImageGallery";
import Modal from "./common/Modal";

const TARGET_PRESETS = {
	character: { category: "characters", subcategory: "players" },
	npc: { category: "tokens", subcategory: "npc" },
	scene: { category: "scenes", subcategory: "" },
};

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
	enableContextReplace = false,
	onImageChange,
	imageAlt = "Image",
	containerClassName,
	wrapperClassName,
	deleteButtonClassName,
	previewTitle = "Preview",
	previewModalClassName,
	previewContentClassName,
}) {
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
	const [hasImageError, setHasImageError] = useState(false);

	const location = useMemo(
		() => getPreset(target, campaignSlug),
		[target, campaignSlug],
	);

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
						{showClearButton && (
							<Button
								variant="danger"
								size="small"
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
					showFooter={false}>
					<div
						className={previewContentClassName}
						onClick={() => setIsImagePreviewOpen(false)}>
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
