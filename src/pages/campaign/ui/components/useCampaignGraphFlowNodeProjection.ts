import {
	useEffect,
	useRef,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";

import { lang } from "../../../../shared/lib/index.js";
import type { CampaignGraphNode } from "../../graph.js";
import type { CampaignGraphPositions } from "../../model/campaignGraphLayout.ts";
import {
	getCampaignGraphFlowNodePresentation,
	getCampaignGraphFlowProjectionPlan,
	resolveNewCampaignGraphNodeCollisions,
} from "../../model/campaignGraphPresentation.ts";
import { getCurrentCampaignFlowNodeMap } from "./campaignGraphControllerHelpers.ts";
import type { CampaignGraphFlowNode } from "./CampaignGraphNodeCard.tsx";

interface UseCampaignGraphFlowNodeProjectionOptions {
	campaignSlug: string;
	graphNodes: CampaignGraphNode[];
	layoutPositions: CampaignGraphPositions;
	selectedNodeId: string | null;
	focusedNodeId: string | null;
	connectedIds: ReadonlySet<string>;
	visibleNodeIds: ReadonlySet<string>;
	canSaveNote: boolean;
	colors: Readonly<Record<string, string>>;
	typeLabels: Readonly<Record<string, string>>;
	onOpen: (node: CampaignGraphNode) => void;
	setFlowNodes: Dispatch<SetStateAction<CampaignGraphFlowNode[]>>;
	hasManualPositionsRef: MutableRefObject<boolean>;
}

export function useCampaignGraphFlowNodeProjection({
	campaignSlug,
	graphNodes,
	layoutPositions,
	selectedNodeId,
	focusedNodeId,
	connectedIds,
	visibleNodeIds,
	canSaveNote,
	colors,
	typeLabels,
	onOpen,
	setFlowNodes,
	hasManualPositionsRef,
}: UseCampaignGraphFlowNodeProjectionOptions): void {
	const positionedCampaignRef = useRef(campaignSlug);

	useEffect(() => {
		setFlowNodes((currentNodes) => {
			const shouldPreservePositions =
				positionedCampaignRef.current === campaignSlug;
			positionedCampaignRef.current = campaignSlug;
			const projection = getCampaignGraphFlowProjectionPlan(
				currentNodes.map((node) => node.id),
				graphNodes.map((node) => node.id),
				shouldPreservePositions,
				hasManualPositionsRef.current,
			);
			const currentById = getCurrentCampaignFlowNodeMap(
				currentNodes,
				projection.shouldUseFreshLayout,
			);
			const projectedNodes = graphNodes.map<CampaignGraphFlowNode>((graphNode) => {
				const currentNode = currentById.get(graphNode.id);
				const presentation = getCampaignGraphFlowNodePresentation({
					graphNode,
					currentNode,
					layoutPosition: layoutPositions[graphNode.id],
					selectedNodeId,
					focusedNodeId,
					connectedIds,
					visibleNodeIds,
					canSaveNote,
					colors,
					typeLabels,
				});
				return {
					...currentNode,
					id: graphNode.id,
					type: "campaignGraphNode",
					position: presentation.position,
					origin: [0.5, 0.5] as const,
					zIndex: presentation.isSelected ? 3 : 2,
					style: { width: presentation.size.width, height: presentation.size.height },
					data: {
						graphNode,
						color: presentation.color,
						typeLabel: lang.t(presentation.typeLabelKey),
						connectionsLabel: lang.t("Connections"),
						isSelected: presentation.isSelected,
						isMuted: presentation.isMuted,
						canOpen: presentation.canOpen,
						onOpen,
						openLabel: lang.t("Open {name}", { name: graphNode.label }),
					},
					hidden: presentation.hidden,
					selected: presentation.isSelected,
					draggable: true,
					selectable: true,
					connectable: false,
					deletable: false,
					focusable: true,
					ariaLabel: `${lang.t(presentation.typeLabelKey)}: ${graphNode.label}`,
					ariaRole: "button",
					className: presentation.className,
				};
			});
			return resolveNewCampaignGraphNodeCollisions(
				projectedNodes,
				projection.currentNodeIds,
				projection.shouldUseFreshLayout,
			);
		});
	}, [
		campaignSlug,
		canSaveNote,
		colors,
		connectedIds,
		focusedNodeId,
		graphNodes,
		hasManualPositionsRef,
		layoutPositions,
		onOpen,
		selectedNodeId,
		setFlowNodes,
		typeLabels,
		visibleNodeIds,
	]);
}
