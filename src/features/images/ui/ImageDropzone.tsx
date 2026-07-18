import {
	type ChangeEvent,
	type DragEvent,
	useEffect,
	useMemo,
	useState,
} from "react";
import { alert } from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import { imageApi } from "../api/imageApi.ts";

const api = { ...campaignApi, ...imageApi };
import "../../../assets/components/ImageDropzone.css";
import { IMAGE_GALLERY_CATEGORIES } from "../imageGalleryConfig.ts";
import { lang } from "../../../shared/lib/index.js";
import { useAppDispatch } from "../../../shared/model/index.js";
import { classNames } from "../../../shared/lib/index.js";
import { Icon } from "../../../shared/ui/index.js";
import { Modal } from "../../modal/index.js";
import ImageGallery from "./ImageGallery";
import ImageTargetSettings from "./ImageTargetSettings";
import { Button } from "../../../shared/ui/index.js";
import type { CampaignRecord } from "../../../entities/campaign/index.js";
import type { ImageAsset } from "../api/imageApi.ts";
import {
	getImageUploadErrorMessage,
	getImageUploadFileName,
	getImageUploadSourceOptions,
	normalizeImageCampaigns,
	requireUploadedImage,
	resolveImageUploadSource,
	splitImageFileName,
} from "../model/imageUpload.ts";
import type { ImageTargetValue } from "../model/imageTargetSettings.ts";

export interface ImageDropzoneProps {
	campaignSlug?: string | null;
	onUploadSuccess?: (image: ImageAsset) => void;
	initialSource?: string | null;
	initialCategory?: string;
	initialSubcategory?: string;
}

export default function ImageDropzone({
	campaignSlug,
	onUploadSuccess,
	initialSource,
	initialCategory = "maps",
	initialSubcategory = "",
}: ImageDropzoneProps) {
	const dispatch = useAppDispatch();
	const [isDragging, setIsDragging] = useState(false);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [pendingFileBaseName, setPendingFileBaseName] = useState("");
	const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
	const [uploadConfig, setUploadConfig] = useState<ImageTargetValue>({
		source: resolveImageUploadSource(initialSource, campaignSlug),
		category: initialCategory,
		subcategory: initialSubcategory,
	});
	const [isUploading, setIsUploading] = useState(false);
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			try {
				const list = await api.listCampaigns();
				if (!cancelled) setCampaigns(normalizeImageCampaigns(list));
			} catch {
				if (!cancelled) setCampaigns([]);
			}
		};
		run();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setUploadConfig((prev) => ({
			...prev,
			source: resolveImageUploadSource(initialSource, campaignSlug),
		}));
	}, [campaignSlug, initialSource]);

	useEffect(() => {
		setPendingFileBaseName(
			pendingFile ? splitImageFileName(pendingFile.name).baseName : "",
		);
	}, [pendingFile]);

	const pendingFilePreviewUrl = useMemo(() => {
		if (!pendingFile) return "";
		return URL.createObjectURL(pendingFile);
	}, [pendingFile]);

	useEffect(() => {
		return () => {
			if (pendingFilePreviewUrl) URL.revokeObjectURL(pendingFilePreviewUrl);
		};
	}, [pendingFilePreviewUrl]);

	const sourceOptions = getImageUploadSourceOptions(
		campaigns,
		lang.t("General"),
	);

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = () => setIsDragging(false);

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files[0];
		if (file && file.type.startsWith("image/")) {
			setPendingFile(file);
		}
	};

	const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) setPendingFile(file);
	};

	const executeUpload = async () => {
		if (!pendingFile || isUploading) return;

		setIsUploading(true);
		try {
			const uploadFileName = getImageUploadFileName(
				pendingFile.name,
				pendingFileBaseName,
			);
			const uploadFile =
				uploadFileName === pendingFile.name
					? pendingFile
					: new File([pendingFile], uploadFileName, {
							type: pendingFile.type,
							lastModified: pendingFile.lastModified,
						});
			const result = requireUploadedImage(await api.uploadImage(
				uploadConfig.source,
				uploadConfig.category,
				uploadConfig.subcategory,
				uploadFile,
			));
			onUploadSuccess?.(result);
			setPendingFile(null);
		} catch (err: unknown) {
			dispatch(
				alert({
					title: lang.t("Error"),
					message: getImageUploadErrorMessage(err),
				}),
			);
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div
			className={classNames("ImageDropzone", { is_dragging: isDragging })}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<div className="ImageDropzone__content">
				<Icon name="image" size={48} />
				<p>{lang.t("Drag an image here or")}</p>
				<label className="ImageDropzone__label">
					{lang.t("choose a file")}
					<input
						type="file"
						accept="image/*"
						onChange={handleFileSelect}
						hidden
					/>
				</label>
				<div className="ImageDropzone__divider">{lang.t("or")}</div>
				<Button
					variant="ghost"
					icon="database"
					size={Button.SIZES.SMALL}
					onClick={() => setIsGalleryOpen(true)}
				>
					{lang.t("From gallery")}
				</Button>
			</div>

			{pendingFile && (
				<Modal
					title={lang.t("Upload settings")}
					onCancel={() => setPendingFile(null)}
					onConfirm={executeUpload}
					confirmLabel={isUploading ? lang.t("Uploading...") : lang.t("Upload")}
					cancelDisabled={isUploading}
				>
					<div className="ImageDropzone__upload_settings">
						<div className="ImageDropzone__preview">
							<img src={pendingFilePreviewUrl} alt={lang.t("Preview")} />
							<label className="ImageDropzone__filename">
								<span>{lang.t("Image name")}</span>
								<input
									type="text"
									value={pendingFileBaseName}
									onChange={(e) => setPendingFileBaseName(e.target.value)}
									disabled={isUploading}
								/>
							</label>
						</div>
						<ImageTargetSettings
							sources={sourceOptions}
							sourceTitle={lang.t("Source")}
							categories={IMAGE_GALLERY_CATEGORIES}
							value={uploadConfig}
							onChange={(next: ImageTargetValue) =>
								setUploadConfig((prev) => ({
									...prev,
									source: next.source || prev.source,
									category: next.category,
									subcategory: next.subcategory || "",
								}))
							}
							loadSubcategories={({ source, category, subcategory }) =>
								api.getSubcategories(source, category, subcategory)
							}
							createSubcategory={({ source, category, fullPath }) =>
								api.createSubcategory(source, category, fullPath)
							}
						/>
					</div>
				</Modal>
			)}

			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
				onSelect={(img: ImageAsset | null | undefined) => {
					if (img) onUploadSuccess?.(img);
					setIsGalleryOpen(false);
				}}
				initialSource={resolveImageUploadSource(initialSource, campaignSlug)}
				initialCategory={initialCategory}
				initialSubcategory={initialSubcategory}
			/>
		</div>
	);
}
