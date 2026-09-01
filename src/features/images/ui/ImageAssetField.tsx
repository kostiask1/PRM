import { lang } from "../../../shared/lib/index.js";
import type { ImageAssetTarget } from "../model/imageAssetField.ts";
import useImageAssetFieldController from "../model/useImageAssetFieldController.ts";
import ImageAssetFieldView from "./ImageAssetFieldView.tsx";

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
	const controller = useImageAssetFieldController({
		imageUrl,
		campaignSlug,
		target,
		enableContextReplace,
		onImageChange,
	});
	return (
		<ImageAssetFieldView
			controller={controller}
			campaignSlug={campaignSlug}
			showClearButton={showClearButton}
			enableContextReplace={enableContextReplace}
			imageAlt={imageAlt}
			containerClassName={containerClassName}
			wrapperClassName={wrapperClassName}
			deleteButtonClassName={deleteButtonClassName}
			previewTitle={previewTitle}
			previewModalClassName={previewModalClassName}
			previewContentClassName={previewContentClassName}
		/>
	);
}
