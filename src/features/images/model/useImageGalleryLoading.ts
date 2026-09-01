import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";

import {
	campaignApi,
	type CampaignRecord,
} from "../../../entities/campaign/index.js";
import {
	imageApi,
	type ImageGalleryStats,
} from "../api/imageApi.ts";
import { IMAGE_GALLERY_CATEGORIES } from "../imageGalleryConfig.js";
import type {
	GalleryImage,
	GallerySubcategoryDetailsMap,
	ImageGalleryCategory,
	ImageGalleryContentScope,
	UseImageGalleryOptions,
} from "./contracts.ts";
import {
	loadGalleryImages,
	loadGallerySubcategoryData,
} from "./imageGalleryLoading.ts";

const api = { ...campaignApi, ...imageApi };

interface ImageGalleryLoadingOptions extends UseImageGalleryOptions {
	activeSearchQuery: string;
	contentScope: ImageGalleryContentScope;
	debouncedSearchQuery: string;
	ignoreSourcesList: string[];
	isGeneralTokens: boolean;
	isScopedContent: boolean;
	normalizedSearchQuery: string;
	selectedCat: ImageGalleryCategory;
	selectedSource: string;
	selectedSub: string;
	setSelectedCat: Dispatch<SetStateAction<ImageGalleryCategory>>;
	setSelectedSource: Dispatch<SetStateAction<string>>;
	setSelectedSub: Dispatch<SetStateAction<string>>;
}

export function useImageGalleryLoading({
	activeSearchQuery,
	contentScope,
	debouncedSearchQuery,
	ignoreSourcesList,
	initialCategory,
	initialSource,
	initialSubcategory,
	isGeneralTokens,
	isOpen,
	isScopedContent,
	normalizedSearchQuery,
	selectedCat,
	selectedSource,
	selectedSub,
	setSelectedCat,
	setSelectedSource,
	setSelectedSub,
}: ImageGalleryLoadingOptions) {
	const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
	const [dynamicSubs, setDynamicSubs] = useState<string[]>([]);
	const [subDetails, setSubDetails] = useState<GallerySubcategoryDetailsMap>({});
	const [officialSubs, setOfficialSubs] = useState<Set<string>>(new Set());
	const [officialRootSubs, setOfficialRootSubs] = useState<Set<string>>(new Set());
	const [images, setImages] = useState<GalleryImage[]>([]);
	const [storageStats, setStorageStats] = useState<ImageGalleryStats | null>(null);
	const [loading, setLoading] = useState(false);

	const resetSubcategories = useCallback(() => {
		setDynamicSubs([]);
		setSubDetails({});
		setOfficialSubs(new Set());
		setOfficialRootSubs(new Set());
	}, []);

	const loadSubcategories = useCallback(async () => {
		if (Boolean(normalizedSearchQuery || isScopedContent)) {
			resetSubcategories();
			return;
		}
		try {
			const result = await loadGallerySubcategoryData({
				activeSearchQuery,
				api,
				category: selectedCat.id,
				ignoreSourcesList,
				isGeneralTokens,
				selectedSub,
				selectedSource,
			});
			setOfficialSubs(result.officialSubs);
			setOfficialRootSubs(result.officialRootSubs);
			setSubDetails(result.subDetails);
			setDynamicSubs(result.dynamicSubs);
		} catch (error) {
			console.error(error);
			resetSubcategories();
		}
	}, [
		activeSearchQuery,
		ignoreSourcesList,
		isGeneralTokens,
		isScopedContent,
		normalizedSearchQuery,
		resetSubcategories,
		selectedCat.id,
		selectedSource,
		selectedSub,
	]);

	const loadImages = useCallback(async () => {
		setLoading(true);
		try {
			setImages(
				await loadGalleryImages({
					activeSearchQuery,
					api,
					categories: IMAGE_GALLERY_CATEGORIES.map((category) => category.id),
					category: selectedCat.id,
					contentScope,
					ignoreSourcesList,
					isGeneralTokens,
					isScopedContent,
					normalizedSearchQuery,
					search: debouncedSearchQuery,
					selectedSub,
					selectedSource,
				}),
			);
		} catch (error) {
			console.error("Failed to load images:", error);
			setImages([]);
		} finally {
			setLoading(false);
		}
	}, [
		activeSearchQuery,
		contentScope,
		debouncedSearchQuery,
		ignoreSourcesList,
		isGeneralTokens,
		isScopedContent,
		normalizedSearchQuery,
		selectedCat.id,
		selectedSource,
		selectedSub,
	]);

	const loadStorageStats = useCallback(async () => {
		try {
			const stats = await api.getImageGalleryStats(
				selectedSource,
				selectedCat.id,
				selectedSub,
				IMAGE_GALLERY_CATEGORIES.map((category) => category.id),
			);
			setStorageStats(stats || null);
		} catch (error) {
			console.error("Failed to load image gallery storage stats:", error);
			setStorageStats(null);
		}
	}, [selectedCat.id, selectedSource, selectedSub]);

	useEffect(() => {
		if (!isOpen) return;

		void api.listCampaigns().then((items) => setCampaigns(items || []));
		if (initialSource) setSelectedSource(initialSource);
		if (!initialCategory) return;

		const category = IMAGE_GALLERY_CATEGORIES.find(
			(item) => item.id === initialCategory,
		);
		if (!category) return;
		setSelectedCat(category);
		setSelectedSub(initialSubcategory || "");
	}, [
		initialCategory,
		initialSource,
		initialSubcategory,
		isOpen,
		setSelectedCat,
		setSelectedSource,
		setSelectedSub,
	]);

	return {
		campaigns,
		dynamicSubs,
		images,
		loading,
		loadImages,
		loadStorageStats,
		loadSubcategories,
		officialRootSubs,
		officialSubs,
		setLoading,
		storageStats,
		subDetails,
	};
}
