import type { CampaignGraphConnectionAction } from "../../model/campaignGraphPresentation.ts";
import type { CampaignGraphFlowNode } from "./CampaignGraphNodeCard.tsx";

export function getCurrentCampaignFlowNodeMap(
	nodes: CampaignGraphFlowNode[],
	shouldUseFreshLayout: boolean,
): Map<string, CampaignGraphFlowNode> {
	if (shouldUseFreshLayout) return new Map();
	return new Map(nodes.map((node) => [node.id, node]));
}

export function executeCampaignGraphConnectionAction(
	action: CampaignGraphConnectionAction,
	onOpenSession: ((fileName: string) => void) | undefined,
	onSelectNode: (nodeId: string) => void,
): void {
	if (action.kind === "session") onOpenSession?.(action.fileName);
	else onSelectNode(action.nodeId);
}
