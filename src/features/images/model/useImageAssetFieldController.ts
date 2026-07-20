import {
	useEffect,
	useMemo,
	useState,
	type MouseEvent as ReactMouseEvent,
} from "react";
import type { ImageAsset } from "../api/imageApi.ts";
import {
	getImageAssetFieldContextMenuPlan,
	getImageAssetFieldPresentation,
	getImageAssetFieldSelectionUrl,
	resolveImageAssetLocation,
	type ImageAssetFieldEventPlan,
	type ImageAssetTarget,
} from "./imageAssetField.ts";

export interface UseImageAssetFieldControllerOptions {
	imageUrl?: string | null;
	campaignSlug?: string | null;
	target: ImageAssetTarget;
	enableContextReplace: boolean;
	onImageChange?: (imageUrl: string | null) => void;
}

function getBrowserOrigin(): string | undefined {
	return typeof window === "undefined" ? undefined : window.location.origin;
}

function applyImageAssetFieldEventPlan(
	event: ReactMouseEvent,
	plan: ImageAssetFieldEventPlan,
): void {
	if (plan.preventDefault) event.preventDefault();
	if (plan.stopPropagation) event.stopPropagation();
}

export default function useImageAssetFieldController({
	imageUrl,
	campaignSlug,
	target,
	enableContextReplace,
	onImageChange,
}: UseImageAssetFieldControllerOptions) {
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);
	const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
	const [hasImageError, setHasImageError] = useState(false);
	const location = useMemo(
		() =>
			resolveImageAssetLocation({
				baseOrigin: getBrowserOrigin(),
				campaignSlug,
				imageUrl,
				target,
			}),
		[imageUrl, target, campaignSlug],
	);

	useEffect(() => {
		setHasImageError(false);
	}, [imageUrl]);

	const presentation = getImageAssetFieldPresentation({
		imageUrl,
		hasImageError,
		isImagePreviewOpen,
	});
	const emitImageChange = (nextImageUrl: string | null) => {
		onImageChange?.(nextImageUrl);
	};
	const openGallery = () => setIsGalleryOpen(true);
	const closeGallery = () => setIsGalleryOpen(false);
	const closePreview = () => setIsImagePreviewOpen(false);
	const handleImageClick = (event: ReactMouseEvent) => {
		event.stopPropagation();
		setIsImagePreviewOpen(true);
	};
	const handleImageContextMenu = (event: ReactMouseEvent) => {
		const plan = getImageAssetFieldContextMenuPlan(enableContextReplace);
		applyImageAssetFieldEventPlan(event, plan);
		const actions = {
			"open-gallery": openGallery,
			none: () => undefined,
		};
		actions[plan.action]();
	};
	const clearImage = (event: ReactMouseEvent) => {
		event.stopPropagation();
		emitImageChange(null);
	};
	const chooseImage = (event: ReactMouseEvent) => {
		event.stopPropagation();
		openGallery();
	};
	const selectGalleryImage = (asset: ImageAsset | null | undefined) => {
		const selectedUrl = getImageAssetFieldSelectionUrl(asset);
		if (selectedUrl) emitImageChange(selectedUrl);
		closeGallery();
	};
	const acceptUploadedImage = (asset: ImageAsset) => {
		emitImageChange(asset.url);
	};

	return {
		location,
		presentation,
		isGalleryOpen,
		markImageMissing: () => setHasImageError(true),
		handleImageClick,
		handleImageContextMenu,
		clearImage,
		chooseImage,
		closePreview,
		closeGallery,
		selectGalleryImage,
		acceptUploadedImage,
	};
}
