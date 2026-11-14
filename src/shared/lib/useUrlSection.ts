import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

/** Keep workspace sections shareable while preserving unrelated query parameters. */
export function useUrlSection<T extends string>(sections: readonly T[], fallback: T) {
	const location = useLocation();
	const navigate = useNavigate();
	const locationRef = useRef(location);
	locationRef.current = location;
	const requested = new URLSearchParams(location.search).get("tab");
	const active = sections.find((section) => section === requested) ?? fallback;

	const navigateToSection = useCallback((section: T, preserveHash = false) => {
		const current = locationRef.current;
		const params = new URLSearchParams(current.search);
		params.set("tab", section);
		const search = `?${params.toString()}`;
		const hash = preserveHash ? current.hash : "";
		if (search === current.search && hash === current.hash) return;
		navigate({ pathname: current.pathname, search, hash }, { replace: preserveHash, state: current.state });
	}, [navigate]);

	const selectSection = useCallback((section: T) => navigateToSection(section), [navigateToSection]);
	const revealSection = useCallback((section: T) => navigateToSection(section, true), [navigateToSection]);
	return [active, selectSection, revealSection] as const;
}
