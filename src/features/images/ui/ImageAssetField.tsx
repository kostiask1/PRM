import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/ui/index.js";
import ImageDropzone from "./ImageDropzone";
import ImageGallery from "./ImageGallery";
import { Modal } from "../../modal/index.js";
import { Tooltip } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import type { ImageAsset } from "../api/imageApi.ts";
import {
	resolveImageAssetLocation,
	type ImageAssetTarget,
} from "../model/imageAssetField.ts";

export interface ImageAssetFieldProps {
	imageUrl?: string | null;
	campaignSlug?: string | null;
	target?: ImageAssetTarget;
	showClearButton?: boolean;
	enableContextReplace?: boolean;
	onImageChange?: (imageUrl: string | null) => void;
	imageAlt?: string;
	containerClassName?: string;
	wrapperClassName?: string;
	deleteButtonClassName?: string;
	previewTitle?: string;
	previewModalClassName?: string;
	previewContentClassName?: string;
}

export default function ImageAssetField({
	imageUrl,
	campaignSlug,
	target = "character",
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
}: ImageAssetFieldProps) {
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
	const [hasImageError, setHasImageError] = useState(false);

	const location = useMemo(() => {
		return resolveImageAssetLocation({
			baseOrigin:
				typeof window === "undefined" ? undefined : window.location.origin,
			campaignSlug,
			imageUrl,
			target,
		});
	}, [imageUrl, target, campaignSlug]);

	useEffect(() => {
		setHasImageError(false);
	}, [imageUrl]);

	const hasValidImage = Boolean(imageUrl) && !hasImageError;
	const hasMissingImage = Boolean(imageUrl) && hasImageError;
	const resolvedImageUrl = imageUrl || "";

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
								src={resolvedImageUrl}
								alt={imageAlt}
								onError={() => setHasImageError(true)}
								onClick={(event) => {
									event.stopPropagation();
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
				) : hasMissingImage ? (
					<div className="ImageAssetField__missing">
						<div className="ImageAssetField__missing_title">
							{lang.t("Image not found")}
						</div>
						<div
							className="ImageAssetField__missing_url"
							title={resolvedImageUrl}
						>
							{resolvedImageUrl}
						</div>
						<div className="ImageAssetField__missing_actions">
							<Button
								variant="danger"
								size={Button.SIZES.SMALL}
								icon="x"
								onClick={(event) => {
									event.stopPropagation();
									onImageChange?.(null);
								}}
							>
								{lang.t("Clear image")}
							</Button>
							<Button
								variant="ghost"
								size={Button.SIZES.SMALL}
								icon="image"
								onClick={(event) => {
									event.stopPropagation();
									openGallery();
								}}
							>
								{lang.t("Choose image")}
							</Button>
						</div>
					</div>
				) : (
					<ImageDropzone
						campaignSlug={campaignSlug}
						initialSource={location.source}
						initialCategory={location.category}
						initialSubcategory={location.subcategory}
						onUploadSuccess={(result: ImageAsset) =>
							onImageChange?.(result.url)
						}
					/>
				)}
			</div>

			{isImagePreviewOpen && hasValidImage && (
				<Modal
					title={previewTitle}
					type="custom"
					className={previewModalClassName}
					onConfirm={() => setIsImagePreviewOpen(false)}
					onCancel={() => setIsImagePreviewOpen(false)}
					showFooter={false}
				>
					<div
						className={previewContentClassName}
						onClick={() => setIsImagePreviewOpen(false)}
					>
						<img src={resolvedImageUrl} alt={imageAlt} />
					</div>
				</Modal>
			)}

			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
				onSelect={(img: ImageAsset | null | undefined) => {
					if (img?.url) onImageChange?.(img.url);
					setIsGalleryOpen(false);
				}}
				initialSource={location.source}
				initialCategory={location.category}
				initialSubcategory={location.subcategory}
			/>
		</>
	);
}
