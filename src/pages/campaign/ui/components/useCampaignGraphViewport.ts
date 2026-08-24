import {
	useCallback,
	useEffect,
	useRef,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";
import type { ReactFlowInstance } from "@xyflow/react";

import { layoutCampaignGraph } from "../../graph.js";
import type { CampaignGraphEdge, CampaignGraphNode } from "../../graph.js";
import { shouldFitCampaignGraphTopology } from "../../model/campaignGraphPresentation.ts";
import type { CampaignGraphFlowEdge } from "./CampaignGraphCanvas.tsx";
import type { CampaignGraphFlowNode } from "./CampaignGraphNodeCard.tsx";

interface UseCampaignGraphViewportOptions {
	campaignSlug: string;
	flowInstance: ReactFlowInstance<CampaignGraphFlowNode, CampaignGraphFlowEdge> | null;
	setFlowNodes: Dispatch<SetStateAction<CampaignGraphFlowNode[]>>;
	visibleNodes: CampaignGraphNode[];
	visibleEdges: CampaignGraphEdge[];
	flowNodeCount: number;
	graphNodeCount: number;
	flowNodeTopologyKey: string;
	nodeTopologyKey: string;
	hasManualPositionsRef: MutableRefObject<boolean>;
}

interface CampaignGraphViewportControls {
	requestFilterRelayout: () => void;
	handleRelayout: () => void;
}

export function useCampaignGraphViewport({
	campaignSlug,
	flowInstance,
	setFlowNodes,
	visibleNodes,
	visibleEdges,
	flowNodeCount,
	graphNodeCount,
	flowNodeTopologyKey,
	nodeTopologyKey,
	hasManualPositionsRef,
}: UseCampaignGraphViewportOptions): CampaignGraphViewportControls {
	const fittedNodeTopologyRef = useRef<string | null>(null);
	const shouldRelayoutForFilterRef = useRef(false);

	useEffect(() => {
		fittedNodeTopologyRef.current = null;
	}, [campaignSlug]);

	useEffect(() => {
		if (!shouldRelayoutForFilterRef.current) return undefined;
		shouldRelayoutForFilterRef.current = false;

		const nextPositions = layoutCampaignGraph(visibleNodes, visibleEdges);
		setFlowNodes((currentNodes) =>
			currentNodes.map((node) =>
				nextPositions[node.id]
					? { ...node, position: nextPositions[node.id] }
					: node,
			),
		);

		const frame = requestAnimationFrame(() => {
			flowInstance?.fitView({ padding: 0.16, duration: 360 });
		});
		return () => cancelAnimationFrame(frame);
	}, [flowInstance, setFlowNodes, visibleEdges, visibleNodes]);

	useEffect(() => {
		if (!shouldFitCampaignGraphTopology({
			hasFlowInstance: Boolean(flowInstance),
			flowNodeCount,
			graphNodeCount,
			flowNodeTopologyKey,
			nodeTopologyKey,
			hasManualPositions: hasManualPositionsRef.current,
			hasFittedTopology: fittedNodeTopologyRef.current === nodeTopologyKey,
		})) {
			return undefined;
		}
		fittedNodeTopologyRef.current = nodeTopologyKey;
		const frame = requestAnimationFrame(() => {
			flowInstance?.fitView({ padding: 0.16, duration: 520 });
		});
		return () => cancelAnimationFrame(frame);
	}, [
		flowInstance,
		flowNodeCount,
		flowNodeTopologyKey,
		graphNodeCount,
		hasManualPositionsRef,
		nodeTopologyKey,
	]);

	const requestFilterRelayout = useCallback(() => {
		shouldRelayoutForFilterRef.current = true;
	}, []);

	const handleRelayout = useCallback(() => {
		hasManualPositionsRef.current = false;
		const nextPositions = layoutCampaignGraph(visibleNodes, visibleEdges);
		setFlowNodes((currentNodes) =>
			currentNodes.map((node) => ({
				...node,
				position: nextPositions[node.id] || node.position,
			})),
		);
		requestAnimationFrame(() => {
			flowInstance?.fitView({ padding: 0.16, duration: 520 });
		});
	}, [flowInstance, hasManualPositionsRef, setFlowNodes, visibleEdges, visibleNodes]);

	return { requestFilterRelayout, handleRelayout };
}
