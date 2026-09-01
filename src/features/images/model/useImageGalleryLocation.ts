import { useMemo, useState } from "react";

import {
	getCampaignIgnoreSourcesList,
} from "../../../entities/reference/index.js";
import { useDebounce } from "../../../shared/lib/index.js";
import { IMAGE_GALLERY_CATEGORIES } from "../imageGalleryConfig.js";
import type {
	ImageGalleryCategory,
	ImageGalleryContentScope,
} from "./contracts.ts";
import { useImageGalleryRuntime } from "./ImageGalleryRuntime.tsx";

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

export function useImageGalleryLocation() {
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
	const [selectedSource, setSelectedSource] = useState("general");
	const [selectedCat, setSelectedCat] = useState<ImageGalleryCategory>(
		IMAGE_GALLERY_CATEGORIES[0],
	);
	const [selectedSub, setSelectedSub] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [contentScope, setContentScope] =
		useState<ImageGalleryContentScope>("local");
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
