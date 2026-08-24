import {
	useCallback,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from "react";
import type { NodeChange, OnNodeDrag } from "@xyflow/react";

import { resolveCampaignGraphNodeCollision } from "../../graph.js";
import type { CampaignGraphFlowNode } from "./CampaignGraphNodeCard.tsx";

interface UseCampaignGraphFlowInteractionsOptions {
	setFlowNodes: Dispatch<SetStateAction<CampaignGraphFlowNode[]>>;
	setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
	onFlowNodesChange: (changes: NodeChange<CampaignGraphFlowNode>[]) => void;
	hasManualPositionsRef: MutableRefObject<boolean>;
}

interface CampaignGraphFlowInteractions {
	handleNodeDragStop: OnNodeDrag<CampaignGraphFlowNode>;
	handleFlowNodesChange: (changes: NodeChange<CampaignGraphFlowNode>[]) => void;
}

export function useCampaignGraphFlowInteractions({
	setFlowNodes,
	setSelectedNodeId,
	onFlowNodesChange,
	hasManualPositionsRef,
}: UseCampaignGraphFlowInteractionsOptions): CampaignGraphFlowInteractions {
	const handleNodeDragStop = useCallback<OnNodeDrag<CampaignGraphFlowNode>>(
		(_event, draggedNode) => {
			hasManualPositionsRef.current = true;
			setFlowNodes((currentNodes) => {
				const position = resolveCampaignGraphNodeCollision(
					currentNodes,
					draggedNode.id,
				);
				return currentNodes.map((node) =>
					node.id === draggedNode.id ? { ...node, position } : node,
				);
			});
		},
		[hasManualPositionsRef, setFlowNodes],
	);

	const handleFlowNodesChange = useCallback(
		(changes: NodeChange<CampaignGraphFlowNode>[]) => {
			const selectionChanges = changes.filter(
				(change) => change.type === "select",
			);
			const selectedChange = selectionChanges.find(
				(change) => change.selected,
			);
			if (selectedChange) {
				setSelectedNodeId((currentNodeId) =>
					currentNodeId === selectedChange.id
						? currentNodeId
						: selectedChange.id,
				);
			} else if (selectionChanges.length > 0) {
				setSelectedNodeId(null);
			}

			if (changes.some((change) => change.type === "position")) {
				hasManualPositionsRef.current = true;
			}
			onFlowNodesChange(changes);
		},
		[hasManualPositionsRef, onFlowNodesChange, setSelectedNodeId],
	);

	return { handleNodeDragStop, handleFlowNodesChange };
}
