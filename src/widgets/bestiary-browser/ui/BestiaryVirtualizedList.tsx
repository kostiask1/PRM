import type { ReactNode, RefObject } from "react";
import ReactList from "react-list";
import type { BestiaryMonster } from "../../../entities/bestiary/index.js";
import { lang } from "../../../shared/lib/index.js";

export interface BestiaryVirtualizedListProps {
	displayedMonsters: BestiaryMonster[];
	itemRenderer: (index: number) => ReactNode;
	listContainerRef: RefObject<HTMLDivElement>;
	listRef: RefObject<ReactList>;
	loading: boolean;
}

function getFallbackScrollParent() {
	if (typeof window === "undefined") return null;
	return window;
}

export function BestiaryVirtualizedList({
	displayedMonsters,
	itemRenderer,
	listContainerRef,
	listRef,
	loading,
}: BestiaryVirtualizedListProps) {
	return (
		<div className="Bestiary__list" ref={listContainerRef}>
			{loading && displayedMonsters.length === 0 && (
				<div className="Bestiary__loading muted">{lang.t("Loading...")}</div>
			)}
			<ReactList
				ref={listRef}
				itemRenderer={itemRenderer}
				length={displayedMonsters.length}
				scrollParentGetter={() =>
					listContainerRef.current || getFallbackScrollParent()
				}
				scrollParentViewportSizeGetter={() =>
					listContainerRef.current?.clientHeight ||
					getFallbackScrollParent()?.innerHeight ||
					0
				}
				type="uniform"
			/>
		</div>
	);
}
