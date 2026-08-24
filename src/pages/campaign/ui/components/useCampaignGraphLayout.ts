import { useRef } from "react";

import {
	layoutCampaignGraph,
	type CampaignGraphEdge,
	type CampaignGraphNode,
	type CampaignGraphPositions,
} from "../../graph.js";

function getGraphTopologyKey(
	nodes: CampaignGraphNode[],
	edges: CampaignGraphEdge[],
): string {
	const nodeKey = nodes
		.map((node) => `${node.id}:${node.type}`)
		.sort()
		.join("|");
	const edgeKey = edges
		.map(
			(edge) =>
				`${edge.id}:${edge.source}:${edge.target}:${edge.relation}`,
		)
		.sort()
		.join("|");
	return `${nodeKey}::${edgeKey}`;
}

export function useCampaignGraphLayout(
	nodes: CampaignGraphNode[],
	edges: CampaignGraphEdge[],
): CampaignGraphPositions {
	const cacheRef = useRef<{
		key: string | null;
		positions: CampaignGraphPositions;
	}>({ key: null, positions: {} });
	const topologyKey = getGraphTopologyKey(nodes, edges);
	if (cacheRef.current.key !== topologyKey) {
		cacheRef.current = {
			key: topologyKey,
			positions: layoutCampaignGraph(nodes, edges),
		};
	}
	return cacheRef.current.positions;
}
