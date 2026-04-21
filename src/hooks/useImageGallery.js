import { useCallback, useEffect, useState } from "react";

import { api } from "../api";
import { useModal } from "../context/ModalContext";

export const IMAGE_GALLERY_CATEGORIES = [
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
	{ id: "notes", label: "Нотатки", icon: "file" },
	{ id: "attachments", label: "Вкладення", icon: "layers" },
];

export default function useImageGallery({
	isOpen,
	initialSource,
	initialCategory,
	initialSubcategory,
}) {
	const modal = useModal();

	const [campaigns, setCampaigns] = useState([]);
	const [selectedSource, setSelectedSource] = useState("general");
	const [selectedCat, setSelectedCat] = useState(IMAGE_GALLERY_CATEGORIES[0]);
	const [selectedSub, setSelectedSub] = useState("");
	const [dynamicSubs, setDynamicSubs] = useState([]);
	const [images, setImages] = useState([]);
	const [selectedFilenames, setSelectedFilenames] = useState(new Set());
	const [selectedSubs, setSelectedSubs] = useState(new Set());
	const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
	const [loading, setLoading] = useState(false);
	const [isCreatingSub, setIsCreatingSub] = useState(false);
	const [newSubName, setNewSubName] = useState("");
	const [isDraggingOver, setIsDraggingOver] = useState(false);
	const [dragSource, setDragSource] = useState(null);
	const [dragOverTarget, setDragOverTarget] = useState(null);
	const hasSelection = selectedFilenames.size > 0 || selectedSubs.size > 0;

	const getCleanName = useCallback((name) => {
		return name.replace(/\.[^/.]+$/, "").replace(/-\d{10,}$/, "");
	}, []);

	const loadSubcategories = useCallback(async () => {
		try {
			const subs = await api.getSubcategories(
				selectedSource,
				selectedCat.id,
				selectedSub,
			);
			setDynamicSubs(subs);
		} catch (err) {
			console.error(err);
		}
	}, [selectedSource, selectedCat.id, selectedSub]);

	const loadImages = useCallback(async () => {
		setLoading(true);
		try {
			const data = await api.getImages(selectedSource, selectedCat.id, selectedSub);
			setImages(data || []);
		} catch (err) {
			console.error("Failed to load images:", err);
			setImages([]);
		} finally {
			setLoading(false);
		}
	}, [selectedSource, selectedCat.id, selectedSub]);

	useEffect(() => {
		if (isOpen) {
			api.listCampaigns().then(setCampaigns);

			if (initialSource) setSelectedSource(initialSource);
			if (initialCategory) {
				const cat = IMAGE_GALLERY_CATEGORIES.find((c) => c.id === initialCategory);
				if (cat) {
					setSelectedCat(cat);
					setSelectedSub(initialSubcategory || "");
				}
			}
		}
	}, [isOpen, initialSource, initialCategory, initialSubcategory]);

	useEffect(() => {
		if (isOpen) {
			loadImages();
			loadSubcategories();
		}
		setSelectedFilenames(new Set());
		setSelectedSubs(new Set());
		setLastSelectedIndex(null);
	}, [selectedSource, selectedCat, selectedSub, isOpen, loadImages, loadSubcategories]);

	const handleFileUpload = useCallback(
		async (files) => {
			setLoading(true);
			try {
				for (const file of Array.from(files || [])) {
					if (!file.type.startsWith("image/")) continue;
					await api.uploadImage(selectedSource, selectedCat.id, selectedSub, file);
				}
				loadImages();
			} catch (err) {
				console.error("Upload failed:", err);
			} finally {
				setLoading(false);
			}
		},
		[selectedSource, selectedCat.id, selectedSub, loadImages],
	);

	const handleDrop = useCallback(
		async (e, dest) => {
			e.preventDefault();
			setIsDraggingOver(false);
			setDragOverTarget(null);
			setDragSource(null);
			setLoading(true);

			try {
				const jsonData = e.dataTransfer.getData("application/json");

				if (jsonData) {
					const data = JSON.parse(jsonData);
					if (!data.items?.length) return;

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
						dest,
					});
					setSelectedFilenames(new Set());
					setSelectedSubs(new Set());
					loadImages();
					loadSubcategories();
				} else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
					await handleFileUpload(e.dataTransfer.files);
					return;
				}
			} catch (err) {
				console.error("Move failed", err);
			} finally {
				setLoading(false);
			}
		},
		[handleFileUpload, loadImages, loadSubcategories],
	);

	const handleCreateSub = useCallback(async () => {
		if (!newSubName.trim()) return;
		try {
			const fullPath = selectedSub ? `${selectedSub}/${newSubName}` : newSubName;
			await api.createSubcategory(selectedSource, selectedCat.id, fullPath);
			setNewSubName("");
			setIsCreatingSub(false);
			loadSubcategories();
			setSelectedSub(fullPath);
		} catch (err) {
			modal?.alert("Помилка", err.message);
		}
	}, [newSubName, selectedSub, selectedSource, selectedCat.id, loadSubcategories, modal]);

	const handleRenameSub = useCallback(
		async (oldName, newName) => {
			if (!newName.trim() || oldName === newName) {
				return;
			}
			try {
				const oldPath = selectedSub ? `${selectedSub}/${oldName}` : oldName;
				const newPath = selectedSub ? `${selectedSub}/${newName}` : newName;

				await api.renameSubcategory(selectedSource, selectedCat.id, oldPath, newPath);
				loadSubcategories();
				loadImages();
				if (selectedSub === oldName) setSelectedSub(newName);
			} catch (err) {
				modal?.alert("Помилка перейменування", err.message);
			}
		},
		[
			selectedSub,
			selectedSource,
			selectedCat.id,
			loadSubcategories,
			loadImages,
			modal,
		],
	);

	const handleRenameImage = useCallback(
		async (oldName, newName) => {
			if (!newName.trim() || oldName === newName) return;
			try {
				await api.renameImage(
					selectedSource,
					selectedCat.id,
					selectedSub,
					oldName,
					newName,
				);
				loadImages();
			} catch (err) {
				modal?.alert("Помилка", err.message);
			}
		},
		[selectedSource, selectedCat.id, selectedSub, loadImages, modal],
	);

	const toggleSelect = useCallback(
		(name, type, e) => {
			e.stopPropagation();
			if (type === "image") {
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
		},
		[selectedFilenames, selectedSubs],
	);

	const handleBulkDelete = useCallback(async () => {
		const total = selectedFilenames.size + selectedSubs.size;
		if (!total) return;

		setLoading(true);
		try {
			const confirmed = modal
				? await modal.confirm("Видалення", `Видалити вибрані об'єкти (${total})?`)
				: confirm(`Видалити вибрані об'єкти (${total})?`);

			if (!confirmed) return;

			await api.deleteImages({
				items: [...Array.from(selectedFilenames), ...Array.from(selectedSubs)],
				src: {
					slug: selectedSource,
					category: selectedCat.id,
					subcategory: selectedSub,
				},
			});
			setSelectedFilenames(new Set());
			setSelectedSubs(new Set());
			loadImages();
			loadSubcategories();
		} catch (err) {
			modal?.alert("Помилка видалення", err.message);
		} finally {
			setLoading(false);
		}
	}, [
		selectedFilenames,
		selectedSubs,
		selectedSource,
		selectedCat.id,
		selectedSub,
		loadImages,
		loadSubcategories,
		modal,
	]);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (!isOpen) return;
			if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

			if (e.key === "Delete") {
				handleBulkDelete();
			} else if (e.key === "Backspace") {
				e.preventDefault();
				if (selectedSub) {
					const parts = selectedSub.split("/").filter(Boolean);
					parts.pop();
					setSelectedSub(parts.join("/"));
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedSub, isOpen, handleBulkDelete]);

	const allSubs = Array.from(
		new Set([...(selectedSub === "" ? selectedCat.subs || [] : []), ...dynamicSubs]),
	);

	const handleItemClick = useCallback(
		(name, type, index, e) => {
			e.stopPropagation();

			if (e.shiftKey && lastSelectedIndex !== null) {
				const start = Math.min(index, lastSelectedIndex);
				const end = Math.max(index, lastSelectedIndex);
				const isAdditive = e.ctrlKey || e.metaKey;
				const nextFilenames = new Set(isAdditive ? selectedFilenames : []);
				const nextSubs = new Set(isAdditive ? selectedSubs : []);

				const combinedItems = [
					...allSubs.map((s) => ({ name: s, type: "sub" })),
					...images.map((i) => ({ name: i.name, type: "image" })),
				];

				for (let i = start; i <= end; i++) {
					const item = combinedItems[i];
					if (item.type === "sub") nextSubs.add(item.name);
					else nextFilenames.add(item.name);
				}

				setSelectedFilenames(nextFilenames);
				setSelectedSubs(nextSubs);
			} else if (e.ctrlKey || e.metaKey) {
				toggleSelect(name, type, e);
				setLastSelectedIndex(index);
			} else {
				const isSelected =
					type === "image"
						? selectedFilenames.has(name)
						: selectedSubs.has(name);
				const totalSelected = selectedFilenames.size + selectedSubs.size;

				if (isSelected && totalSelected === 1) {
					setSelectedFilenames(new Set());
					setSelectedSubs(new Set());
					setLastSelectedIndex(null);
				} else {
					setSelectedFilenames(type === "image" ? new Set([name]) : new Set());
					setSelectedSubs(type === "sub" ? new Set([name]) : new Set());
					setLastSelectedIndex(index);
				}
			}
		},
		[
			allSubs,
			images,
			lastSelectedIndex,
			selectedFilenames,
			selectedSubs,
			toggleSelect,
		],
	);

	const handleDragStart = useCallback(
		(e, item, type = "image") => {
			const itemName = type === "image" ? item.name : item;
			const isSelected =
				type === "image"
					? selectedFilenames.has(itemName)
					: selectedSubs.has(itemName);

			const itemsToMove = isSelected
				? [...Array.from(selectedFilenames), ...Array.from(selectedSubs)]
				: [itemName];

			e.dataTransfer.setData(
				"application/json",
				JSON.stringify({
					items: itemsToMove,
					src: {
						slug: selectedSource,
						category: selectedCat.id,
						subcategory: selectedSub,
					},
				}),
			);
			e.dataTransfer.effectAllowed = "move";
			setDragSource({
				slug: selectedSource,
				category: selectedCat.id,
				subcategory: selectedSub,
			});
		},
		[selectedFilenames, selectedSubs, selectedSource, selectedCat.id, selectedSub],
	);

	const handleDragEnd = useCallback(() => {
		setDragSource(null);
		setDragOverTarget(null);
	}, []);

	return {
		campaigns,
		categories: IMAGE_GALLERY_CATEGORIES,
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
	};
}
