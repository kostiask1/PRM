import { memo, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { Icon, type IconName } from "../../../../shared/ui/index.js";
import { getCampaignGraphNodeCardPresentation } from "../../model/campaignGraphPresentation.ts";
import type { CampaignGraphNode } from "../../graph.js";
import {
	type CampaignGraphCanvasNodeData,
	type CampaignGraphFlowNode as CampaignGraphCanvasFlowNode,
} from "./CampaignGraphCanvas.tsx";

const NODE_ICON_BY_TYPE: Readonly<Record<string, IconName>> = {
	campaign: "notes-graph",
	"campaign-note": "book",
	character: "user",
	npc: "user",
	location: "folder",
	session: "layers",
	scene: "book",
	"session-note": "book",
	"scene-note": "book",
	unresolved: "x",
};

const HANDLE_POSITIONS = [
	{ id: "top", position: Position.Top },
	{ id: "right", position: Position.Right },
	{ id: "bottom", position: Position.Bottom },
	{ id: "left", position: Position.Left },
];

type GraphCssProperties = CSSProperties & Record<`--${string}`, string | number>;

export interface CampaignGraphFlowNodeData extends CampaignGraphCanvasNodeData {
	graphNode: CampaignGraphNode;
	color: string;
	typeLabel: string;
	connectionsLabel: string;
	isSelected: boolean;
	isMuted: boolean;
	canOpen: boolean;
	onOpen: (node: CampaignGraphNode) => void;
	openLabel: string;
}

export type CampaignGraphFlowNode = CampaignGraphCanvasFlowNode<CampaignGraphFlowNodeData>;

export const CampaignGraphNodeCard = memo(function CampaignGraphNodeCard({
	data,
	selected,
}: NodeProps<CampaignGraphFlowNode>) {
	const graphNode = data.graphNode;
	const presentation = getCampaignGraphNodeCardPresentation(
		graphNode,
		selected,
		data.isSelected,
		data.isMuted,
		data.canOpen,
	);

	return (
		<div
			className={presentation.className}
			style={{ "--graph-node-color": data.color } as GraphCssProperties}
		>
			<CampaignGraphNodeHandles />
			<span className="CampaignNotesGraph__nodeIcon" aria-hidden="true">
				<Icon name={NODE_ICON_BY_TYPE[graphNode.type]} size={16} />
			</span>
			<span className="CampaignNotesGraph__nodeContent">
				<span className="CampaignNotesGraph__nodeType">{data.typeLabel}</span>
				<strong title={graphNode.label}>{graphNode.label}</strong>
				{presentation.showSummary && (
					<span className="CampaignNotesGraph__nodeSummary">
						{graphNode.summary}
					</span>
				)}
			</span>
			{presentation.showDegree && (
				<span
					className="CampaignNotesGraph__nodeDegree"
					title={data.connectionsLabel}
				>
					{graphNode.degree}
				</span>
			)}
			{presentation.showOpen && (
				<button
					type="button"
					className="CampaignNotesGraph__nodeOpen nodrag nopan"
					onClick={(event) => {
						event.stopPropagation();
						data.onOpen(graphNode);
					}}
					title={data.openLabel}
					aria-label={data.openLabel}
				>
					<Icon name="forward" size={14} />
				</button>
			)}
		</div>
	);
});

function CampaignGraphNodeHandles() {
	return HANDLE_POSITIONS.flatMap(({ id, position }) => [
		<Handle
			key={`source-${id}`}
			id={`source-${id}`}
			type="source"
			position={position}
			isConnectable={false}
			className="CampaignNotesGraph__handle"
		/>,
		<Handle
			key={`target-${id}`}
			id={`target-${id}`}
			type="target"
			position={position}
			isConnectable={false}
			className="CampaignNotesGraph__handle"
		/>,
	]);
}
