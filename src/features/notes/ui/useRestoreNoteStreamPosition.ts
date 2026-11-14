import { useLayoutEffect, useRef } from "react";

/** Keep the selected note in view when switching from one note to the stream. */
export function useRestoreNoteStreamPosition(showAll: boolean, selectedIndex: number) {
	const detailRef = useRef<HTMLDivElement>(null);
	const restoringRef = useRef(false);
	const wasShowingAll = useRef(showAll);

	useLayoutEffect(() => {
		const shouldRestore = showAll && !wasShowingAll.current;
		wasShowingAll.current = showAll;
		const container = detailRef.current;
		if (!shouldRestore || !container || selectedIndex < 0) return;
		let releaseTimer: ReturnType<typeof setTimeout> | undefined;
		const frame = requestAnimationFrame(() => {
			const card = container.querySelector<HTMLElement>(`:scope > [data-note-index="${selectedIndex}"]`);
			if (!card) return;
			const target = Math.max(0, Math.min(
				container.scrollHeight - container.clientHeight,
				container.scrollTop + card.getBoundingClientRect().top - container.getBoundingClientRect().top,
			));
			if (Math.abs(container.scrollTop - target) < 1) return;
			restoringRef.current = true;
			container.scrollTop = target;
			releaseTimer = setTimeout(() => { restoringRef.current = false; }, 250);
		});
		return () => { cancelAnimationFrame(frame); clearTimeout(releaseTimer); restoringRef.current = false; };
	}, [showAll, selectedIndex]);

	return { detailRef, restoringRef };
}
