import { useState, useEffect } from "react";
import { api } from "../api";
import Modal from "./Modal";
import Icon from "./Icon";
import "../assets/components/ImageGallery.css";
import Button from "./Button";

const CATEGORIES = [
	{ id: "maps", label: "Мапи", icon: "map" },
	{ id: "scenes", label: "Сцени", icon: "image" },
	{ id: "tokens", label: "Токени", icon: "user", subs: ["npc", "players"] },
	{
		id: "characters",
		label: "Персонажі",
		icon: "users",
		subs: ["npc", "players"],
	},
	{ id: "props", label: "Предмети", icon: "book" },
	{ id: "mounts", label: "Тварини", icon: "skull" },
	{ id: "notes", label: "Нотатки", icon: "file" },
	{ id: "attachments", label: "Вкладення", icon: "layers" },
];

export default function ImageGallery({ isOpen, onClose, onSelect }) {
	const [campaigns, setCampaigns] = useState([]);
	const [selectedSource, setSelectedSource] = useState("general");
	const [selectedCat, setSelectedCat] = useState(CATEGORIES[0]);
	const [selectedSub, setSelectedSub] = useState("");
	const [editingSubName, setEditingSubName] = useState(null); // Stores the name of the subcategory being edited
	const [tempSubName, setTempSubName] = useState(""); // Stores the value of the input field during rename
	const [dynamicSubs, setDynamicSubs] = useState([]);
	const [images, setImages] = useState([]);
	const [selectedFilenames, setSelectedFilenames] = useState(new Set());
	const [selectedSubs, setSelectedSubs] = useState(new Set());
	const [loading, setLoading] = useState(false);
	const [isCreatingSub, setIsCreatingSub] = useState(false);
	const [newSubName, setNewSubName] = useState("");
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [dragSource, setDragSource] = useState(null); // { slug, category, subcategory }
	const [dragOverTarget, setDragOverTarget] = useState(null); // { type: 'source'|'cat'|'sub', id: string }
	const hasSelection = selectedFilenames.size > 0 || selectedSubs.size > 0;

	useEffect(() => {
		if (isOpen) {
			api.listCampaigns().then(setCampaigns);
		}
	}, [isOpen]);

	useEffect(() => {
		if (isOpen) {
			loadImages();
			loadSubcategories();
		}
		setSelectedFilenames(new Set()); // Clear selection on category/source change
		setSelectedSubs(new Set());
		setEditingSubName(null); // Clear editing state
	}, [selectedSource, selectedCat, selectedSub, isOpen]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

			if (e.key === "Delete") {
				handleBulkDelete();
			} else if (e.key === "Backspace") {
				if (selectedSub) {
					e.preventDefault();
					setSelectedSub("");
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedFilenames, selectedSubs, selectedSub, hasSelection]);

	const loadSubcategories = async () => {
		try {
			const subs = await api.getSubcategories(selectedSource, selectedCat.id);
			setDynamicSubs(subs);
		} catch (err) {
			console.error(err);
		}
	};

	const loadImages = async () => {
		setLoading(true);
		try {
			const data = await api.getImages(
				selectedSource,
				selectedCat.id,
				selectedSub,
			);
			setImages(data || []);
		} catch (err) {
			console.error("Failed to load images:", err);
			setImages([]);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateSub = async () => {
		if (!newSubName.trim()) return;
		try {
			await api.createSubcategory(selectedSource, selectedCat.id, newSubName);
			setNewSubName("");
			setIsCreatingSub(false);
			loadSubcategories();
		} catch (err) {
			alert(err.message);
		}
	};

	const handleRenameSub = async (oldName, newName) => {
		if (!newName.trim() || oldName === newName) {
			setEditingSubName(null);
			return;
		}
		try {
			await api.renameSubcategory(
				selectedSource,
				selectedCat.id,
				oldName,
				newName,
			);
			setEditingSubName(null);
			setTempSubName("");
			loadSubcategories(); // Refresh the list of subcategories
			loadImages(); // Refresh images in case the current subcategory was renamed
			if (selectedSub === oldName) setSelectedSub(newName); // Update selected sub if it was renamed
		} catch (err) {
			alert(`Помилка перейменування: ${err.message}`);
		}
	};

	const handleDragStart = (e, name, type = 'image') => {
		const imagesToMove = type === 'image' && selectedFilenames.has(name) 
			? Array.from(selectedFilenames) 
			: (type === 'image' ? [name] : []);
			
		const subsToMove = type === 'sub' && selectedSubs.has(name)
			? Array.from(selectedSubs)
			: (type === 'sub' ? [name] : []);

		e.dataTransfer.setData(
			"application/json",
			JSON.stringify({
				items: [...imagesToMove, ...subsToMove],
				src: {
					slug: selectedSource,
					category: selectedCat.id,
					subcategory: selectedSub,
				},
			}),
		);
		e.dataTransfer.effectAllowed = "move";
		setDragSource({ slug: selectedSource, category: selectedCat.id, subcategory: selectedSub });
	};

	const handleDragEnd = () => {
		setDragSource(null);
		setDragOverTarget(null);
	};

	const handleDrop = async (e, dest) => {
		e.preventDefault();
		setIsDraggingOver(false);
		setDragOverTarget(null);
		setDragSource(null);
		setLoading(true);

		try {
			const jsonData = e.dataTransfer.getData("application/json");
			
			// Якщо це переміщення існуючих зображень всередині галереї
			if (jsonData) {
				const data = JSON.parse(jsonData);
				if (!data.items?.length) return;

				// Перевірка чи не переміщуємо в ту саму папку
				const sSub = data.src.subcategory || "";
				const dSub = dest.subcategory || "";

				if (
					data.src.slug === dest.slug &&
					data.src.category === dest.category &&
					sSub === dSub
				) {
					setLoading(false);
					return;
				}

				await api.moveImages({
					items: data.items,
					src: data.src,
					dest: dest,
				});
				setSelectedFilenames(new Set());
				setSelectedSubs(new Set());
				loadImages();
				loadSubcategories();
			} 
			// Якщо це файли з комп'ютера
			else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				await handleFileUpload(e.dataTransfer.files);
				return;
			}
		} catch (err) {
			console.error("Move failed", err);
		} finally {
			setLoading(false);
		}
	};

	const handleFileUpload = async (files) => {
		setLoading(true);
		try {
			for (const file of Array.from(files)) {
				if (!file.type.startsWith("image/")) continue;
				await api.uploadImage(
					selectedSource,
					selectedCat.id,
					selectedSub,
					file,
				);
			}
			loadImages();
		} catch (err) {
			console.error("Upload failed:", err);
		} finally {
			setLoading(false);
		}
	};

	const toggleSelect = (name, type, e) => {
		e.stopPropagation();
		if (type === 'image') {
			const next = new Set(selectedFilenames);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			setSelectedFilenames(next);
		} else {
			const next = new Set(selectedSubs);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			setSelectedSubs(next);
		}
	};

	const handleBulkDelete = async () => {
		const total = selectedFilenames.size + selectedSubs.size;
		if (!total) return;
		if (!(await api.request("/health") && confirm(`Видалити вибрані об'єкти (${total})?`))) return;
		
		setLoading(true);
		try {
			await api.deleteImages({
				items: [...Array.from(selectedFilenames), ...Array.from(selectedSubs)],
				src: { slug: selectedSource, category: selectedCat.id, subcategory: selectedSub }
			});
			setSelectedFilenames(new Set());
			setSelectedSubs(new Set());
			loadImages();
			loadSubcategories();
		} catch (err) { alert(err.message); }
		finally { setLoading(false); }
	};

	if (!isOpen) return null;

	const allSubs = Array.from(
		new Set([...(selectedCat.subs || []), ...dynamicSubs]),
	);

	return (
		<Modal
			title="Галерея активів"
			onCancel={onClose}
			showFooter={false}
			type="custom">
			<div className="ImageGallery">
				<aside className="ImageGallery__sidebar">
					<button
						className={`SourceBtn ${selectedSource === "general" ? "is-active" : ""} ${dragOverTarget?.id === 'general' ? 'is-drag-over' : ''}`}
						onClick={() => setSelectedSource("general")}
						onDragOver={(e) => {
							e.preventDefault();
							if (dragOverTarget?.id !== 'general') setDragOverTarget({ type: 'source', id: 'general' });
						}}
						onDragLeave={() => setDragOverTarget(null)}
						onDrop={(e) =>
							handleDrop(e, {
								slug: "general",
								category: selectedCat.id,
								subcategory: selectedSub,
							})
						}>
						<Icon name="database" size={16} />
						<span>Загальні</span>
					</button>
					<div className="ImageGallery__sidebar-divider">Кампанії</div>
					{campaigns.map((c) => (
						<button
							key={c.slug}
							className={`SourceBtn ${selectedSource === c.slug ? "is-active" : ""} ${dragOverTarget?.id === c.slug ? 'is-drag-over' : ''}`}
							onClick={() => setSelectedSource(c.slug)}
							onDragOver={(e) => {
								e.preventDefault();
								if (dragOverTarget?.id !== c.slug) setDragOverTarget({ type: 'source', id: c.slug });
							}}
							onDragLeave={() => setDragOverTarget(null)}
							onDrop={(e) =>
								handleDrop(e, {
									slug: c.slug,
									category: selectedCat.id,
									subcategory: selectedSub,
								})
							}>
							<Icon name="map" size={16} />
							<span>{c.name}</span>
						</button>
					))}
				</aside>

				<main className="ImageGallery__main">
					<header className="ImageGallery__tabs">
						{CATEGORIES.map((cat) => (
							<button
								key={cat.id}
								className={`TabBtn ${selectedCat.id === cat.id ? "is-active" : ""} ${dragOverTarget?.id === cat.id ? 'is-drag-over' : ''}`}
								onClick={() => {
									setSelectedCat(cat);
									setSelectedSub(cat.subs ? cat.subs[0] : "");
								}}
								onDragOver={(e) => {
									e.preventDefault();
									if (dragOverTarget?.id !== cat.id) setDragOverTarget({ type: 'cat', id: cat.id });
								}}
								onDragLeave={() => setDragOverTarget(null)}
								onDrop={(e) =>
									handleDrop(e, {
										slug: selectedSource,
										category: cat.id,
										subcategory: "",
									})
								}
							>
								<Icon name={cat.icon} size={14} />
								<span>{cat.label}</span>
							</button>
						))}
					</header>

					<div className="ImageGallery__toolbar">
						<div className="ImageGallery__subtabs">
							{allSubs.map((sub) => {
								const isSelected = selectedSubs.has(sub);
								return (
								<div key={sub} className={`ImageGallery__subtab-wrapper ${isSelected ? 'is-selected' : ''}`}>
									{dynamicSubs.includes(sub) && editingSubName === sub ? (
										<input
											autoFocus
											value={tempSubName}
											onChange={(e) => setTempSubName(e.target.value)}
											onBlur={async () => {
												await handleRenameSub(sub, tempSubName);
											}}
											onKeyDown={async (e) => {
												if (e.key === "Enter") {
													await handleRenameSub(sub, tempSubName);
												} else if (e.key === "Escape") {
													setEditingSubName(null);
												}
											}}
											className="ImageGallery__sub-rename-input"
										/>
									) : (
										<button
											className={`SubTabBtn ${selectedSub === sub ? "is-active" : ""} ${selectedSubs.has(sub) ? 'is-selected' : ''} ${dragOverTarget?.id === sub ? 'is-drag-over' : ''}`}
											onClick={(e) => {
												if (e.ctrlKey || e.metaKey) {
													toggleSelect(sub, 'sub', e);
												} else {
													setSelectedSubs(new Set([sub]));
													setSelectedFilenames(new Set());
												}
											}}
											onDoubleClick={() => {
												setSelectedSub(selectedSub === sub ? "" : sub);
											}}
											draggable
											onDragStart={(e) => handleDragStart(e, sub, 'sub')}
											onDragEnd={handleDragEnd}
											onDragOver={(e) => {
												e.preventDefault();
												if (dragOverTarget?.id !== sub) setDragOverTarget({ type: 'sub', id: sub });
											}}
											onDragLeave={() => setDragOverTarget(null)}
											onDrop={(e) =>
												handleDrop(e, {
													slug: selectedSource,
													category: selectedCat.id,
													subcategory: sub,
												})
											}>
											{sub.toUpperCase()}
										</button>
									)}
								</div>);
							})}
							{selectedSource !== "general" && // Only allow creating subfolders in campaigns
								(isCreatingSub ? (
									<div className="ImageGallery__new-sub">
										<input
											autoFocus
											value={newSubName}
											onChange={(e) => setNewSubName(e.target.value)}
											onKeyDown={(e) => e.key === "Enter" && handleCreateSub()}
											placeholder="Назва..."
										/>
										<Button
											size="small"
											icon="check"
											onClick={handleCreateSub}
										/>
										<Button
											size="small"
											icon="x"
											onClick={() => setIsCreatingSub(false)}
										/>
									</div>
								) : (
									<Button
										variant="ghost"
										size="small"
										icon="plus"
										onClick={() => setIsCreatingSub(true)}
										title="Створити підпапку"
									/>
								))}
						</div>
						<div className="ImageGallery__upload-actions">
							{hasSelection && (
								<Button variant="danger" size="small" icon="trash" onClick={handleBulkDelete}>
									Видалити ({selectedFilenames.size + selectedSubs.size})
								</Button>
							)}
							<label className="UploadBtn">
								<Icon name="plus" size={14} />
								<span>Завантажити</span>
								<input
									type="file"
									multiple
									accept="image/*"
									hidden
									onChange={(e) => handleFileUpload(e.target.files)}
								/>
							</label>
						</div>
					</div>

					<div
						className={`ImageGallery__grid ${isDraggingOver ? "is-dragging" : ""}`}
						onDragOver={(e) => {
							e.preventDefault();
							// Не показуємо оверлей, якщо джерело — та сама папка
							const isSameLocation = dragSource && 
								dragSource.slug === selectedSource && 
								dragSource.category === selectedCat.id && 
								dragSource.subcategory === selectedSub;
							
							if (!isSameLocation) setIsDraggingOver(true);
						}}
						onDragLeave={() => setIsDraggingOver(false)}
						onDrop={(e) =>
							handleDrop(e, {
								slug: selectedSource,
								category: selectedCat.id,
								subcategory: selectedSub,
							})
						}>
						{isDraggingOver && (
							<div className="ImageGallery__drop-overlay">
								<Icon name="import" size={48} />
								<p>Відпустіть, щоб завантажити сюди</p>
							</div>
						)}
						{loading ? (
							<div className="ImageGallery__status">Завантаження...</div>
						) : images.length > 0 ? (
							images.map((img) => (
								<div
									key={img.url}
									className={`ImageGallery__item ${selectedFilenames.has(img.name) ? "is-selected" : ""}`}
									onClick={(e) => {
										if (e.ctrlKey || e.metaKey) {
											toggleSelect(img.name, 'image', e);
										} else {
											setSelectedFilenames(new Set([img.name]));
											setSelectedSubs(new Set());
										}
									}}
									onDoubleClick={() => onSelect?.(img)}
									draggable
									onDragStart={(e) => handleDragStart(e, img.name, 'image')}
									onDragEnd={handleDragEnd}>
									<div className="ImageGallery__image-wrap">
										<img src={img.url} alt="" />
										<div
											className="ImageGallery__checkbox"
											onClick={(e) => toggleSelect(img.name, 'image', e)}>
											<Icon
												name={
													selectedFilenames.has(img.name) ? "check" : "plus"
												}
												size={12}
											/>
										</div>
									</div>
									<span className="ImageGallery__name" title={img.name}>
										{img.name}
									</span>
								</div>
							))
						) : (
							<div className="ImageGallery__status muted">
								Зображень не знайдено
							</div>
						)}
					</div>
				</main>
			</div>
		</Modal>
	);
}
