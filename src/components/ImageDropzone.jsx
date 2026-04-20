import { useState, useCallback } from "react";
import { api } from "../api";
import Button from "./Button";
import Icon from "./Icon";
import Modal from "./Modal";
import ImageGallery from "./ImageGallery";
import "../assets/components/ImageDropzone.css";

const CATEGORIES = [
	{ id: "maps", label: "Мапи", icon: "map" },
	{ id: "scenes", label: "Сцени", icon: "image" },
	{ id: "tokens", label: "Токени", icon: "user", subs: ["npc", "players"] },
	{ id: "characters", label: "Персонажі", icon: "users", subs: ["npc", "players"] },
	{ id: "props", label: "Предмети", icon: "book" },
	{ id: "mounts", label: "Тварини/Транспорт", icon: "skull" },
	{ id: "notes", label: "Нотатки", icon: "file" },
	{ id: "attachments", label: "Вкладення", icon: "layers" },
];

export default function ImageDropzone({ campaignSlug, onUploadSuccess, modal }) {
	const [isDragging, setIsDragging] = useState(false);
	const [pendingFile, setPendingFile] = useState(null);
	const [uploadConfig, setUploadConfig] = useState({ category: "maps", subcategory: "" });
	const [isUploading, setIsUploading] = useState(false);
	const [isGalleryOpen, setIsGalleryOpen] = useState(false);

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
				campaignSlug,
				uploadConfig.category,
				uploadConfig.subcategory,
				pendingFile
			);
			if (onUploadSuccess) onUploadSuccess(result);
			setPendingFile(null);
		} catch (err) {
			modal.alert("Помилка", err.message);
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className={`ImageDropzone ${isDragging ? "is-dragging" : ""}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<div className="ImageDropzone__content">
				<Icon name="image" size={48} />
				<p>Перетягніть зображення сюди або</p>
				<label className="ImageDropzone__label">
					виберіть файл
					<input type="file" accept="image/*" onChange={handleFileSelect} hidden />
				</label>
				<div className="ImageDropzone__divider">або</div>
				<Button 
					variant="ghost" 
					icon="database" 
					size="small"
					onClick={() => setIsGalleryOpen(true)}
				>
					Обрати з галереї
				</Button>
			</div>

			{pendingFile && (
				<Modal
					title="Налаштування завантаження"
					onCancel={() => setPendingFile(null)}
					onConfirm={executeUpload}
					confirmLabel={isUploading ? "Завантаження..." : "Завантажити"}
					disabled={isUploading}
				>
					<div className="ImageDropzone__settings">
						<div className="ImageDropzone__preview">
							<img src={URL.createObjectURL(pendingFile)} alt="Preview" />
							<span>{pendingFile.name}</span>
						</div>
						
						<div className="ImageDropzone__categories">
							<label>Категорія:</label>
							<div className="ImageDropzone__grid">
								{CATEGORIES.map(cat => (
									<button
										key={cat.id}
										type="button"
										className={`CategoryBtn ${uploadConfig.category === cat.id ? "is-active" : ""}`}
										onClick={() => setUploadConfig({ 
											category: cat.id, 
											subcategory: cat.subs ? cat.subs[0] : "" 
										})}
									>
										<Icon name={cat.icon} size={18} />
										{cat.label}
									</button>
								))}
							</div>
						</div>

						{CATEGORIES.find(c => c.id === uploadConfig.category)?.subs && (
							<div className="ImageDropzone__subcategories">
								<label>Підкатегорія:</label>
								<div className="ImageDropzone__tabs">
									{CATEGORIES.find(c => c.id === uploadConfig.category).subs.map(sub => (
										<button
											key={sub}
											className={`TabBtn ${uploadConfig.subcategory === sub ? "is-active" : ""}`}
											onClick={() => setUploadConfig(prev => ({ ...prev, subcategory: sub }))}
										>
											{sub.toUpperCase()}
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				</Modal>
			)}

			<ImageGallery 
				isOpen={isGalleryOpen} 
				onClose={() => setIsGalleryOpen(false)} 
				onSelect={(img) => {
					// Передаємо об'єкт зображення (що містить url) далі
					onUploadSuccess?.(img);
					setIsGalleryOpen(false);
				}} 
				modal={modal}
			/>
		</div>
	);
}