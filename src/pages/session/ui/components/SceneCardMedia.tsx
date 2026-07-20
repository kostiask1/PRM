import { ImageAssetField } from "../../../../features/images/index.js";
import { lang } from "../../../../shared/lib/index.js";

export interface SceneCardMediaProps {
	number: number;
	imageUrl?: string | null;
	campaignSlug?: string | null;
	onImageChange: (imageUrl: string | null) => void;
}

export default function SceneCardMedia({
	number,
	imageUrl,
	campaignSlug,
	onImageChange,
}: SceneCardMediaProps) {
	return (
		<div className="SceneCard__image_side">
			<ImageAssetField
				imageUrl={imageUrl}
				campaignSlug={campaignSlug}
				target="scene"
				onImageChange={onImageChange}
				imageAlt={lang.t("Scene {number}", { number })}
				enableContextReplace={true}
				showClearButton={true}
				containerClassName="SceneCard__portrait_container"
				wrapperClassName="SceneCard__portrait_wrapper"
				deleteButtonClassName="SceneCard__image_delete"
				previewTitle={lang.t("Scene {number}", { number })}
				previewModalClassName="SceneImageModal"
				previewContentClassName="SceneImageModal__content"
			/>
		</div>
	);
}
