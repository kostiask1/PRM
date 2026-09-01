import { useRef, useState } from "react";

export function useEncounterGridFocus(
	representativeByInstanceId: ReadonlyMap<string, string>,
) {
	const [focusedMonsterId, setFocusedMonsterId] = useState<string | null>(null);
	const gridItemRefs = useRef(new Map<string, HTMLDivElement>());
	const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const setGridItemRef = (instanceId: string, node: HTMLDivElement | null) => {
		if (node) {
			gridItemRefs.current.set(instanceId, node);
		} else {
			gridItemRefs.current.delete(instanceId);
		}
	};

	const focusMonsterInGrid = (instanceId: string) => {
		const representativeId =
			representativeByInstanceId.get(instanceId) || instanceId;
		const node = gridItemRefs.current.get(representativeId);
		if (node) {
			node.scrollIntoView({ behavior: "auto", block: "center" });
		}
		setFocusedMonsterId(representativeId);
		if (focusTimeoutRef.current) {
			clearTimeout(focusTimeoutRef.current);
		}
		focusTimeoutRef.current = setTimeout(() => {
			setFocusedMonsterId((current) =>
				current === representativeId ? null : current,
			);
		}, 1800);
	};

	return {
		focusTimeoutRef,
		focusedMonsterId,
		focusMonsterInGrid,
		setGridItemRef,
	};
}
