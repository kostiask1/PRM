import "../../../assets/components/ImageGallery.css";

import type { ImageAsset } from "../api/imageApi.ts";
import { ImageGalleryView } from "./ImageGalleryView.tsx";
import { useImageGalleryUiController } from "./useImageGalleryUiController.ts";

export interface ImageGalleryProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect?: (image: ImageAsset | null | undefined) => void;
	initialSource?: string;
	initialCategory?: string;
	initialSubcategory?: string;
}

function ImageGallery({
	isOpen,
	onClose,
	onSelect,
	initialSource,
	initialCategory,
	initialSubcategory,
}: ImageGalleryProps) {
	const controller = useImageGalleryUiController({
		initialCategory,
		initialSource,
		initialSubcategory,
		isOpen,
		isSelectionMode: typeof onSelect === "function",
	});
	if (!isOpen) return null;
	return (
		<ImageGalleryView
			controller={controller}
			onClose={onClose}
			onSelect={onSelect}
		/>
	);
}

export default ImageGallery;
