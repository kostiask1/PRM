import React from "react";
import Modal from "./common/Modal";
import Icon from "./common/Icon";
import "../assets/components/ImageGallery.css";
import { prompt } from "../actions/app";
import Button from "./form/Button";
import useImageGallery from "../hooks/useImageGallery";
import ImageTargetSettings from "./ImageTargetSettings";
import { api } from "../api";
import Tooltip from "./common/Tooltip";
import classNames from "../utils/classNames";
import { useAppDispatch } from "../store/appStore";

const SUB_LABELS = {
	npc: "NPC",
	players: "Гравці",
};

const SUB_ICON_NAMES = {
	npc: "folder-npc",
	players: "folder-players",
};

function ImageGallery({
	isOpen,
	onClose,
	onSelect,
	initialSource,
	initialCategory,
	initialSubcategory,
}) {
	const dispatch = useAppDispatch();
	const [isMoveModalOpen, setIsMoveModalOpen] = React.useState(false);
	const [moveTarget, setMoveTarget] = React.useState({
		slug: "general",
		category: "attachments",
		subcategory: "",
	});
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
		handleMoveSelection,
		handleFileUpload,
		handleDrop,
		handleItemClick,
		toggleSelect,
		handleRenameSub,
		handleDragStart,
		handleDragEnd,
		getCleanName,
		handleRenameImage,
		isProtectedSystemSub,
	} = useImageGallery({
		isOpen,
		initialSource,
		initialCategory,
		initialSubcategory,
	});
	if (!isOpen) return null;

	const availableSources = [{ slug: "general", name: "Загальні" }, ...campaigns];

	const openMoveModal = () => {
		setMoveTarget({
			slug: selectedSource,
			category: selectedCat.id,
			subcategory: selectedSub,
		});
		setIsMoveModalOpen(true);
	};

	return (
		<Modal
			title="Галерея активів"
			onCancel={onClose}
			showFooter={false}
			type="custom">
			<div className="ImageGallery">
				<aside className="ImageGallery__sidebar">
					<button
						className={classNames("SourceBtn", {
							"is-active": selectedSource === "general",
							"is-drag-over": dragOverTarget?.id === "general",
						})}
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
							className={classNames("SourceBtn", {
								"is-active": selectedSource === c.slug,
								"is-drag-over": dragOverTarget?.id === c.slug,
							})}
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
								className={classNames("TabBtn", {
									"is-active": selectedCat.id === cat.id,
									"is-drag-over": dragOverTarget?.id === cat.id,
								})}
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
								className={classNames("BreadcrumbItem", {
									"is-active": selectedSub === "",
									"is-drag-over":
										dragOverTarget?.type === "breadcrumb" &&
										dragOverTarget?.id === "__root__",
								})}
								onClick={() => setSelectedSub("")}
								onDragOver={(e) => {
									e.preventDefault();
									setDragOverTarget({ type: "breadcrumb", id: "__root__" });
								}}
								onDragLeave={() => setDragOverTarget(null)}
								onDrop={(e) =>
									handleDrop(e, {
										slug: selectedSource,
										category: selectedCat.id,
										subcategory: "",
									})
								}>
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
										{(() => {
											const breadcrumbPath = arr.slice(0, idx + 1).join("/");
											return (
										<button
											className={classNames("BreadcrumbItem", {
												"is-active": idx === arr.length - 1,
												"is-drag-over":
													dragOverTarget?.type === "breadcrumb" &&
													dragOverTarget?.id === breadcrumbPath,
											})}
											onClick={() => {
												setSelectedSub(breadcrumbPath);
											}}
											onDragOver={(e) => {
												e.preventDefault();
												setDragOverTarget({
													type: "breadcrumb",
													id: breadcrumbPath,
												});
											}}
											onDragLeave={() => setDragOverTarget(null)}
											onDrop={(e) =>
												handleDrop(e, {
													slug: selectedSource,
													category: selectedCat.id,
													subcategory: breadcrumbPath,
												})
											}>
											{SUB_LABELS[part] || part}
										</button>
											);
										})()}
									</React.Fragment>
								))}
							<Icon name="chevron" size={10} className="BreadcrumbSeparator" />
							<div className="ImageGallery__new-sub">
								{isCreatingSub ? (
									<>
										<input
											autoFocus
											value={newSubName}
											onChange={(e) => setNewSubName(e.target.value)}
											onKeyDown={(e) => e.key === "Enter" && handleCreateSub()}
											placeholder="Назва папки..."
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
									</>
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
						</div>
						<div className="ImageGallery__upload-actions">
							{hasSelection && (
								<>
									<Button
										variant="ghost"
										size="small"
										icon="move"
										onClick={openMoveModal}>
										Перемістити ({selectedFilenames.size + selectedSubs.size})
									</Button>
									<Button
										className="ImageGallery__deleteBtn"
										variant="danger"
										size="small"
										icon="trash"
										onClick={handleBulkDelete}>
										Видалити ({selectedFilenames.size + selectedSubs.size})
									</Button>
								</>
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
						className={classNames("ImageGallery__grid", {
							"is-dragging": isDraggingOver,
						})}
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
							allSubs.map((sub, index) => {
								const isProtected = isProtectedSystemSub(sub);
								const folderIcon = SUB_ICON_NAMES[sub] || "folder";
								return (
								<div
									key={sub}
									className={classNames(
										"ImageGallery__item",
										"ImageGallery__item--folder",
										{
											"is-selected": selectedSubs.has(sub),
											"is-drag-over": dragOverTarget?.id === sub,
											"is-protected": isProtected,
										},
									)}
									onClick={(e) => {
										if (isProtected) return;
										handleItemClick(sub, "sub", index, e);
									}}
									onDoubleClick={() => {
										const nextPath = selectedSub
											? `${selectedSub}/${sub}`
											: sub;
										setSelectedSub(nextPath);
									}}
									onContextMenu={async (e) => {
										if (isProtected) return;
										e.preventDefault();
																				const newName = await dispatch(
																					prompt({
																						title: "Перейменувати папку",
																						message: "Введіть нову назву:",
																						defaultValue: sub,
																					}),
																				);
										if (newName) handleRenameSub(sub, newName);
									}}
									draggable={!isProtected}
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
										<Icon name={folderIcon} size={48} />
										{!isProtected && (
											<div
												className="ImageGallery__checkbox"
												onClick={(e) => toggleSelect(sub, "sub", e)}>
												<Icon
													name={selectedSubs.has(sub) ? "check" : "plus"}
													size={12}
												/>
											</div>
										)}
									</div>
									<span className="ImageGallery__name">
										{SUB_LABELS[sub] || sub}
									</span>
								</div>
								);
							})}

						{!loading &&
							images.length > 0 &&
							images.map((img, index) => (
								<div
									key={img.url}
									className={classNames("ImageGallery__item", {
										"is-selected": selectedFilenames.has(img.name),
									})}
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
																				const currentClean = getCleanName(img.name);
										const newBaseName = await dispatch(
											prompt({
												title: "Перейменувати файл",
												message: "Введіть нову назву:",
												defaultValue: currentClean,
											}),
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
												name={
													selectedFilenames.has(img.name) ? "check" : "plus"
												}
												size={12}
											/>
										</div>
									</div>
									<Tooltip content={img.name}>
										<span className="ImageGallery__name">
											{getCleanName(img.name)}
										</span>
									</Tooltip>
								</div>
							))}
					</div>
				</main>
			</div>

			{isMoveModalOpen && (
				<Modal
					title="Перемістити обрані об'єкти"
					onCancel={() => setIsMoveModalOpen(false)}
					onConfirm={async () => {
						const moved = await handleMoveSelection(moveTarget);
						if (moved) setIsMoveModalOpen(false);
					}}
					confirmLabel="Перемістити">
					<ImageTargetSettings
						sources={availableSources.map((source) => ({
							id: source.slug,
							label: source.name,
							icon: source.slug === "general" ? "database" : "map",
						}))}
						categories={categories}
						value={{
							source: moveTarget.slug,
							category: moveTarget.category,
							subcategory: moveTarget.subcategory,
						}}
						onChange={(next) =>
							setMoveTarget({
								slug: next.source,
								category: next.category,
								subcategory: next.subcategory || "",
							})
						}
						loadSubcategories={({ source, category, subcategory }) =>
							api.getSubcategories(source, category, subcategory)
						}
						createSubcategory={({ source, category, fullPath }) =>
							api.createSubcategory(source, category, fullPath)
						}
					/>
				</Modal>
			)}
		</Modal>
	);
}

export { ImageGallery };
export default ImageGallery;



