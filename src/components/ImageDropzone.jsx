import { useEffect, useState } from "react";
import { alert } from "../actions/app";
import { api } from "../api";
import Button from "./form/Button";
import Icon from "./common/Icon";
import Modal from "./common/Modal";
import ImageGallery from "./ImageGallery";
import ImageTargetSettings from "./ImageTargetSettings";
import { IMAGE_GALLERY_CATEGORIES } from "../hooks/useImageGallery";
import "../assets/components/ImageDropzone.css";
import classNames from "../utils/classNames";
import { useAppDispatch } from "../store/appStore";
import { lang } from "../services/localization";

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
				const list = await api.listCampaigns();
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
		setIsUploading(true);
		try {
			const result = await api.uploadImage(
				uploadConfig.source,
				uploadConfig.category,
				uploadConfig.subcategory,
				pendingFile,
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
			className={classNames("ImageDropzone", { "is-dragging": isDragging })}
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
					confirmLabel={
						isUploading ? lang.t("Uploading...") : lang.t("Upload")
					}
					disabled={isUploading}
				>
					<div className="ImageDropzone__upload-settings">
						<div className="ImageDropzone__preview">
							<img
								src={URL.createObjectURL(pendingFile)}
								alt={lang.t("Preview")}
							/>
							<span>{pendingFile.name}</span>
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
