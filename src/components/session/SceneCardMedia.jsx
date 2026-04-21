import Button from "../Button";
import ImageDropzone from "../ImageDropzone";

export default function SceneCardMedia({
	number,
	imageUrl,
	onImageClick,
	onImageClear,
	campaignSlug,
	onUploadSuccess,
}) {
	return (
		<div className="SceneCard__image-side">
			<div className="SceneCard__portrait-container">
				{imageUrl ? (
					<div className="SceneCard__portrait-wrapper">
						<img
							src={imageUrl}
							alt={`Scene ${number}`}
							onClick={(event) => {
								event.stopPropagation();
								onImageClick();
							}}
						/>
						<Button
							variant="danger"
							size="small"
							icon="x"
							onClick={(event) => {
								event.stopPropagation();
								onImageClear();
							}}
							className="SceneCard__image-delete"
						/>
					</div>
				) : (
					<ImageDropzone
						campaignSlug={campaignSlug}
						onUploadSuccess={onUploadSuccess}
					/>
				)}
			</div>
		</div>
	);
}
