import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	type ReactElement,
	type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
	Background,
	BackgroundVariant,
	Controls,
	Handle,
	MarkerType,
	Position,
	ReactFlow,
	useNodesState,
	useReactFlow,
	useStore,
	useViewport,
	type Edge,
	type AriaLabelConfig,
	type Node,
	type NodeChange,
	type NodeProps,
	type OnNodeDrag,
	type ReactFlowInstance,
} from "@xyflow/react";

import { Button, Icon, type IconName } from "../../../../shared/ui/index.js";
import {
	EditableField,
	type EditableFieldChangeEvent,
} from "../../../../features/editor/ui/index.js";
import {
	EntityModal,
	type EntityModalProps,
} from "../../../../features/entity-link/index.js";
import { classNames } from "../../../../shared/lib/index.js";
import {
	buildCampaignGraph,
	normalizeGraphName,
	getCampaignGraphNodeSize,
	layoutCampaignGraph,
	resolveCampaignGraphNodeCollision,
} from "../../graph.js";
import {
	CAMPAIGN_GRAPH_FILTERS,
	DEFAULT_CAMPAIGN_GRAPH_FILTERS,
	canOpenCampaignGraphNode,
	formatCampaignGraphSourceList,
	getCampaignGraphConnectedEdges,
	getCampaignGraphConnectedIds,
	getCampaignGraphEdgeColor,
	getCampaignGraphEdgeHandles,
	getCampaignGraphEdgeOpacity,
	getCampaignGraphEdgePresentation,
	getCampaignGraphEdgeStrokeWidth,
	getCampaignGraphMiniMapBounds,
	getCampaignGraphMiniMapNodeSize,
	getCampaignGraphNoteSaveRequest,
	getCampaignGraphNodeTypeClass,
	getCampaignGraphOpenTarget,
	getCampaignGraphRelationLabel,
	getCampaignGraphSessionDisplayName,
	getCampaignGraphTypeCounts,
	getVisibleCampaignGraph,
	type CampaignGraphEnabledFilters,
	type CampaignGraphFilterId,
} from "../../model/campaignGraphPresentation.ts";
import type {
	CampaignGraphEdge,
	CampaignGraphNode,
	CampaignGraphPositions,
	CampaignGraphResult,
} from "../../graph.js";
import type {
	CampaignGraphNoteSave,
	CampaignPageCampaign,
	CampaignPageEntity,
	CampaignSessionDetails,
} from "../../model/contracts.ts";
import type { SessionRecord } from "../../../../entities/session/index.js";
import type { SharedNote } from "../../../../shared/lib/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { openModalRequest, useAppSelector } from "../../../../shared/model/index.js";
import { renderMentionText } from "../../../../features/rich-content/index.js";
import "@xyflow/react/dist/style.css";
import "../../../../assets/components/CampaignNotesGraph.css";

const NODE_TYPE_ORDER = [
	"campaign",
	"campaign-note",
	"character",
	"npc",
	"location",
	"session",
	"scene",
	"session-note",
	"scene-note",
	"unresolved",
];

const TYPE_LABELS: Readonly<Record<string, string>> = {
	campaign: "Campaign",
	"campaign-note": "Campaign notes",
	character: "Characters",
	npc: "NPC",
	location: "Locations/Factions",
	session: "Sessions",
	scene: "Scenes",
	"session-note": "Session notes",
	"scene-note": "Scene notes",
	unresolved: "Unknown mention",
};

const NODE_COLOR_BY_TYPE: Readonly<Record<string, string>> = {
	campaign: "#f59e0b",
	"campaign-note": "#38bdf8",
	character: "#22c55e",
	npc: "#f97316",
	location: "#a3e635",
	session: "#818cf8",
	scene: "#e879f9",
	"session-note": "#38bdf8",
	"scene-note": "#38bdf8",
	unresolved: "#94a3b8",
};

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

function getCampaignFlowEdgeMarker(hasSequenceMarker: boolean, color: string) {
	if (!hasSequenceMarker) return undefined;
	return {
		type: MarkerType.ArrowClosed,
		color,
		width: 14,
		height: 14,
	};
}

const FILTER_COLOR_BY_ID: Readonly<Record<CampaignGraphFilterId, string>> = {
	notes: NODE_COLOR_BY_TYPE["campaign-note"],
	characters: NODE_COLOR_BY_TYPE.character,
	npc: NODE_COLOR_BY_TYPE.npc,
	locations: NODE_COLOR_BY_TYPE.location,
	sessions: NODE_COLOR_BY_TYPE.session,
	scenes: NODE_COLOR_BY_TYPE.scene,
	unresolved: NODE_COLOR_BY_TYPE.unresolved,
};

const MARKDOWN_TAGS_WITH_MENTIONS = [
	"p",
	"strong",
	"em",
	"del",
	"blockquote",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"td",
	"th",
	"a",
	"span",
];

const HANDLE_POSITIONS = [
	{ id: "top", position: Position.Top },
	{ id: "right", position: Position.Right },
	{ id: "bottom", position: Position.Bottom },
	{ id: "left", position: Position.Left },
];

type CampaignGraphEntityModalState = NonNullable<EntityModalProps["modalState"]>;
type GraphCssProperties = CSSProperties & Record<`--${string}`, string | number>;

interface CampaignFlowNodeData extends Record<string, unknown> {
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

type CampaignFlowNode = Node<CampaignFlowNodeData, "campaignGraphNode">;
type CampaignFlowEdge = Edge;

export interface CampaignNotesGraphProps {
	campaign: CampaignPageCampaign;
	description: string;
	notes: SharedNote[];
	characters: CampaignPageEntity[];
	npcs: CampaignPageEntity[];
	locations: CampaignPageEntity[];
	sessions: SessionRecord[];
	sessionDetails: CampaignSessionDetails;
	isLoading: boolean;
	error: string;
	onLoadSessionDetails: () => void | Promise<void>;
	onSaveNote: (request: CampaignGraphNoteSave) => void | Promise<void>;
	onOpenSession: (fileName: string) => void;
}

function renderMentionChildren(children: ReactNode): ReactNode {
	return React.Children.map(children, (child) => {
		if (typeof child === "string") return renderMentionText(child);
		if (React.isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
			if (child.type === "code" || child.type === "pre") return child;
			return React.cloneElement(child, {
				children: renderMentionChildren(child.props.children),
			});
		}
		return child;
	});
}

interface ParsedGraphTextProps {
	text: unknown;
	onOpen?: () => void;
}

function ParsedGraphText({ text, onOpen }: ParsedGraphTextProps) {
	const components = useMemo<Components>(
		() =>
			Object.fromEntries(
				MARKDOWN_TAGS_WITH_MENTIONS.map((tag) => [
					tag,
					({ children, ...tagProps }: { children?: ReactNode }) =>
						React.createElement(tag, tagProps, renderMentionChildren(children)),
				]),
			) as Components,
		[],
	);

	if (!String(text || "").trim()) return null;

	return (
		<div
			className={classNames(
				"CampaignNotesGraph__detailText",
				onOpen && "is_clickable",
			)}
			role={onOpen ? "button" : undefined}
			tabIndex={onOpen ? 0 : undefined}
			onClick={(event) => {
				if (!onOpen) return;
				if (
					event.target instanceof Element &&
					event.target.closest("a, button, input, textarea, select")
				)
					return;
				onOpen();
			}}
			onKeyDown={(event) => {
				if (!onOpen || (event.key !== "Enter" && event.key !== " ")) return;
				event.preventDefault();
				onOpen();
			}}
		>
			<ReactMarkdown components={components}>{String(text || "")}</ReactMarkdown>
		</div>
	);
}

interface GraphNoteDraft extends Record<string, unknown> {
	title: string;
	text: string;
}

interface GraphNoteModalContentProps {
	note: SharedNote;
	simplifiedNotes: boolean;
	campaignSlug: string;
	onSave: (updates: GraphNoteDraft) => void | Promise<void>;
}

function toGraphNoteDraft(note: SharedNote): GraphNoteDraft {
	return {
		title: typeof note.title === "string" ? note.title : "",
		text: typeof note.text === "string" ? note.text : "",
	};
}

function GraphNoteModalContent({
	note,
	simplifiedNotes,
	campaignSlug,
	onSave,
}: GraphNoteModalContentProps) {
	const [draft, setDraft] = useState<GraphNoteDraft>(() => toGraphNoteDraft(note));
	const didMountRef = useRef(false);

	useEffect(() => {
		setDraft(toGraphNoteDraft(note));
	}, [note]);

	useEffect(() => {
		if (!didMountRef.current) {
			didMountRef.current = true;
			return undefined;
		}

		const timer = setTimeout(() => {
			void onSave(draft);
		}, 450);

		return () => clearTimeout(timer);
	}, [draft, onSave]);

	const updateDraft = (updates: Partial<GraphNoteDraft>) => {
		setDraft((previous) => ({ ...previous, ...updates }));
	};

	return (
		<div className="CampaignNotesGraph__noteModal">
			{!simplifiedNotes && (
				<EditableField
					value={draft.title || ""}
					enableHistory={false}
					onChange={(event: EditableFieldChangeEvent) =>
						updateDraft({ title: String(event.target.value) })
					}
					placeholder={lang.t("New note")}
					className="CampaignNotesGraph__noteTitle"
				/>
			)}
			<EditableField
				type="textarea"
				value={draft.text || ""}
				enableHistory={false}
				onChange={(event: EditableFieldChangeEvent) =>
					updateDraft({ text: String(event.target.value) })
				}
				placeholder={lang.t("Note text...")}
				campaignSlug={campaignSlug}
				className="CampaignNotesGraph__noteText"
			/>
		</div>
	);
}

const CampaignGraphNodeCard = memo(function CampaignGraphNodeCard({
	data,
	selected,
}: NodeProps<CampaignFlowNode>) {
	const graphNode = data.graphNode;
	const nodeTypeClass = getCampaignGraphNodeTypeClass(graphNode.type);

	return (
		<div
			className={classNames(
				"CampaignNotesGraph__nodeCard",
				nodeTypeClass,
				(selected || data.isSelected) && "is_selected",
				data.isMuted && "is_muted",
			)}
			style={{ "--graph-node-color": data.color } as GraphCssProperties}
		>
			{HANDLE_POSITIONS.flatMap(({ id, position }) => [
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
			])}
			<span className="CampaignNotesGraph__nodeIcon" aria-hidden="true">
				<Icon name={NODE_ICON_BY_TYPE[graphNode.type]} size={16} />
			</span>
			<span className="CampaignNotesGraph__nodeContent">
				<span className="CampaignNotesGraph__nodeType">{data.typeLabel}</span>
				<strong title={graphNode.label}>{graphNode.label}</strong>
				{graphNode.summary && (
					<span className="CampaignNotesGraph__nodeSummary">
						{graphNode.summary}
					</span>
				)}
			</span>
			{graphNode.degree > 0 && (
				<span
					className="CampaignNotesGraph__nodeDegree"
					title={data.connectionsLabel}
				>
					{graphNode.degree}
				</span>
			)}
			{data.canOpen && (
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

const NODE_TYPES = { campaignGraphNode: CampaignGraphNodeCard };

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

function getGraphNodeTopologyKey(
	nodes: Array<CampaignGraphNode | CampaignFlowNode>,
): string {
	return nodes
		.map((node) => {
			const data = "data" in node ? node.data : null;
			const graphType =
				data && typeof data === "object" && "graphNode" in data
					? (data.graphNode as CampaignGraphNode).type
					: node.type;
			return `${node.id}:${graphType}`;
		})
		.sort()
		.join("|");
}

function useCampaignGraphLayout(
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

function CampaignGraphMiniMap({ nodes }: { nodes: CampaignFlowNode[] }) {
	const svgRef = useRef<SVGSVGElement>(null);
	const activePointerRef = useRef<number | null>(null);
	const { setCenter } = useReactFlow<CampaignFlowNode, CampaignFlowEdge>();
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

interface CampaignGraphToolbarProps {
	query: string;
	onQueryChange: (value: string) => void;
	visibleNodeCount: number;
	totalNodeCount: number;
	onRelayout: () => void;
	enabledFilters: CampaignGraphEnabledFilters;
	typeCounts: Partial<Record<CampaignGraphFilterId, number>>;
	onToggleFilter: (filterId: CampaignGraphFilterId) => void;
}

function CampaignGraphToolbar({
	query,
	onQueryChange,
	visibleNodeCount,
	totalNodeCount,
	onRelayout,
	enabledFilters,
	typeCounts,
	onToggleFilter,
}: CampaignGraphToolbarProps) {
	return (
		<div className="CampaignNotesGraph__toolbar">
			<div className="CampaignNotesGraph__toolbarPrimary">
				<label className="CampaignNotesGraph__searchWrap">
					<span className="CampaignNotesGraph__visuallyHidden">
						{lang.t("Search graph...")}
					</span>
					<input
						className="CampaignNotesGraph__search"
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						placeholder={lang.t("Search graph...")}
					/>
					<span className="CampaignNotesGraph__visibleCount">
						{visibleNodeCount}/{totalNodeCount}
					</span>
				</label>
				<Button
					variant="ghost"
					size={Button.SIZES.SMALL}
					icon="restore"
					onClick={onRelayout}
					className="CampaignNotesGraph__relayout"
					title={lang.t("Arrange graph")}
				>
					{lang.t("Arrange")}
				</Button>
			</div>
			<div className="CampaignNotesGraph__filters">
				{CAMPAIGN_GRAPH_FILTERS.map((filter) => (
					<Button
						key={filter.id}
						variant={enabledFilters[filter.id] ? "primary" : "ghost"}
						size={Button.SIZES.SMALL}
						onClick={() => onToggleFilter(filter.id)}
						className="CampaignNotesGraph__filter"
						style={
							{
								"--filter-color": FILTER_COLOR_BY_ID[filter.id],
							} as GraphCssProperties
						}
						aria-pressed={enabledFilters[filter.id]}
					>
						{lang.t(filter.label)}
						{typeCounts[filter.id] ? ` ${typeCounts[filter.id]}` : ""}
					</Button>
				))}
			</div>
			<p className="CampaignNotesGraph__hint">
				{lang.t(
					"Drag nodes to arrange them. Double-click or use the arrow to open an item.",
				)}
			</p>
		</div>
	);
}

interface CampaignGraphCanvasProps {
	error: string;
	isLoading: boolean;
	visibleNodeCount: number;
	query: string;
	flowNodes: CampaignFlowNode[];
	flowEdges: CampaignFlowEdge[];
	onInit: (instance: ReactFlowInstance<CampaignFlowNode, CampaignFlowEdge>) => void;
	onNodesChange: (changes: NodeChange<CampaignFlowNode>[]) => void;
	onNodeSelect: (nodeId: string) => void;
	onNodeOpen: (nodeId: string) => void;
	onNodeHover: (nodeId: string | null) => void;
	onNodeDragStop: OnNodeDrag<CampaignFlowNode>;
	onPaneClick: () => void;
	ariaLabelConfig: Partial<AriaLabelConfig>;
	colorMode: "dark" | "light";
}

function CampaignGraphCanvas({
	error,
	isLoading,
	visibleNodeCount,
	query,
	flowNodes,
	flowEdges,
	onInit,
	onNodesChange,
	onNodeSelect,
	onNodeOpen,
	onNodeHover,
	onNodeDragStop,
	onPaneClick,
	ariaLabelConfig,
	colorMode,
}: CampaignGraphCanvasProps) {
	return (
		<div className="CampaignNotesGraph__canvasWrap">
			{error && (
				<div className="CampaignNotesGraph__message CampaignNotesGraph__message__error">
					{error}
				</div>
			)}
			{isLoading && (
				<div className="CampaignNotesGraph__message">
					{lang.t("Loading graph...")}
				</div>
			)}
			{visibleNodeCount === 0 && !isLoading && (
				<div className="CampaignNotesGraph__message">
					{query ? lang.t("Nothing found.") : lang.t("No graph links yet.")}
				</div>
			)}
			<ReactFlow<CampaignFlowNode, CampaignFlowEdge>
				nodes={flowNodes}
				edges={flowEdges}
				nodeTypes={NODE_TYPES}
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

interface CampaignGraphSelectedDetailsProps {
	node: CampaignGraphNode;
	edges: CampaignGraphEdge[];
	detailText: unknown;
	hideTitle: boolean;
	canOpen: boolean;
	onOpen: () => void;
	renderConnection: (edge: CampaignGraphEdge) => ReactNode;
}

function CampaignGraphSelectedDetails({
	node,
	edges,
	detailText,
	hideTitle,
	canOpen,
	onOpen,
	renderConnection,
}: CampaignGraphSelectedDetailsProps) {
	return (
		<>
			<div className="CampaignNotesGraph__detailHeader">
				<div>
					<div className="CampaignNotesGraph__type">
						<span
							className={`CampaignNotesGraph__dot ${getCampaignGraphNodeTypeClass(node.type)}`}
						/>
						{lang.t(TYPE_LABELS[node.type] || node.type)}
					</div>
					{!hideTitle && <h4>{node.label}</h4>}
				</div>
				{canOpen && (
					<Button
						variant="ghost"
						size={Button.SIZES.SMALL}
						icon="forward"
						onClick={onOpen}
						title={lang.t("Open {name}", { name: node.label })}
					/>
				)}
			</div>
			<ParsedGraphText text={detailText} onOpen={canOpen ? onOpen : undefined} />
			<dl className="CampaignNotesGraph__stats">
				<div>
					<dt>{lang.t("Connections")}</dt>
					<dd>{edges.length}</dd>
				</div>
				{node.meta.fileName && (
					<div>
						<dt>{lang.t("Session")}</dt>
						<dd>{getCampaignGraphSessionDisplayName(node.meta.fileName)}</dd>
					</div>
				)}
			</dl>
			{edges.length > 0 && (
				<div className="CampaignNotesGraph__connections">
					{edges.map(renderConnection)}
				</div>
			)}
		</>
	);
}

interface CampaignGraphOverviewProps {
	visibleNodeCount: number;
	visibleEdgeCount: number;
	unresolvedCount: number;
	visibleNodes: CampaignGraphNode[];
}

function CampaignGraphOverview({
	visibleNodeCount,
	visibleEdgeCount,
	unresolvedCount,
	visibleNodes,
}: CampaignGraphOverviewProps) {
	const visibleTypes = NODE_TYPE_ORDER.filter((type) =>
		visibleNodes.some((node) => node.type === type),
	);
	return (
		<>
			<div className="CampaignNotesGraph__overviewTitle">
				<span className="CampaignNotesGraph__overviewIcon">
					<Icon name="notes-graph" size={20} />
				</span>
				<h4>{lang.t("Graph overview")}</h4>
			</div>
			<dl className="CampaignNotesGraph__stats CampaignNotesGraph__stats__cards">
				<div>
					<dt>{lang.t("Nodes")}</dt>
					<dd>{visibleNodeCount}</dd>
				</div>
				<div>
					<dt>{lang.t("Connections")}</dt>
					<dd>{visibleEdgeCount}</dd>
				</div>
				<div>
					<dt>{lang.t("Unknown mention")}</dt>
					<dd>{unresolvedCount}</dd>
				</div>
			</dl>
			<div className="CampaignNotesGraph__legend">
				{visibleTypes.map((type) => (
					<span key={type}>
						<span
							className={`CampaignNotesGraph__dot ${getCampaignGraphNodeTypeClass(type)}`}
						/>
						{lang.t(TYPE_LABELS[type] || type)}
					</span>
				))}
			</div>
		</>
	);
}

interface CampaignGraphDetailsProps {
	selectedNode: CampaignGraphNode | null | undefined;
	selectedEdges: CampaignGraphEdge[];
	selectedCanOpen: boolean;
	onOpenSelected: () => void;
	renderConnection: (edge: CampaignGraphEdge) => ReactNode;
	graph: CampaignGraphResult;
	visibleNodes: CampaignGraphNode[];
	visibleEdgeCount: number;
	visibleNodeCount: number;
}

function CampaignGraphDetails({
	selectedNode,
	selectedEdges,
	selectedCanOpen,
	onOpenSelected,
	renderConnection,
	graph,
	visibleNodes,
	visibleEdgeCount,
	visibleNodeCount,
}: CampaignGraphDetailsProps) {
	return (
		<aside className="CampaignNotesGraph__details">
			{selectedNode ? (
				<CampaignGraphSelectedDetails
					node={selectedNode}
					edges={selectedEdges}
					detailText={selectedNode.detailText || selectedNode.summary || ""}
					hideTitle={Boolean(selectedNode.meta.isSimplifiedNote)}
					canOpen={selectedCanOpen}
					onOpen={onOpenSelected}
					renderConnection={renderConnection}
				/>
			) : (
				<CampaignGraphOverview
					visibleNodeCount={visibleNodeCount}
					visibleEdgeCount={visibleEdgeCount}
					unresolvedCount={graph.stats.unresolved}
					visibleNodes={visibleNodes}
				/>
			)}
		</aside>
	);
}

export default function CampaignNotesGraph({
	campaign,
	description,
	notes,
	characters,
	npcs,
	locations,
	sessions,
	sessionDetails,
	isLoading,
	error,
	onLoadSessionDetails,
	onSaveNote,
	onOpenSession,
}: CampaignNotesGraphProps) {
	const [enabledFilters, setEnabledFilters] =
		useState<CampaignGraphEnabledFilters>(() => ({
			...DEFAULT_CAMPAIGN_GRAPH_FILTERS,
		}));
	const [query, setQuery] = useState("");
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [entityModalState, setEntityModalState] =
		useState<CampaignGraphEntityModalState | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [flowInstance, setFlowInstance] =
		useState<ReactFlowInstance<CampaignFlowNode, CampaignFlowEdge> | null>(null);
	const [flowNodes, setFlowNodes, onFlowNodesChange] =
		useNodesState<CampaignFlowNode>([]);
	const fittedNodeTopologyRef = useRef<string | null>(null);
	const positionedCampaignRef = useRef(campaign.slug);
	const hasManualPositionsRef = useRef(false);
	const shouldRelayoutForFilterRef = useRef(false);
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const currentTheme = useAppSelector((state) => state.ui.theme);
	const currentLanguage = useAppSelector(
		(state) => state.localization.language,
	);

	useEffect(() => {
		void onLoadSessionDetails();
	}, [onLoadSessionDetails]);

	const graph = useMemo(
		() =>
			buildCampaignGraph({
				campaign,
				description,
				notes,
				characters,
				npcs,
				locations,
				sessions,
				sessionDetails,
				simplifiedNotes: simplifiedNotesEnabled,
			}),
		[
			campaign,
			description,
			notes,
			characters,
			npcs,
			locations,
			sessions,
			sessionDetails,
			simplifiedNotesEnabled,
		],
	);

	const visibleGraph = useMemo(
		() => getVisibleCampaignGraph(graph, enabledFilters, normalizeGraphName(query)),
		[enabledFilters, graph, query],
	);
	const typeCounts = useMemo(
		() => getCampaignGraphTypeCounts(graph.nodes),
		[graph.nodes],
	);
	const layoutPositions = useCampaignGraphLayout(graph.nodes, graph.edges);
	const nodeTopologyKey = getGraphNodeTopologyKey(graph.nodes);
	const flowNodeTopologyKey = getGraphNodeTopologyKey(flowNodes);
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

	const openNode = useCallback(
		(node: CampaignGraphNode) => {
			const target = getCampaignGraphOpenTarget({
				node,
				characters,
				npcs,
				locations,
				notes,
				sessionDetails,
				canSaveNote: typeof onSaveNote === "function",
			});
			if (target.kind === "session") {
				onOpenSession?.(target.fileName);
				return;
			}
			if (target.kind === "entity") {
				setEntityModalState({
					entity: target.entity,
					type: target.entityType,
				});
				return;
			}
			if (target.kind === "note" && typeof onSaveNote === "function") {
				openModalRequest({
					title: lang.t("Note"),
					type: "note",
					showFooter: false,
					children: (
						<GraphNoteModalContent
							note={target.note}
							simplifiedNotes={simplifiedNotesEnabled}
							campaignSlug={campaign.slug}
							onSave={(updates) => {
								const request = getCampaignGraphNoteSaveRequest(node, updates);
								if (request) return onSaveNote(request);
							}}
						/>
					),
				});
			}
		},
		[
			campaign.slug,
			characters,
			locations,
			notes,
			npcs,
			onOpenSession,
			onSaveNote,
			sessionDetails,
			simplifiedNotesEnabled,
		],
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
		fittedNodeTopologyRef.current = null;
	}, [campaign.slug]);

	useEffect(() => {
		setFlowNodes((currentNodes) => {
			const shouldPreservePositions =
				positionedCampaignRef.current === campaign.slug;
			positionedCampaignRef.current = campaign.slug;
			const currentNodeIds = new Set(currentNodes.map((node) => node.id));
			const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
			const hasNodeTopologyChanged =
				currentNodeIds.size !== graphNodeIds.size ||
				[...graphNodeIds].some((nodeId) => !currentNodeIds.has(nodeId));
			const shouldUseFreshLayout =
				!shouldPreservePositions ||
				currentNodes.length === 0 ||
				(hasNodeTopologyChanged && !hasManualPositionsRef.current);
			const currentById = !shouldUseFreshLayout
				? new Map(currentNodes.map((node) => [node.id, node]))
				: new Map<string, CampaignFlowNode>();
			let nextNodes = graph.nodes.map<CampaignFlowNode>((graphNode) => {
				const currentNode = currentById.get(graphNode.id);
				const size = getCampaignGraphNodeSize(graphNode.type);
				return {
					...currentNode,
					id: graphNode.id,
					type: "campaignGraphNode",
					position:
						currentNode?.position ||
						layoutPositions[graphNode.id] || { x: 0, y: 0 },
					origin: [0.5, 0.5] as const,
					zIndex: selectedNodeId === graphNode.id ? 3 : 2,
					style: { width: size.width, height: size.height },
					data: {
						graphNode,
						color: NODE_COLOR_BY_TYPE[graphNode.type] ?? "#94a3b8",
						typeLabel: lang.t(TYPE_LABELS[graphNode.type] || graphNode.type),
						connectionsLabel: lang.t("Connections"),
						isSelected: selectedNodeId === graphNode.id,
						isMuted:
							Boolean(focusedNodeId) && !connectedIds.has(graphNode.id),
						canOpen: canOpenCampaignGraphNode(
							graphNode,
							typeof onSaveNote === "function",
						),
						onOpen: openNode,
						openLabel: lang.t("Open {name}", { name: graphNode.label }),
					},
					hidden: !visibleGraph.visibleNodeIds.has(graphNode.id),
					selected: selectedNodeId === graphNode.id,
					draggable: true,
					selectable: true,
					connectable: false,
					deletable: false,
					focusable: true,
					ariaLabel: `${lang.t(TYPE_LABELS[graphNode.type] || graphNode.type)}: ${graphNode.label}`,
					ariaRole: "button",
					className: getCampaignGraphNodeTypeClass(graphNode.type),
				};
			});

			if (!shouldUseFreshLayout) {
				const newNodeIds = nextNodes
					.filter((node) => !currentNodeIds.has(node.id))
					.map((node) => node.id);
				newNodeIds.forEach((nodeId) => {
					const position = resolveCampaignGraphNodeCollision(
						nextNodes,
						nodeId,
					);
					nextNodes = nextNodes.map((node) =>
						node.id === nodeId ? { ...node, position } : node,
					);
				});
			}

			return nextNodes;
		});
	}, [
		campaign.slug,
		connectedIds,
		focusedNodeId,
		graph.nodes,
		layoutPositions,
		onSaveNote,
		openNode,
		selectedNodeId,
		setFlowNodes,
		visibleGraph.visibleNodeIds,
	]);

	useEffect(() => {
		if (!shouldRelayoutForFilterRef.current) return undefined;
		shouldRelayoutForFilterRef.current = false;

		const nextPositions = layoutCampaignGraph(
			visibleGraph.nodes,
			visibleGraph.edges,
		);
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
	}, [
		flowInstance,
		setFlowNodes,
		visibleGraph.edges,
		visibleGraph.nodes,
	]);

	const flowEdges = useMemo<CampaignFlowEdge[]>(() => {
		const positions = new Map(flowNodes.map((node) => [node.id, node.position]));
		const hasFocus = Boolean(focusedNodeId);
		return graph.edges.map<CampaignFlowEdge>((edge) => {
			const isVisible = visibleGraph.visibleEdgeIds.has(edge.id);
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
					opacity: getCampaignGraphEdgeOpacity(
						edge,
						presentation.isFocused,
						hasFocus,
					),
					strokeDasharray: presentation.strokeDasharray,
				},
				markerEnd: getCampaignFlowEdgeMarker(
					presentation.hasSequenceMarker,
					color,
				),
				label: presentation.label,
				labelStyle: { fill: "var(--text-bright)", fontWeight: 700 },
				labelBgStyle: {
					fill: "var(--panel)",
					fillOpacity: 0.92,
				},
				labelBgPadding: [5, 3] as [number, number],
				labelBgBorderRadius: 8,
				zIndex: 0,
			};
		});
	}, [flowNodes, focusedNodeId, graph.edges, visibleGraph.visibleEdgeIds]);

	useEffect(() => {
		if (
			!flowInstance ||
			flowNodes.length === 0 ||
			flowNodes.length !== graph.nodes.length ||
			flowNodeTopologyKey !== nodeTopologyKey ||
			hasManualPositionsRef.current ||
			fittedNodeTopologyRef.current === nodeTopologyKey
		) {
			return undefined;
		}
		fittedNodeTopologyRef.current = nodeTopologyKey;
		const frame = requestAnimationFrame(() => {
			flowInstance.fitView({ padding: 0.16, duration: 520 });
		});
		return () => cancelAnimationFrame(frame);
	}, [
		flowInstance,
		flowNodeTopologyKey,
		flowNodes.length,
		graph.nodes.length,
		nodeTopologyKey,
	]);

	const handleRelayout = useCallback(() => {
		hasManualPositionsRef.current = false;
		const nextPositions = layoutCampaignGraph(
			visibleGraph.nodes,
			visibleGraph.edges,
		);
		setFlowNodes((currentNodes) =>
			currentNodes.map((node) => ({
				...node,
				position: nextPositions[node.id] || node.position,
			})),
		);
		requestAnimationFrame(() => {
			flowInstance?.fitView({ padding: 0.16, duration: 520 });
		});
	}, [
		flowInstance,
		setFlowNodes,
		visibleGraph.edges,
		visibleGraph.nodes,
	]);

	const handleNodeDragStop = useCallback<OnNodeDrag<CampaignFlowNode>>(
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
		[setFlowNodes],
	);

	const handleFlowNodesChange = useCallback(
		(changes: NodeChange<CampaignFlowNode>[]) => {
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
		[onFlowNodesChange],
	);

	const toggleFilter = (filterId: CampaignGraphFilterId) => {
		shouldRelayoutForFilterRef.current = true;
		setEnabledFilters((previous) => ({
			...previous,
			[filterId]: !previous[filterId],
		}));
	};

	const renderConnection = (edge: CampaignGraphEdge): ReactElement | null => {
		const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
		const otherNode = visibleGraph.nodeById.get(otherId);
		if (!otherNode) return null;
		const sourceLabels = formatCampaignGraphSourceList(edge.sources, lang.t);
		const connectionMetaText = `${lang.t(getCampaignGraphRelationLabel(edge.relation))}${
			edge.count > 1 ? ` (${edge.count})` : ""
		}${sourceLabels ? ` · ${sourceLabels}` : ""}`;

		return (
			<button
				key={edge.id}
				type="button"
				className="CampaignNotesGraph__connection"
				onClick={() => {
					if (otherNode.type === "session" && otherNode.meta?.fileName) {
						onOpenSession?.(otherNode.meta.fileName);
						return;
					}
					setSelectedNodeId(otherNode.id);
				}}
			>
				<span
					className={`CampaignNotesGraph__dot ${getCampaignGraphNodeTypeClass(otherNode.type)}`}
				/>
				<span className="CampaignNotesGraph__connectionText">
					<strong>{renderMentionText(otherNode.label)}</strong>
					<span>{renderMentionText(connectionMetaText)}</span>
				</span>
			</button>
		);
	};

	const visibleNonCampaignNodes = visibleGraph.nodes.filter(
		(node) => node.type !== "campaign",
	).length;
	const totalNonCampaignNodes = graph.nodes.filter(
		(node) => node.type !== "campaign",
	).length;
	const selectedCanOpen = canOpenCampaignGraphNode(
		selectedNode,
		typeof onSaveNote === "function",
	);
	const openGraphNodeById = (nodeId: string) => {
		const node = graph.nodes.find((item) => item.id === nodeId);
		if (node) openNode(node);
	};
	const openSelectedNode = () => {
		if (selectedNode) openNode(selectedNode);
	};

	const ariaLabelConfig = useMemo(
		() => {
			void currentLanguage;
			return {
				"node.a11yDescription.default": lang.t(
					"Press Enter or Space to select a node. Use the arrow keys to move it.",
				),
				"node.a11yDescription.keyboardDisabled": lang.t(
					"Press Enter or Space to select a node.",
				),
				"controls.ariaLabel": lang.t("Graph controls"),
				"controls.zoomIn.ariaLabel": lang.t("Zoom in"),
				"controls.zoomOut.ariaLabel": lang.t("Zoom out"),
				"controls.fitView.ariaLabel": lang.t("Fit graph to view"),
				"minimap.ariaLabel": lang.t("Graph minimap"),
			};
		},
		[currentLanguage],
	);

	return (
		<div className="CampaignNotesGraph">
			<div className="CampaignNotesGraph__workspace">
				<CampaignGraphToolbar
					query={query}
					onQueryChange={setQuery}
					visibleNodeCount={visibleNonCampaignNodes}
					totalNodeCount={totalNonCampaignNodes}
					onRelayout={handleRelayout}
					enabledFilters={enabledFilters}
					typeCounts={typeCounts}
					onToggleFilter={toggleFilter}
				/>
				<CampaignGraphCanvas
					error={error}
					isLoading={isLoading}
					visibleNodeCount={visibleNonCampaignNodes}
					query={query}
					flowNodes={flowNodes}
					flowEdges={flowEdges}
					onInit={setFlowInstance}
					onNodesChange={handleFlowNodesChange}
					onNodeSelect={setSelectedNodeId}
					onNodeOpen={openGraphNodeById}
					onNodeHover={setHoveredNodeId}
					onNodeDragStop={handleNodeDragStop}
					onPaneClick={() => setSelectedNodeId(null)}
					ariaLabelConfig={ariaLabelConfig}
					colorMode={currentTheme === "dark" ? "dark" : "light"}
				/>
			</div>
			<CampaignGraphDetails
				selectedNode={selectedNode}
				selectedEdges={selectedEdges}
				selectedCanOpen={selectedCanOpen}
				onOpenSelected={openSelectedNode}
				renderConnection={renderConnection}
				graph={graph}
				visibleNodes={visibleGraph.nodes}
				visibleEdgeCount={visibleGraph.edges.length}
				visibleNodeCount={visibleNonCampaignNodes}
			/>
			<EntityModal
				modalState={entityModalState}
				onClose={() => setEntityModalState(null)}
			/>
		</div>
	);
}
