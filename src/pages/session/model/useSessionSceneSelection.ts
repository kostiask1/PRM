import { useEffect, useRef, useState } from "react";
import type { SessionScene } from "../../../entities/session/index.js";
import { matchesHistoryTargetId } from "../../../entities/history/index.js";
import { makeDomId } from "../../../shared/lib/index.js";

function matchesSceneHash(scene: SessionScene, hash: string): boolean {
	return matchesHistoryTargetId(hash, "session", "scene", scene.id)
		|| hash === `#${makeDomId("session", "scene", scene.id)}`
		|| (scene.notes || []).some((note) => matchesHistoryTargetId(hash, "session", "scene-note", scene.id, note.id)
			|| hash === `#${makeDomId("session", "scene", scene.id, "note", note.id)}`);
}

export function useSessionSceneSelection(scenes: SessionScene[], sessionKey: string | null) {
	const [selection, setSelection] = useState<{ sessionKey: string | null; id: SessionScene["id"] | null }>({ sessionKey, id: null });
	const previous = useRef({ sessionKey, ids: scenes.map((scene) => scene.id) });
	const lastHash = useRef<string | null>(null);
	const selectScene = (scene: SessionScene) => setSelection({ sessionKey, id: scene.id });
	const selectedScene = scenes.find((scene) => selection.sessionKey === sessionKey && selection.id !== null && String(scene.id) === String(selection.id)) || scenes[0];
	useEffect(() => {
		const reveal = () => {
			const hash = decodeURIComponent(window.location.hash || "");
			const key = `${sessionKey}:${hash}`;
			if (key === lastHash.current) return;
			const target = scenes.find((scene) => matchesSceneHash(scene, hash));
			if (target) { lastHash.current = key; setSelection({ sessionKey, id: target.id }); }
		};
		reveal();
		window.addEventListener("hashchange", reveal);
		return () => window.removeEventListener("hashchange", reveal);
	}, [scenes, sessionKey]);
	useEffect(() => {
		if (previous.current.sessionKey === sessionKey) {
			const added = scenes.find((scene) => !previous.current.ids.some((id) => String(id) === String(scene.id)));
			const hash = decodeURIComponent(window.location.hash || "");
			const isInitialHashTarget = previous.current.ids.length === 0 && scenes.some((scene) => matchesSceneHash(scene, hash));
			if (added && !isInitialHashTarget) setSelection({ sessionKey, id: added.id });
		}
		previous.current = { sessionKey, ids: scenes.map((scene) => scene.id) };
	}, [scenes, sessionKey]);
	return { selectedScene, selectScene };
}
