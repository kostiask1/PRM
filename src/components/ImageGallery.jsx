import React from "react";
import Modal from "./Modal";
import Icon from "./Icon";
import "../assets/components/ImageGallery.css";
import Button from "./Button";
import useImageGallery from "../hooks/useImageGallery";
import { useModal } from "../context/ModalContext";

const SUB_LABELS = {
	npc: "NPC",
	players: "Гравці",
};

function ImageGallery({
	isOpen,
	onClose,
	onSelect,
	initialSource,
	initialCategory,
	initialSubcategory,
}) {
	const modal = useModal();
	const {
		campaigns,
		categories,
		selectedSource,
		setSelectedSource,
		selectedCat,
		setSelectedCat,
		selectedSub,
		setSelectedSub,
		images,
		selectedFilenames,
		selectedSubs,
		loading,
		isCreatingSub,
		setIsCreatingSub,
		newSubName,
		setNewSubName,
		isDraggingOver,
		setIsDraggingOver,
		dragSource,
		dragOverTarget,
		setDragOverTarget,
		hasSelection,
		allSubs,
		handleCreateSub,
		handleBulkDelete,
		handleFileUpload,
		handleDrop,
		handleItemClick,
		toggleSelect,
		handleRenameSub,
		handleDragStart,
		handleDragEnd,
		getCleanName,
		handleRenameImage,
	} = useImageGallery({
		isOpen,
		initialSource,
		initialCategory,
		initialSubcategory,
	});
	if (!isOpen) return null;

	return (
		<Modal
			title="Галерея активів"
			onCancel={onClose}
			showFooter={false}
			type="custom">
			<div className="ImageGallery">
				<aside className="ImageGallery__sidebar">
					<button
						className={`SourceBtn ${selectedSource === "general" ? "is-active" : ""} ${dragOverTarget?.id === "general" ? "is-drag-over" : ""}`}
						onClick={() => setSelectedSource("general")}
						onDragOver={(e) => {
							e.preventDefault();
							if (dragOverTarget?.id !== "general") {
								setDragOverTarget({ type: "source", id: "general" });
							}
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
							className={`SourceBtn ${selectedSource === c.slug ? "is-active" : ""} ${dragOverTarget?.id === c.slug ? "is-drag-over" : ""}`}
							onClick={() => setSelectedSource(c.slug)}
							onDragOver={(e) => {
								e.preventDefault();
								if (dragOverTarget?.id !== c.slug) {
									setDragOverTarget({ type: "source", id: c.slug });
								}
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
						{categories.map((cat) => (
							<button
								key={cat.id}
								className={`TabBtn ${selectedCat.id === cat.id ? "is-active" : ""} ${dragOverTarget?.id === cat.id ? "is-drag-over" : ""}`}
								onClick={() => {
									setSelectedCat(cat);
									setSelectedSub("");
								}}
								onDragOver={(e) => {
									e.preventDefault();
									if (dragOverTarget?.id !== cat.id) {
										setDragOverTarget({ type: "cat", id: cat.id });
									}
								}}
								onDragLeave={() => setDragOverTarget(null)}
								onDrop={(e) =>
									handleDrop(e, {
										slug: selectedSource,
										category: cat.id,
										subcategory: "",
									})
								}>
								<Icon name={cat.icon} size={14} />
								<span>{cat.label}</span>
							</button>
						))}
					</header>

					<div className="ImageGallery__toolbar">
						<div className="ImageGallery__breadcrumbs">
							<button
								className={`BreadcrumbItem ${selectedSub === "" ? "is-active" : ""}`}
								onClick={() => setSelectedSub("")}>
								<Icon name="home" size={14} />
							</button>
							{selectedSub
								.split("/")
								.filter(Boolean)
								.map((part, idx, arr) => (
									<React.Fragment key={idx}>
										<Icon
											name="chevron"
											size={10}
											className="BreadcrumbSeparator"
										/>
										<button
											className={`BreadcrumbItem ${idx === arr.length - 1 ? "is-active" : ""}`}
											onClick={() => {
												const newPath = arr.slice(0, idx + 1).join("/");
												setSelectedSub(newPath);
											}}>
											{SUB_LABELS[part] || part}
										</button>
									</React.Fragment>
								))}
						</div>

						<div className="ImageGallery__actions">
							{isCreatingSub ? (
								<div className="ImageGallery__new-sub">
									<input
										autoFocus
										value={newSubName}
										onChange={(e) => setNewSubName(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && handleCreateSub()}
										placeholder="Назва папки..."
									/>
									<Button size="small" icon="check" onClick={handleCreateSub} />
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
							)}
						</div>
						<div className="ImageGallery__upload-actions">
							{hasSelection && (
								<Button
									className="ImageGallery__deleteBtn"
									variant="danger"
									size="small"
									icon="trash"
									onClick={handleBulkDelete}>
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
							const isSameLocation =
								dragSource &&
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

						{!loading &&
							allSubs.map((sub, index) => (
								<div
									key={sub}
									className={`ImageGallery__item ImageGallery__item--folder ${selectedSubs.has(sub) ? "is-selected" : ""} ${dragOverTarget?.id === sub ? "is-drag-over" : ""}`}
									onClick={(e) => handleItemClick(sub, "sub", index, e)}
									onDoubleClick={() => {
										const nextPath = selectedSub ? `${selectedSub}/${sub}` : sub;
										setSelectedSub(nextPath);
									}}
									onContextMenu={async (e) => {
										e.preventDefault();
										if (!modal) return;
										const newName = await modal.prompt(
											"Перейменувати папку",
											"Введіть нову назву:",
											sub,
										);
										if (newName) handleRenameSub(sub, newName);
									}}
									draggable
									onDragStart={(e) => handleDragStart(e, sub, "sub")}
									onDragEnd={handleDragEnd}
									onDragOver={(e) => {
										e.preventDefault();
										if (dragOverTarget?.id !== sub) {
											setDragOverTarget({ type: "sub", id: sub });
										}
									}}
									onDragLeave={() => setDragOverTarget(null)}
									onDrop={(e) => {
										const destSub = selectedSub ? `${selectedSub}/${sub}` : sub;
										handleDrop(e, {
											slug: selectedSource,
											category: selectedCat.id,
											subcategory: destSub,
										});
									}}>
									<div className="ImageGallery__image-wrap">
										<Icon name="folder" size={48} />
										<div
											className="ImageGallery__checkbox"
											onClick={(e) => toggleSelect(sub, "sub", e)}>
											<Icon
												name={selectedSubs.has(sub) ? "check" : "plus"}
												size={12}
											/>
										</div>
									</div>
									<span className="ImageGallery__name">{SUB_LABELS[sub] || sub}</span>
								</div>
							))}

						{!loading &&
							images.length > 0 &&
							images.map((img, index) => (
								<div
									key={img.url}
									className={`ImageGallery__item ${selectedFilenames.has(img.name) ? "is-selected" : ""}`}
									onClick={(e) =>
										handleItemClick(
											img.name,
											"image",
											allSubs.length + index,
											e,
										)
									}
									onDoubleClick={() => onSelect?.(img)}
									onContextMenu={async (e) => {
										e.preventDefault();
										if (!modal) return;
										const currentClean = getCleanName(img.name);
										const newBaseName = await modal.prompt(
											"Перейменувати файл",
											"Введіть нову назву:",
											currentClean,
										);
										if (newBaseName && newBaseName !== currentClean) {
											const ext = img.name.split(".").pop();
											handleRenameImage(img.name, `${newBaseName}.${ext}`);
										}
									}}
									draggable
									onDragStart={(e) => handleDragStart(e, img, "image")}
									onDragEnd={handleDragEnd}>
									<div className="ImageGallery__image-wrap">
										<img src={img.url} alt="" />
										<div
											className="ImageGallery__checkbox"
											onClick={(e) => toggleSelect(img.name, "image", e)}>
											<Icon
												name={selectedFilenames.has(img.name) ? "check" : "plus"}
												size={12}
											/>
										</div>
									</div>
									<span className="ImageGallery__name" title={img.name}>
										{getCleanName(img.name)}
									</span>
								</div>
							))}
					</div>
				</main>
			</div>
		</Modal>
	);
}

export { ImageGallery };
export default ImageGallery;
