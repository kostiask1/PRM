import { useEffect, useMemo, useState } from "react";
import { alert } from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/api.js";
import { imageApi } from "../../../entities/image/api.js";
import { IMAGE_GALLERY_CATEGORIES } from "../../../entities/image/model.js";
import "../../../assets/components/ImageDropzone.css";
import { lang } from "../../../shared/config/index.js";
import { useAppDispatch } from "../../../shared/lib/index.js";
import classNames from "../../../shared/lib/classNames.js";
import Icon from "../../../components/common/Icon";
import Modal from "../../../components/common/Modal";
import ImageGallery from "./ImageGallery";
import ImageTargetSettings from "./ImageTargetSettings";
import Button from "../../../components/form/Button";

function splitFileName(fileName) {
	const lastDotIndex = fileName.lastIndexOf(".");
	if (lastDotIndex <= 0) {
		return { baseName: fileName, extension: "" };
	}

	return {
		baseName: fileName.slice(0, lastDotIndex),
		extension: fileName.slice(lastDotIndex),
	};
}

export default function ImageDropzone({
	campaignSlug,
	onUploadSuccess,
	initialSource,
	initialCategory = "maps",
	initialSubcategory = "",
}) {
	const dispatch = useAppDispatch();
	const [isDragging, setIsDragging] = useState(false);
	const [pendingFile, setPendingFile] = useState(null);
	const [pendingFileBaseName, setPendingFileBaseName] = useState("");
	const [campaigns, setCampaigns] = useState([]);
	const [uploadConfig, setUploadConfig] = useState({
		source: initialSource || campaignSlug || "general",
		category: initialCategory,
		subcategory: initialSubcategory,
	});
	const [isUploading, setIsUploading] = useState(false);
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			try {
				const list = await campaignApi.listCampaigns();
				if (!cancelled) setCampaigns(Array.isArray(list) ? list : []);
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
			source: initialSource || campaignSlug || "general",
		}));
	}, [campaignSlug, initialSource]);

	useEffect(() => {
		setPendingFileBaseName(
			pendingFile ? splitFileName(pendingFile.name).baseName : "",
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

	const sourceOptions = [
		{ id: "general", label: lang.t("General"), icon: "database" },
		...campaigns.map((campaign) => ({
			id: campaign.slug,
			label: campaign.name,
			icon: "map",
		})),
	];

	const handleDragOver = (e) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = () => setIsDragging(false);

	const handleDrop = (e) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files[0];
		if (file && file.type.startsWith("image/")) {
			setPendingFile(file);
		}
	};

	const handleFileSelect = (e) => {
		const file = e.target.files[0];
		if (file) setPendingFile(file);
	};

	const executeUpload = async () => {
		if (!pendingFile) return;

		setIsUploading(true);
		try {
			const { baseName, extension } = splitFileName(pendingFile.name);
			const uploadBaseName = pendingFileBaseName.trim() || baseName;
			const uploadFileName = `${uploadBaseName}${extension}`;
			const uploadFile =
				uploadFileName === pendingFile.name
					? pendingFile
					: new File([pendingFile], uploadFileName, {
							type: pendingFile.type,
							lastModified: pendingFile.lastModified,
						});
			const result = await imageApi.upload(
				uploadConfig.source,
				uploadConfig.category,
				uploadConfig.subcategory,
				uploadFile,
			);
			onUploadSuccess?.(result);
			setPendingFile(null);
		} catch (err) {
			dispatch(alert({ title: lang.t("Error"), message: err.message }));
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
					disabled={isUploading}
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
							onChange={(next) =>
								setUploadConfig((prev) => ({
									...prev,
									source: next.source || prev.source,
									category: next.category,
									subcategory: next.subcategory || "",
								}))
							}
							loadSubcategories={({ source, category, subcategory }) =>
								imageApi.getSubcategories(source, category, subcategory)
							}
							createSubcategory={({ source, category, fullPath }) =>
								imageApi.createSubcategory(source, category, fullPath)
							}
						/>
					</div>
				</Modal>
			)}

			<ImageGallery
				isOpen={isGalleryOpen}
				onClose={() => setIsGalleryOpen(false)}
				onSelect={(img) => {
					onUploadSuccess?.(img);
					setIsGalleryOpen(false);
				}}
				initialSource={initialSource || campaignSlug || "general"}
				initialCategory={initialCategory}
				initialSubcategory={initialSubcategory}
			/>
		</div>
	);
}
