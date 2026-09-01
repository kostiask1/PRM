import { useEffect, useState } from "react";
import type { SessionScene } from "../../../entities/session/index.js";
import { makeDomId, scrollToHashTarget } from "../../../shared/lib/index.js";
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
	onToggleSceneCollapse: (sceneId: string | number) => void;
	onToggleSceneNotesCollapse: (sceneId: string | number) => void;
	onRevealHistoryTarget?: (hash: string) => void;
}

export function useSessionHashNavigation({
	sessionId,
	isSessionNotesCollapsed,
	sessionNotesForRender,
	sessionLocations,
	sessionNpcs,
	scenes,
	onToggleSectionCollapse,
	onToggleSceneCollapse,
	onToggleSceneNotesCollapse,
	onRevealHistoryTarget,
}: SessionHashNavigationOptions): void {
	const [hashVersion, setHashVersion] = useState(0);
	useEffect(() => {
		const handleHashChange = () => setHashVersion((value) => value + 1);
		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, []);
	useEffect(() => {
		const hash = decodeURIComponent(window.location.hash || "");
		if (
			!hash.includes("history-session-") &&
			shouldExpandSessionNotesFromHash(
			hash,
			isSessionNotesCollapsed,
			)
		) {
			onToggleSectionCollapse("Notes");
		}
		const scene = scenes.find((item) =>
			hash.includes(makeDomId("session", "scene", item.id)),
		);
		if (scene?.collapsed) onToggleSceneCollapse(scene.id);
		if (
			scene?.isNotesCollapsed &&
			hash.includes(makeDomId("session", "scene", scene.id, "note"))
		) {
			onToggleSceneNotesCollapse(scene.id);
		}
		onRevealHistoryTarget?.(hash);
		const timer = window.setTimeout(() => scrollToHashTarget(), 140);
		return () => window.clearTimeout(timer);
	}, [
		isSessionNotesCollapsed,
		hashVersion,
		onToggleSectionCollapse,
		onToggleSceneCollapse,
		onToggleSceneNotesCollapse,
		onRevealHistoryTarget,
		scenes,
		sessionId,
		sessionLocations,
		sessionNotesForRender,
		sessionNpcs,
	]);
}
