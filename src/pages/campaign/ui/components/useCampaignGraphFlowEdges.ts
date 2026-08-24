import { useMemo } from "react";
import { MarkerType } from "@xyflow/react";

import { classNames } from "../../../../shared/lib/index.js";
import type { CampaignGraphEdge } from "../../graph.js";
import {
	getCampaignGraphEdgeColor,
	getCampaignGraphEdgeHandles,
	getCampaignGraphEdgeOpacity,
	getCampaignGraphEdgePresentation,
	getCampaignGraphEdgeStrokeWidth,
} from "../../model/campaignGraphPresentation.ts";
import {
	type CampaignGraphFlowEdge,
	type CampaignGraphFlowNode,
} from "./CampaignGraphCanvas.tsx";

function getCampaignFlowEdgeMarker(hasSequenceMarker: boolean, color: string) {
	if (!hasSequenceMarker) return undefined;
	return {
		type: MarkerType.ArrowClosed,
		color,
		width: 14,
		height: 14,
	};
}

interface UseCampaignGraphFlowEdgesOptions {
	flowNodes: CampaignGraphFlowNode[];
	edges: CampaignGraphEdge[];
	visibleEdgeIds: ReadonlySet<string>;
	focusedNodeId: string | null;
}

export function useCampaignGraphFlowEdges({
	flowNodes,
	edges,
	visibleEdgeIds,
	focusedNodeId,
}: UseCampaignGraphFlowEdgesOptions): CampaignGraphFlowEdge[] {
	return useMemo<CampaignGraphFlowEdge[]>(() => {
		const positions = new Map(flowNodes.map((node) => [node.id, node.position]));
		const hasFocus = Boolean(focusedNodeId);
		return edges.map<CampaignGraphFlowEdge>((edge) => {
			const isVisible = visibleEdgeIds.has(edge.id);
			const color = getCampaignGraphEdgeColor(edge);
			const presentation = getCampaignGraphEdgePresentation(edge, focusedNodeId);
			const handles = getCampaignGraphEdgeHandles(
				positions.get(edge.source),
				positions.get(edge.target),
			);

			return {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				...handles,
				type: presentation.type,
				hidden: !isVisible,
				selectable: false,
				focusable: false,
				deletable: false,
				animated: presentation.animated,
				className: classNames(
					"CampaignNotesGraph__flowEdge",
					`is_${edge.relation}`,
					presentation.isMuted && "is_muted",
				),
				style: {
					stroke: color,
					strokeWidth: getCampaignGraphEdgeStrokeWidth(edge),
					opacity: getCampaignGraphEdgeOpacity(edge, presentation.isFocused, hasFocus),
					strokeDasharray: presentation.strokeDasharray,
				},
				markerEnd: getCampaignFlowEdgeMarker(presentation.hasSequenceMarker, color),
				label: presentation.label,
				labelStyle: { fill: "var(--text-bright)", fontWeight: 700 },
				labelBgStyle: { fill: "var(--panel)", fillOpacity: 0.92 },
				labelBgPadding: [5, 3] as [number, number],
				labelBgBorderRadius: 8,
				zIndex: 0,
			};
		});
	}, [edges, flowNodes, focusedNodeId, visibleEdgeIds]);
}
