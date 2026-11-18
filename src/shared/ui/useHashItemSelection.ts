import { useCallback, useEffect, useRef, useState } from "react";

export interface ListScrollVisibilityInput {
	listTop: number;
	listBottom: number;
	listScrollTop: number;
	listScrollHeight: number;
	listClientHeight: number;
	itemTop: number;
	itemBottom: number;
}

export function getScrollTopForVisibleListItem({
	listTop,
	listBottom,
	listScrollTop,
	listScrollHeight,
	listClientHeight,
	itemTop,
	itemBottom,
}: ListScrollVisibilityInput): number | null {
	if (listScrollHeight <= listClientHeight) return null;
	if (itemTop < listTop) {
		return Math.max(0, listScrollTop - (listTop - itemTop));
	}
	if (itemBottom > listBottom) {
		const maxScrollTop = Math.max(0, listScrollHeight - listClientHeight);
		return Math.min(maxScrollTop, listScrollTop + (itemBottom - listBottom));
	}
	return null;
}

function scrollListItemIntoViewIfNeeded(
	listElement: HTMLElement | null | undefined,
	activeIndex: number,
): void {
	if (!listElement || activeIndex < 0) return;
	const listItem = listElement.children[activeIndex];
	if (!(listItem instanceof HTMLElement)) return;
	const listRect = listElement.getBoundingClientRect();
	const itemRect = listItem.getBoundingClientRect();
	const nextScrollTop = getScrollTopForVisibleListItem({
		listTop: listRect.top,
		listBottom: listRect.bottom,
		listScrollTop: listElement.scrollTop,
		listScrollHeight: listElement.scrollHeight,
		listClientHeight: listElement.clientHeight,
		itemTop: itemRect.top,
		itemBottom: itemRect.bottom,
	});
	if (nextScrollTop !== null) {
		listElement.scrollTop = nextScrollTop;
	}
}

export function getActiveScrollItemIndex(
	cardTops: readonly number[],
	thresholdTop: number,
	offset = 24,
): number {
	if (cardTops.length === 0) return -1;
	let activeIndex = 0;
	for (let index = 0; index < cardTops.length; index += 1) {
		if (cardTops[index] <= thresholdTop + offset) {
			activeIndex = index;
		}
	}
	return activeIndex;
}

export function useHashItemSelection<T>(
	items: readonly T[],
	getKey: (item: T, index: number) => string,
	matchesHash: (item: T, hash: string) => boolean,
	matchesPreviousKey?: (item: T, key: string) => boolean,
	selectionRequest?: { id: string | number } | null,
	detailRef?: { readonly current: HTMLElement | null } | null,
) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [hash, setHash] = useState(() => typeof window === "undefined" ? "" : window.location.hash);
	const appliedHash = useRef("");
	const manualSelectUntilRef = useRef(0);
	const itemsRef = useRef(items);
	const getKeyRef = useRef(getKey);
	itemsRef.current = items;
	getKeyRef.current = getKey;
	const selectKey = useCallback((key: string | null) => {
		manualSelectUntilRef.current = Date.now() + 1000;
		setSelectedKey(key);
	}, []);
	useEffect(() => { if (selectionRequest) setSelectedKey(String(selectionRequest.id)); }, [selectionRequest]);
	useEffect(() => {
		const update = () => setHash(window.location.hash);
		window.addEventListener("hashchange", update);
		return () => window.removeEventListener("hashchange", update);
	}, []);
	useEffect(() => {
		if (!hash) { appliedHash.current = ""; return; }
		if (appliedHash.current === hash) return;
		const index = items.findIndex((item) => matchesHash(item, hash));
		if (index < 0) return;
		appliedHash.current = hash;
		setSelectedKey(getKey(items[index], index));
	}, [hash, items, getKey, matchesHash]);
	useEffect(() => {
		if (selectedKey !== null || selectionRequest || items.length === 0) return;
		if (hash && items.some((item) => matchesHash(item, hash))) return;
		setSelectedKey(getKey(items[0], 0));
	}, [items, getKey, hash, matchesHash, selectedKey, selectionRequest]);
	const selectedIndex = items.findIndex((item, index) => selectedKey !== null && (getKey(item, index) === selectedKey || matchesPreviousKey?.(item, selectedKey)));
	const selected = items[selectedIndex < 0 ? 0 : selectedIndex];
	useEffect(() => {
		if (selectedIndex < 0 || selectedKey === null) return;
		const currentKey = getKey(items[selectedIndex], selectedIndex);
		if (currentKey !== selectedKey) setSelectedKey(currentKey);
	}, [items, getKey, selectedIndex, selectedKey]);
	useEffect(() => {
		if (!detailRef) return undefined;
		const handleScroll = (event: Event) => {
			if (Date.now() < manualSelectUntilRef.current) return;
			const container = detailRef.current;
			const currentItems = itemsRef.current;
			if (!container || currentItems.length === 0 || container.getClientRects().length === 0) return;
			if (event.target instanceof Node && event.target !== document && !event.target.contains(container)) return;
			const cards = Array.from(container.children).filter(
				(child): child is HTMLElement => child instanceof HTMLElement,
			);
			if (cards.length === 0) return;
			const listSibling = container.parentElement?.querySelector<HTMLElement>(
				".CampaignEntitySection__list, .CampaignNotesSection__list",
			);
			const scrollParent = container.closest<HTMLElement>(".Panel__body");
			const isBottom = scrollParent
				? scrollParent.scrollTop + scrollParent.clientHeight >= scrollParent.scrollHeight - 24
				: typeof window !== "undefined" && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
			const thresholdTop = Math.max(
				container.getBoundingClientRect().top,
				listSibling ? listSibling.getBoundingClientRect().top : -Infinity,
				scrollParent ? scrollParent.getBoundingClientRect().top + 48 : -Infinity,
			);
			const activeIndex = isBottom
				? cards.length - 1
				: getActiveScrollItemIndex(
					cards.map((card) => card.getBoundingClientRect().top),
					thresholdTop,
					24,
				);
			if (activeIndex >= 0 && activeIndex < currentItems.length) {
				const nextKey = getKeyRef.current(currentItems[activeIndex], activeIndex);
				setSelectedKey((prev) => (prev === nextKey ? prev : nextKey));
				scrollListItemIntoViewIfNeeded(listSibling, activeIndex);
			}
		};
		window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
		return () => window.removeEventListener("scroll", handleScroll, { capture: true });
	}, [detailRef]);
	return { selected, setSelectedKey: selectKey };
}
