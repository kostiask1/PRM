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
				<div className="Bestiary__skeleton_list" aria-busy="true" aria-label={lang.t("Loading...")}>
					<div className="Bestiary__loading muted" style={{ display: "none" }}>{lang.t("Loading...")}</div>
					{Array.from({ length: 6 }).map((_, index) => (
						<div key={index} className="Skeleton--card">
							<span className="Skeleton Skeleton--circle" style={{ width: 44, height: 44 }} />
							<div className="Skeleton--cardContent">
								<span className="Skeleton Skeleton--title" style={{ width: index % 2 === 0 ? "70%" : "50%" }} />
								<span className="Skeleton Skeleton--text" style={{ width: "40%" }} />
							</div>
						</div>
					))}
				</div>
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
