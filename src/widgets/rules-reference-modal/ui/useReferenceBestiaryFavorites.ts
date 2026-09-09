import { useEffect, type Dispatch, type SetStateAction } from "react";

import {
	bestiaryApi,
	type BestiaryFavorite,
} from "../../../entities/bestiary/index.js";
import { isAbortError } from "../../../shared/api/index.ts";
import { lang } from "../../../shared/lib/index.js";
import type { RulesReferenceModalRuntime } from "./RulesReferenceModalRuntime.tsx";

interface UseReferenceBestiaryFavoritesOptions {
	isActive: boolean;
	reportError: RulesReferenceModalRuntime["reportError"];
	setFavorites: Dispatch<SetStateAction<BestiaryFavorite[]>>;
}

export function useReferenceBestiaryFavorites({
	isActive,
	reportError,
	setFavorites,
}: UseReferenceBestiaryFavoritesOptions): void {
	useEffect(() => {
		if (!isActive) return;
		const controller = new AbortController();

		void bestiaryApi
			.getBestiaryFavorites({ signal: controller.signal })
			.then((favorites) => {
				if (!controller.signal.aborted) {
					setFavorites(Array.isArray(favorites) ? favorites : []);
				}
			})
			.catch((error) => {
				if (isAbortError(error)) return;
				reportError({
					title: lang.t("Error"),
					message: error instanceof Error ? error.message : String(error),
				});
			});

		return () => controller.abort();
	}, [isActive, reportError, setFavorites]);
}
