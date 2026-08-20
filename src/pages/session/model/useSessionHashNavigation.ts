import { useEffect } from "react";
import type { SessionScene } from "../../../entities/session/index.js";
import { scrollToHashTarget } from "../../../shared/lib/index.js";
import type { SharedNote } from "../../../shared/lib/index.js";
import { shouldExpandSessionNotesFromHash } from "./sessionPagePresentation.ts";
import type { SessionPageEntity } from "./sessionEntityModel.ts";

interface SessionHashNavigationOptions {
	sessionId: string | null;
	isSessionNotesCollapsed: boolean;
	sessionNotesForRender: readonly SharedNote[];
	sessionLocations: readonly SessionPageEntity[];
	sessionNpcs: readonly SessionPageEntity[];
	scenes: readonly SessionScene[];
	onToggleSectionCollapse: (section: string) => void;
}

export function useSessionHashNavigation({
	sessionId,
	isSessionNotesCollapsed,
	sessionNotesForRender,
	sessionLocations,
	sessionNpcs,
	scenes,
	onToggleSectionCollapse,
}: SessionHashNavigationOptions): void {
	useEffect(() => {
		if (shouldExpandSessionNotesFromHash(
			window.location.hash,
			isSessionNotesCollapsed,
		)) {
			onToggleSectionCollapse("Notes");
		}
		const timer = window.setTimeout(() => scrollToHashTarget(), 140);
		return () => window.clearTimeout(timer);
	}, [
		isSessionNotesCollapsed,
		onToggleSectionCollapse,
		scenes,
		sessionId,
		sessionLocations,
		sessionNotesForRender,
		sessionNpcs,
	]);
}
