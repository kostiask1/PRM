import { useMemo, useState } from "react";

import {
	getCampaignIgnoreSourcesList,
	type CampaignSourceSettings,
} from "../../../entities/reference/index.js";
import { useDebounce } from "../../../shared/lib/index.js";
import { useAppSelector } from "../../../shared/model/index.js";
import { IMAGE_GALLERY_CATEGORIES } from "../imageGalleryConfig.js";
import type {
	ImageGalleryCategory,
	ImageGalleryContentScope,
} from "./contracts.ts";

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
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);
	const activeCampaign = useAppSelector((state) => state.active.campaign);
	const globalIgnoreSourcesList = useAppSelector(
		(state) => state.ui.ignoreSourcesList || [],
	);
	const ignoreSourcesList = useMemo(
		() =>
			getCampaignIgnoreSourcesList(
				activeCampaign as CampaignSourceSettings | null,
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
