import { useEffect, useState } from "react";
import { useDebounce } from "../../../shared/lib/index.js";

export interface UseBestiarySearchControlsOptions {
	initialDetailedSearch: boolean;
	initialSearch: string;
	useSearchDebounce: boolean;
}

export function useBestiarySearchControls({
	initialDetailedSearch,
	initialSearch,
	useSearchDebounce,
}: UseBestiarySearchControlsOptions) {
	const [search, setSearch] = useState(initialSearch);
	const debouncedSearch = useDebounce(search, useSearchDebounce ? 250 : 0);
	const [isDetailedSearch, setIsDetailedSearch] = useState(
		initialDetailedSearch,
	);

	useEffect(() => {
		setSearch(initialSearch);
	}, [initialSearch]);

	useEffect(() => {
		setIsDetailedSearch(Boolean(initialDetailedSearch));
	}, [initialDetailedSearch]);

	return {
		debouncedSearch,
		isDetailedSearch,
		search,
		setIsDetailedSearch,
		setSearch,
	};
}
