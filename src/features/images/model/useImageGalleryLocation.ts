import { useMemo, useState } from "react";

import {
	getCampaignIgnoreSourcesList,
} from "../../../entities/reference/index.js";
import { useDebounce } from "../../../shared/lib/index.js";
import { ALL_GALLERY_CATEGORY, IMAGE_GALLERY_CATEGORIES } from "../imageGalleryConfig.js";
import type {
	ImageGalleryCategory,
	ImageGalleryContentScope,
} from "./contracts.ts";
import { useImageGalleryRuntime } from "./ImageGalleryRuntime.tsx";
import { getGalleryEffectiveScope } from "./imageGalleryLoading.ts";

function deriveGallerySearchState(
	searchQuery: string,
	debouncedSearchQuery: string,
	contentScope: ImageGalleryContentScope,
) {
	const normalizedSearchQuery = searchQuery.trim()
		? debouncedSearchQuery.trim().toLowerCase()
		: "";
	const isScopedContent = contentScope !== "local";

	return {
		activeSearchQuery: normalizedSearchQuery ? debouncedSearchQuery : "",
		isGlobalSearch: contentScope === "all",
		isScopedContent,
		isSearchResults: Boolean(normalizedSearchQuery || isScopedContent),
		normalizedSearchQuery,
	};
}

export function useImageGalleryLocation({ initialSource, initialCategory, initialSubcategory }: {
	initialSource?: string;
	initialCategory?: string;
	initialSubcategory?: string;
} = {}) {
	const {
		activeCampaign,
		globalIgnoreSourcesList,
		useSearchDebounce,
	} = useImageGalleryRuntime();
	const ignoreSourcesList = useMemo(
		() =>
			getCampaignIgnoreSourcesList(
				activeCampaign,
				globalIgnoreSourcesList,
			),
		[activeCampaign, globalIgnoreSourcesList],
	);
	const [selectedSource, setSelectedSource] = useState(initialSource || "general");
	const [selectedCat, setSelectedCat] = useState<ImageGalleryCategory>(
		IMAGE_GALLERY_CATEGORIES.find((category) => category.id === initialCategory) || IMAGE_GALLERY_CATEGORIES[0],
	);
	const [selectedSub, setSelectedSub] = useState(initialCategory && IMAGE_GALLERY_CATEGORIES.some((category) => category.id === initialCategory) ? initialSubcategory || "" : "");
	const [searchQuery, setSearchQuery] = useState("");
	const [requestedContentScope, setContentScope] =
		useState<ImageGalleryContentScope>("local");
	const isAllCategory = selectedCat.id === ALL_GALLERY_CATEGORY.id;
	const contentScope = getGalleryEffectiveScope(selectedCat.id, requestedContentScope);
	const debouncedSearchQuery = useDebounce(
		searchQuery,
		useSearchDebounce ? 250 : 0,
	);
	const searchState = deriveGallerySearchState(
		searchQuery,
		debouncedSearchQuery,
		contentScope,
	);
	const isGeneralTokens =
		selectedSource === "general" && selectedCat.id === "tokens";

	return {
		contentScope,
		debouncedSearchQuery,
		ignoreSourcesList,
		isGeneralTokens,
		isAllCategory,
		searchQuery,
		selectedCat,
		selectedSource,
		selectedSub,
		setContentScope,
		setSearchQuery,
		setSelectedCat,
		setSelectedSource,
		setSelectedSub,
		...searchState,
	};
}
