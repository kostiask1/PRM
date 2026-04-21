import Button from "../Button";
import ImageDropzone from "../ImageDropzone";

export default function SceneCardMedia({
	number,
	imageUrl,
	onImagePreview,
	onImageReplace,
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
							alt={`Сцена ${number}`}
							onClick={(event) => {
								event.stopPropagation();
								onImagePreview();
							}}
							onContextMenu={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onImageReplace();
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
