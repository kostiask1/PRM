declare module "react-list" {
	import type { Component, ReactNode } from "react";

	export interface ReactListProps {
		itemRenderer: (index: number, key: number | string) => ReactNode;
		itemSizeEstimator?: (index: number, cache: Record<number, number>) => number;
		length: number;
		scrollParentGetter?: () => Element | Window | null;
		scrollParentViewportSizeGetter?: () => number;
		threshold?: number;
		type?: "simple" | "uniform" | "variable";
	}

	export default class ReactList extends Component<ReactListProps> {
		scrollTo(index: number): void;
	}
}
