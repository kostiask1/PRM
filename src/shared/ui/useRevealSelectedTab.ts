import { useEffect, useRef } from "react";

export function useRevealSelectedTab(value: string) {
	const tabsRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const container = tabsRef.current;
		if (!container) return;
		const reveal = () => {
			const selected = container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
			if (!selected) return;
			const bounds = container.getBoundingClientRect();
			const tabBounds = selected.getBoundingClientRect();
			if (tabBounds.left < bounds.left) container.scrollLeft += tabBounds.left - bounds.left;
			else if (tabBounds.right > bounds.right) container.scrollLeft += tabBounds.right - bounds.right;
		};
		reveal();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(reveal);
		observer.observe(container);
		return () => observer.disconnect();
	}, [value]);
	return tabsRef;
}
