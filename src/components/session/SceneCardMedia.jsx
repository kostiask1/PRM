import ImageAssetField from "../ImageAssetField";
import { lang } from "../../services/localization";

export default function SceneCardMedia({
	number,
	imageUrl,
	campaignSlug,
	onImageChange,
}) {
	return (
		<div className="SceneCard__image-side">
			<ImageAssetField
				imageUrl={imageUrl}
				campaignSlug={campaignSlug}
				target="scene"
				onImageChange={onImageChange}
				imageAlt={lang.t("Scene {number}", { number })}
				enableContextReplace={true}
				showClearButton={true}
				containerClassName="SceneCard__portrait-container"
				wrapperClassName="SceneCard__portrait-wrapper"
				deleteButtonClassName="SceneCard__image-delete"
				previewTitle={lang.t("Scene {number}", { number })}
				previewModalClassName="SceneImageModal"
				previewContentClassName="SceneImageModal__content"
			/>
		</div>
	);
}
