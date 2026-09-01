import {
	useEffect,
	useMemo,
	useState,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";

import type { CampaignGraphEdge, CampaignGraphNode } from "../../graph.js";
import {
	getCampaignGraphConnectedEdges,
	getCampaignGraphConnectedIds,
	type CampaignGraphVisibleResult,
} from "../../model/campaignGraphPresentation.ts";

interface UseCampaignGraphSelectionOptions {
	campaignSlug: string;
	visibleGraph: CampaignGraphVisibleResult;
	hasManualPositionsRef: MutableRefObject<boolean>;
}

interface CampaignGraphSelection {
	selectedNodeId: string | null;
	setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
	setHoveredNodeId: Dispatch<SetStateAction<string | null>>;
	focusedNodeId: string | null;
	connectedIds: Set<string>;
	selectedNode: CampaignGraphNode | null | undefined;
	selectedEdges: CampaignGraphEdge[];
}

export function useCampaignGraphSelection({
	campaignSlug,
	visibleGraph,
	hasManualPositionsRef,
}: UseCampaignGraphSelectionOptions): CampaignGraphSelection {
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const focusedNodeId = hoveredNodeId || selectedNodeId;
	const connectedIds = useMemo(
		() => getCampaignGraphConnectedIds(visibleGraph.edges, focusedNodeId),
		[focusedNodeId, visibleGraph.edges],
	);
	const selectedNode = selectedNodeId
		? visibleGraph.nodeById.get(selectedNodeId)
		: null;
	const selectedEdges = useMemo(
		() => getCampaignGraphConnectedEdges(visibleGraph.edges, selectedNodeId),
		[selectedNodeId, visibleGraph.edges],
	);

	useEffect(() => {
		if (selectedNodeId && !visibleGraph.visibleNodeIds.has(selectedNodeId)) {
			setSelectedNodeId(null);
		}
	}, [selectedNodeId, visibleGraph.visibleNodeIds]);

	useEffect(() => {
		setSelectedNodeId(null);
		setHoveredNodeId(null);
		hasManualPositionsRef.current = false;
	}, [campaignSlug, hasManualPositionsRef]);

	return {
		selectedNodeId,
		setSelectedNodeId,
		setHoveredNodeId,
		focusedNodeId,
		connectedIds,
		selectedNode,
		selectedEdges,
	};
}
