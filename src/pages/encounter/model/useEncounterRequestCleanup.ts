import { useEffect, type RefObject } from "react";

export function useEncounterRequestCleanup(
	focusTimeoutRef: RefObject<ReturnType<typeof setTimeout> | null>,
	aiEditControllerRef: RefObject<AbortController | null>,
) {
	useEffect(() => () => {
		if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
		aiEditControllerRef.current?.abort();
	}, []);
}
