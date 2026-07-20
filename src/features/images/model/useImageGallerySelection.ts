import {
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useMemo,
	useState,
} from "react";

import type {
	GalleryImage,
	GalleryItemType,
	GalleryMoveGroup,
	ImageGalleryCategory,
} from "./contracts.ts";
import { getGallerySelectionPlan } from "./imageGalleryInteraction.ts";

interface ImageGallerySelectionOptions {
	dynamicSubs: string[];
	images: GalleryImage[];
	isGeneralTokens: boolean;
	isScopedContent: boolean;
	normalizedSearchQuery: string;
	officialRootSubs: Set<string>;
	officialSubs: Set<string>;
	selectedCat: ImageGalleryCategory;
	selectedSource: string;
	selectedSub: string;
}

export function useImageGallerySelection({
	dynamicSubs,
	images,
	isGeneralTokens,
	isScopedContent,
	normalizedSearchQuery,
	officialRootSubs,
	officialSubs,
	selectedCat,
	selectedSource,
	selectedSub,
}: ImageGallerySelectionOptions) {
	const [selectedFilenames, setSelectedFilenames] = useState<Set<string>>(new Set());
	const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
	const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

	const clearSelection = useCallback(() => {
		setSelectedFilenames(new Set());
		setSelectedSubs(new Set());
		setLastSelectedIndex(null);
	}, []);
	const isProtectedSystemSub = useCallback(
		(name: string) =>
			selectedSub === "" &&
			(selectedCat.id === "tokens" || selectedCat.id === "characters") &&
			(name === "players" || name === "npc"),
		[selectedCat.id, selectedSub],
	);
	const isReadonlySub = useCallback(
		(name: string) => isProtectedSystemSub(name) || officialSubs.has(name),
		[isProtectedSystemSub, officialSubs],
	);
	const isOfficialSub = useCallback(
		(name: string) => officialSubs.has(name),
		[officialSubs],
	);
	const isReadonlyImage = useCallback(
		(image?: GalleryImage) => Boolean(image?.readonly),
		[],
	);
	const isReadonlyPath = useCallback(
		(subcategory = "") => {
			const root = String(subcategory || "")
				.split("/")
				.filter(Boolean)[0];
			return Boolean(isGeneralTokens && root && officialRootSubs.has(root));
		},
		[isGeneralTokens, officialRootSubs],
	);
	const selectedSubRoot = selectedSub.split("/").filter(Boolean)[0] || "";
	const isReadonlyCurrentFolder = Boolean(
		isGeneralTokens && selectedSubRoot && isReadonlyPath(selectedSub),
	);
	const selectImageByName = useCallback(
		(name: string) => {
			const image = images.find((item) => item.name === name);
			if (!image) return false;
			setSelectedFilenames(new Set([name]));
			setSelectedSubs(new Set());
			setLastSelectedIndex(null);
			return true;
		},
		[images],
	);
	const hasSelection = useMemo(
		() =>
			images.some(
				(image) => selectedFilenames.has(image.name) && !isReadonlyImage(image),
			) || Array.from(selectedSubs).some((name) => !isReadonlySub(name)),
		[images, isReadonlyImage, isReadonlySub, selectedFilenames, selectedSubs],
	);
	const allSubs = useMemo(
		() =>
			normalizedSearchQuery || isScopedContent
				? []
				: Array.from(
						new Set([
							...(selectedSub === "" ? selectedCat.subs || [] : []),
							...dynamicSubs,
						]),
					),
		[
			dynamicSubs,
			isScopedContent,
			normalizedSearchQuery,
			selectedCat.subs,
			selectedSub,
		],
	);

	const getMovableSelectedItems = useCallback(() => {
		const safeSubs = Array.from(selectedSubs).filter(
			(name) => !isReadonlySub(name),
		);
		const selectedImages = images.filter(
			(image) => selectedFilenames.has(image.name) && !isReadonlyImage(image),
		);
		const imageGroupsMap = new Map<string, GalleryMoveGroup>();
		for (const image of selectedImages) {
			const src = {
				slug: image.source || selectedSource,
				category: image.category || selectedCat.id,
				subcategory: image.subcategory || selectedSub,
			};
			const key = [src.slug, src.category, src.subcategory].join("\u0000");
			const group = imageGroupsMap.get(key) || { src, items: [] };
			group.items.push(image.name);
			imageGroupsMap.set(key, group);
		}
		const imageGroups = Array.from(imageGroupsMap.values());
		const safeFilenames = selectedImages.map((image) => image.name);
		return {
			imageGroups,
			items: [...safeFilenames, ...safeSubs],
			safeFilenames,
			safeSubs,
		};
	}, [
		images,
		isReadonlyImage,
		isReadonlySub,
		selectedCat.id,
		selectedFilenames,
		selectedSource,
		selectedSub,
		selectedSubs,
	]);

	const toggleSelect = useCallback(
		(name: string, type: GalleryItemType, event: ReactMouseEvent) => {
			event.stopPropagation();
			if (type === "image") {
				const image = images.find((item) => item.name === name);
				if (isReadonlyImage(image)) return;
				const next = new Set(selectedFilenames);
				if (next.has(name)) next.delete(name);
				else next.add(name);
				setSelectedFilenames(next);
				return;
			}
			if (isReadonlySub(name)) return;
			const next = new Set(selectedSubs);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			setSelectedSubs(next);
		},
		[images, isReadonlyImage, isReadonlySub, selectedFilenames, selectedSubs],
	);

	const handleItemClick = useCallback(
		(name: string, type: GalleryItemType, index: number, event: ReactMouseEvent) => {
			event.stopPropagation();
			const plan = getGallerySelectionPlan({
				allSubs,
				filenames: selectedFilenames,
				images,
				index,
				isAdditive: event.ctrlKey || event.metaKey,
				isReadonlyImage,
				isReadonlySub,
				isShift: event.shiftKey,
				lastIndex: lastSelectedIndex,
				name,
				subfolders: selectedSubs,
				type,
			});
			if (!plan) return;
			setSelectedFilenames(plan.filenames);
			setSelectedSubs(plan.subfolders);
			setLastSelectedIndex(plan.lastIndex);
		},
		[
			allSubs,
			images,
			isReadonlyImage,
			isReadonlySub,
			lastSelectedIndex,
			selectedFilenames,
			selectedSubs,
		],
	);

	return {
		allSubs,
		clearSelection,
		getMovableSelectedItems,
		handleItemClick,
		hasSelection,
		isOfficialSub,
		isProtectedSystemSub,
		isReadonlyCurrentFolder,
		isReadonlyImage,
		isReadonlyPath,
		isReadonlySub,
		selectImageByName,
		selectedFilenames,
		selectedSubs,
		setSelectedFilenames,
		setSelectedSubs,
		toggleSelect,
	};
}
