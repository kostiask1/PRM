import { useEffect, useRef, useState } from "react";

export function useHashItemSelection<T>(
	items: readonly T[],
	getKey: (item: T, index: number) => string,
	matchesHash: (item: T, hash: string) => boolean,
	matchesPreviousKey?: (item: T, key: string) => boolean,
	selectionRequest?: { id: string | number } | null,
) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const [hash, setHash] = useState(() => typeof window === "undefined" ? "" : window.location.hash);
	const appliedHash = useRef("");
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
	return { selected, setSelectedKey };
}
