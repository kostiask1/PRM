import { useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
	Background,
	BackgroundVariant,
	Controls,
	ReactFlow,
	useReactFlow,
	useStore,
	useViewport,
	type AriaLabelConfig,
	type Edge,
	type Node,
	type NodeChange,
	type NodeTypes,
	type OnNodeDrag,
	type ReactFlowInstance,
} from "@xyflow/react";

import { getCampaignGraphMiniMapBounds, getCampaignGraphMiniMapNodeSize } from "../../model/campaignGraphPresentation.ts";
import { lang } from "../../../../shared/lib/index.js";

export interface CampaignGraphCanvasNodeData extends Record<string, unknown> {
	color?: string;
	graphNode?: { type?: string };
}

export type CampaignGraphFlowNode<
	Data extends CampaignGraphCanvasNodeData = CampaignGraphCanvasNodeData,
> = Node<Data, "campaignGraphNode">;

export type CampaignGraphFlowEdge = Edge;

interface CampaignGraphCanvasProps<Data extends CampaignGraphCanvasNodeData> {
	error: string;
	isLoading: boolean;
	visibleNodeCount: number;
	query: string;
	flowNodes: CampaignGraphFlowNode<Data>[];
	flowEdges: CampaignGraphFlowEdge[];
	nodeTypes: NodeTypes;
	onInit: (
		instance: ReactFlowInstance<CampaignGraphFlowNode<Data>, CampaignGraphFlowEdge>,
	) => void;
	onNodesChange: (changes: NodeChange<CampaignGraphFlowNode<Data>>[]) => void;
	onNodeSelect: (nodeId: string) => void;
	onNodeOpen: (nodeId: string) => void;
	onNodeHover: (nodeId: string | null) => void;
	onNodeDragStop: OnNodeDrag<CampaignGraphFlowNode<Data>>;
	onPaneClick: () => void;
	ariaLabelConfig: Partial<AriaLabelConfig>;
	colorMode: "dark" | "light";
}

function CampaignGraphMiniMap<Data extends CampaignGraphCanvasNodeData>({
	nodes,
}: {
	nodes: CampaignGraphFlowNode<Data>[];
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const activePointerRef = useRef<number | null>(null);
	const { setCenter } = useReactFlow<
		CampaignGraphFlowNode<Data>,
		CampaignGraphFlowEdge
	>();
	const viewport = useViewport();
	const flowWidth = useStore((state) => state.width);
	const flowHeight = useStore((state) => state.height);
	const bounds = useMemo(() => getCampaignGraphMiniMapBounds(nodes), [nodes]);

	const moveViewport = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
		if (!bounds || !svgRef.current) return;
		const rect = svgRef.current.getBoundingClientRect();
		const x = bounds.x + ((event.clientX - rect.left) / rect.width) * bounds.width;
		const y = bounds.y + ((event.clientY - rect.top) / rect.height) * bounds.height;
		setCenter(x, y, { zoom: viewport.zoom, duration: 0 });
	}, [bounds, setCenter, viewport.zoom]);

	if (!bounds) return null;

	const viewportRect = {
		x: -viewport.x / viewport.zoom,
		y: -viewport.y / viewport.zoom,
		width: flowWidth / viewport.zoom,
		height: flowHeight / viewport.zoom,
	};
	const maskX = Math.max(bounds.x, viewportRect.x);
	const maskY = Math.max(bounds.y, viewportRect.y);
	const maskRight = Math.min(bounds.x + bounds.width, viewportRect.x + viewportRect.width);
	const maskBottom = Math.min(bounds.y + bounds.height, viewportRect.y + viewportRect.height);
	const hasVisibleViewport = maskRight > maskX && maskBottom > maskY;

	return (
		<div className="react-flow__panel bottom right react-flow__minimap CampaignNotesGraph__miniMap nopan nowheel">
			<svg
				ref={svgRef}
				className="CampaignNotesGraph__miniMapSvg"
				viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
				preserveAspectRatio="xMidYMid meet"
				aria-label={lang.t("Graph minimap")}
				onPointerDown={(event) => {
					activePointerRef.current = event.pointerId;
					event.currentTarget.setPointerCapture(event.pointerId);
					moveViewport(event);
				}}
				onPointerMove={(event) => {
					if (activePointerRef.current === event.pointerId) moveViewport(event);
				}}
				onPointerUp={(event) => {
					if (activePointerRef.current === event.pointerId) activePointerRef.current = null;
				}}
			>
				{nodes.filter((node) => !node.hidden).map((node) => {
					const { width, height } = getCampaignGraphMiniMapNodeSize(node);
					return (
						<rect
							key={node.id}
							x={node.position.x - width / 2}
							y={node.position.y - height / 2}
							width={width}
							height={height}
							rx={10}
							fill={node.data?.color || "#94a3b8"}
						/>
					);
				})}
				{hasVisibleViewport && (
					<>
						<path
							className="CampaignNotesGraph__miniMapMask"
							fillRule="evenodd"
							d={`M ${bounds.x} ${bounds.y} h ${bounds.width} v ${bounds.height} h ${-bounds.width} Z M ${maskX} ${maskY} h ${maskRight - maskX} v ${maskBottom - maskY} h ${maskX - maskRight} Z`}
						/>
						<rect
							className="CampaignNotesGraph__miniMapViewport"
							x={maskX}
							y={maskY}
							width={maskRight - maskX}
							height={maskBottom - maskY}
						/>
					</>
				)}
			</svg>
		</div>
	);
}

export function CampaignGraphCanvas<Data extends CampaignGraphCanvasNodeData>({
	error,
	isLoading,
	visibleNodeCount,
	query,
	flowNodes,
	flowEdges,
	nodeTypes,
	onInit,
	onNodesChange,
	onNodeSelect,
	onNodeOpen,
	onNodeHover,
	onNodeDragStop,
	onPaneClick,
	ariaLabelConfig,
	colorMode,
}: CampaignGraphCanvasProps<Data>) {
	return (
		<div className="CampaignNotesGraph__canvasWrap">
			<CampaignGraphCanvasMessages
				error={error}
				isLoading={isLoading}
				visibleNodeCount={visibleNodeCount}
				query={query}
			/>
			<ReactFlow<CampaignGraphFlowNode<Data>, CampaignGraphFlowEdge>
				nodes={flowNodes}
				edges={flowEdges}
				nodeTypes={nodeTypes}
				onInit={onInit}
				onNodesChange={onNodesChange}
				onNodeClick={(_event, node) => onNodeSelect(node.id)}
				onNodeDoubleClick={(_event, node) => onNodeOpen(node.id)}
				onNodeMouseEnter={(_event, node) => onNodeHover(node.id)}
				onNodeMouseLeave={() => onNodeHover(null)}
				onNodeDragStop={onNodeDragStop}
				onPaneClick={onPaneClick}
				fitView
				fitViewOptions={{ padding: 0.16 }}
				minZoom={0.18}
				maxZoom={2.2}
				nodeOrigin={[0.5, 0.5]}
				nodeDragThreshold={4}
				nodesConnectable={false}
				edgesReconnectable={false}
				deleteKeyCode={null}
				multiSelectionKeyCode={null}
				zoomOnDoubleClick={false}
				autoPanOnNodeDrag
				autoPanOnNodeFocus
				onlyRenderVisibleElements
				aria-label={lang.t("Campaign graph")}
				ariaLabelConfig={ariaLabelConfig}
				attributionPosition="top-right"
				colorMode={colorMode}
			>
				<Background variant={BackgroundVariant.Dots} gap={24} size={1.25} />
				<Controls
					position="bottom-left"
					showInteractive={false}
					fitViewOptions={{ padding: 0.16, duration: 420 }}
				/>
				<CampaignGraphMiniMap nodes={flowNodes} />
			</ReactFlow>
		</div>
	);
}

function CampaignGraphCanvasMessages({
	error,
	isLoading,
	visibleNodeCount,
	query,
}: Pick<CampaignGraphCanvasProps<CampaignGraphCanvasNodeData>, "error" | "isLoading" | "visibleNodeCount" | "query">) {
	return (
		<>
			<CampaignGraphErrorMessage error={error} />
			<CampaignGraphLoadingMessage isLoading={isLoading} />
			<CampaignGraphEmptyMessage
				isLoading={isLoading}
				visibleNodeCount={visibleNodeCount}
				query={query}
			/>
		</>
	);
}

function CampaignGraphErrorMessage({ error }: Pick<CampaignGraphCanvasProps<CampaignGraphCanvasNodeData>, "error">) {
	if (!error) return null;
	return <div className="CampaignNotesGraph__message CampaignNotesGraph__message__error">{error}</div>;
}

function CampaignGraphLoadingMessage({ isLoading }: Pick<CampaignGraphCanvasProps<CampaignGraphCanvasNodeData>, "isLoading">) {
	if (!isLoading) return null;
	return <div className="CampaignNotesGraph__message">{lang.t("Loading graph...")}</div>;
}

function CampaignGraphEmptyMessage({
	isLoading,
	visibleNodeCount,
	query,
}: Pick<CampaignGraphCanvasProps<CampaignGraphCanvasNodeData>, "isLoading" | "visibleNodeCount" | "query">) {
	if (visibleNodeCount !== 0 || isLoading) return null;
	const label = query ? "Nothing found." : "No graph links yet.";
	return <div className="CampaignNotesGraph__message">{lang.t(label)}</div>;
}
