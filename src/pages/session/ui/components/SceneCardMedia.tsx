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
		<section className="SessionSceneCard__imageSide">
			<h4 className="SessionSceneCard__imageTitle">{lang.t("Scene image")}</h4>
			<ImageAssetField
				imageUrl={imageUrl}
				campaignSlug={campaignSlug}
				target="scene"
				onImageChange={onImageChange}
				imageAlt={lang.t("Scene {number}", { number })}
				enableContextReplace={true}
				showClearButton={true}
				containerClassName="SessionSceneCard__portraitContainer"
				wrapperClassName="SessionSceneCard__portraitWrapper"
				deleteButtonClassName="SessionSceneCard__imageDelete"
				previewTitle={lang.t("Scene {number}", { number })}
				previewModalClassName="SessionSceneCard__imageModal"
				previewContentClassName="SessionSceneCard__imageModalContent"
			/>
		</section>
	);
}
