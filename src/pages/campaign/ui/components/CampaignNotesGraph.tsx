import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactElement,
	type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
	MarkerType,
	useNodesState,
	type NodeChange,
	type OnNodeDrag,
	type ReactFlowInstance,
} from "@xyflow/react";

import { Button, Icon } from "../../../../shared/ui/index.js";
import {
	EditableField,
	type EditableFieldChangeEvent,
} from "../../../../features/editor/ui/index.js";
import { useSimplifiedNotesEnabled } from "../../../../features/notes/ui/index.js";
import {
	EntityModal,
	renderMentionText,
	type EntityModalProps,
} from "../../../../features/entity-link/index.js";
import { classNames } from "../../../../shared/lib/index.js";
import {
	buildCampaignGraph,
	normalizeGraphName,
	layoutCampaignGraph,
	resolveCampaignGraphNodeCollision,
} from "../../graph.js";
import {
	CAMPAIGN_GRAPH_FILTERS,
	DEFAULT_CAMPAIGN_GRAPH_FILTERS,
	canOpenCampaignGraphNode,
	executeCampaignGraphOpenTarget,
	formatCampaignGraphSourceList,
	getCampaignGraphConnectionPresentation,
	getCampaignGraphConnectedEdges,
	getCampaignGraphConnectedIds,
	getCampaignGraphDetailTextPresentation,
	getCampaignGraphEdgeColor,
	getCampaignGraphEdgeHandles,
	getCampaignGraphEdgeOpacity,
	getCampaignGraphEdgePresentation,
	getCampaignGraphEdgeStrokeWidth,
	getCampaignGraphFlowNodePresentation,
	getCampaignGraphFlowProjectionPlan,
	getCampaignGraphNodeTopologyKey,
	getCampaignGraphNoteSaveRequest,
	getCampaignGraphNodeTypeClass,
	getCampaignGraphOpenTarget,
	getCampaignGraphRelationLabel,
	getCampaignGraphSessionDisplayName,
	getCampaignGraphTypeCounts,
	getVisibleCampaignGraph,
	resolveNewCampaignGraphNodeCollisions,
	shouldActivateCampaignGraphDetailText,
	shouldFitCampaignGraphTopology,
	type CampaignGraphEnabledFilters,
	type CampaignGraphFilterId,
	type CampaignGraphConnectionAction,
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
import { useCampaignPageRuntime } from "../../model/CampaignPageRuntime.tsx";
import {
	CampaignGraphCanvas,
	type CampaignGraphFlowEdge,
} from "./CampaignGraphCanvas.tsx";
import {
	CampaignGraphNodeCard,
	type CampaignGraphFlowNode,
} from "./CampaignGraphNodeCard.tsx";
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

type CampaignGraphEntityModalState = NonNullable<EntityModalProps["modalState"]>;
type GraphCssProperties = CSSProperties & Record<`--${string}`, string | number>;

type CampaignFlowNode = CampaignGraphFlowNode;
type CampaignFlowEdge = CampaignGraphFlowEdge;

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
	return React.Children.map(children, renderMentionChild);
}

function renderMentionChild(child: ReactNode): ReactNode {
	if (typeof child === "string") return renderMentionText(child);
	const element = getRecursiveMentionElement(child);
	return element
		? React.cloneElement(element, { children: renderMentionChildren(element.props.children) })
		: child;
}

function getRecursiveMentionElement(
	child: ReactNode,
): ReactElement<{ children?: ReactNode }> | null {
	if (!React.isValidElement<{ children?: ReactNode }>(child)) return null;
	if (!child.props.children) return null;
	if (["code", "pre"].includes(String(child.type))) return null;
	return child;
}

interface ParsedGraphTextProps {
	text: unknown;
	onOpen?: () => void;
}

function ParsedGraphText({ text, onOpen }: ParsedGraphTextProps) {
	const presentation = getCampaignGraphDetailTextPresentation(text, Boolean(onOpen));
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

	if (!presentation.isVisible) return null;

	return (
		<div
			className={presentation.className}
			role={presentation.role}
			tabIndex={presentation.tabIndex}
			onClick={(event) => {
				const isInteractiveTarget =
					event.target instanceof Element &&
					Boolean(event.target.closest("a, button, input, textarea, select"));
				if (shouldActivateCampaignGraphDetailText(Boolean(onOpen), "pointer", isInteractiveTarget)) {
					onOpen?.();
				}
			}}
			onKeyDown={(event) => {
				if (!shouldActivateCampaignGraphDetailText(Boolean(onOpen), event.key)) return;
				event.preventDefault();
				onOpen?.();
			}}
		>
			<ReactMarkdown components={components}>{presentation.text}</ReactMarkdown>
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

const NODE_TYPES = { campaignGraphNode: CampaignGraphNodeCard };

function getCurrentCampaignFlowNodeMap(
	nodes: CampaignFlowNode[],
	shouldUseFreshLayout: boolean,
): Map<string, CampaignFlowNode> {
	if (shouldUseFreshLayout) return new Map();
	return new Map(nodes.map((node) => [node.id, node]));
}

function executeCampaignGraphConnectionAction(
	action: CampaignGraphConnectionAction,
	onOpenSession: ((fileName: string) => void) | undefined,
	onSelectNode: (nodeId: string) => void,
): void {
	if (action.kind === "session") onOpenSession?.(action.fileName);
	else onSelectNode(action.nodeId);
}

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
			<CampaignGraphSelectedHeader node={node} hideTitle={hideTitle} canOpen={canOpen} onOpen={onOpen} />
			<ParsedGraphText text={detailText} onOpen={canOpen ? onOpen : undefined} />
			<CampaignGraphSelectedStats node={node} edgeCount={edges.length} />
			<CampaignGraphSelectedConnections edges={edges} renderConnection={renderConnection} />
		</>
	);
}

function CampaignGraphSelectedHeader({ node, hideTitle, canOpen, onOpen }: Pick<
	CampaignGraphSelectedDetailsProps,
	"node" | "hideTitle" | "canOpen" | "onOpen"
>) {
	return (
		<div className="CampaignNotesGraph__detailHeader">
			<div>
				<div className="CampaignNotesGraph__type">
					<span className={`CampaignNotesGraph__dot ${getCampaignGraphNodeTypeClass(node.type)}`} />
					{lang.t(TYPE_LABELS[node.type] || node.type)}
				</div>
				{!hideTitle && <h4>{node.label}</h4>}
			</div>
			{canOpen && (
				<Button variant="ghost" size={Button.SIZES.SMALL} icon="forward" onClick={onOpen}
					title={lang.t("Open {name}", { name: node.label })} />
			)}
		</div>
	);
}

function CampaignGraphSelectedStats({ node, edgeCount }: { node: CampaignGraphNode; edgeCount: number }) {
	return (
		<dl className="CampaignNotesGraph__stats">
			<div><dt>{lang.t("Connections")}</dt><dd>{edgeCount}</dd></div>
			{node.meta.fileName && (
				<div><dt>{lang.t("Session")}</dt><dd>{getCampaignGraphSessionDisplayName(node.meta.fileName)}</dd></div>
			)}
		</dl>
	);
}

function CampaignGraphSelectedConnections({ edges, renderConnection }: Pick<
	CampaignGraphSelectedDetailsProps,
	"edges" | "renderConnection"
>) {
	if (edges.length === 0) return null;
	return <div className="CampaignNotesGraph__connections">{edges.map(renderConnection)}</div>;
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
	const simplifiedNotesEnabled = useSimplifiedNotesEnabled();
	const {
		currentLanguage,
		openModal,
		theme: currentTheme,
	} = useCampaignPageRuntime();

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
	const nodeTopologyKey = getCampaignGraphNodeTopologyKey(graph.nodes);
	const flowNodeTopologyKey = getCampaignGraphNodeTopologyKey(flowNodes);
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

	const openGraphNote = useCallback(
		(node: CampaignGraphNode, note: SharedNote) => {
			if (typeof onSaveNote !== "function") return;
			openModal({
				title: lang.t("Note"),
				type: "note",
				showFooter: false,
				children: (
					<GraphNoteModalContent
						note={note}
						simplifiedNotes={simplifiedNotesEnabled}
						campaignSlug={campaign.slug}
						onSave={(updates) => {
							const request = getCampaignGraphNoteSaveRequest(node, updates);
							if (request) return onSaveNote(request);
						}}
					/>
				),
			});
		},
		[campaign.slug, onSaveNote, openModal, simplifiedNotesEnabled],
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
			executeCampaignGraphOpenTarget(target, {
				session: (fileName) => onOpenSession?.(fileName),
				entity: (entity, type) => setEntityModalState({ entity, type }),
				note: (note) => openGraphNote(node, note),
			});
		},
		[
			characters,
			locations,
			notes,
			npcs,
			openGraphNote,
			onOpenSession,
			onSaveNote,
			sessionDetails,
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
			const projection = getCampaignGraphFlowProjectionPlan(
				currentNodes.map((node) => node.id),
				graph.nodes.map((node) => node.id),
				shouldPreservePositions,
				hasManualPositionsRef.current,
			);
			const currentById = getCurrentCampaignFlowNodeMap(
				currentNodes,
				projection.shouldUseFreshLayout,
			);
			const projectedNodes = graph.nodes.map<CampaignFlowNode>((graphNode) => {
				const currentNode = currentById.get(graphNode.id);
				const presentation = getCampaignGraphFlowNodePresentation({
					graphNode,
					currentNode,
					layoutPosition: layoutPositions[graphNode.id],
					selectedNodeId,
					focusedNodeId,
					connectedIds,
					visibleNodeIds: visibleGraph.visibleNodeIds,
					canSaveNote: typeof onSaveNote === "function",
					colors: NODE_COLOR_BY_TYPE,
					typeLabels: TYPE_LABELS,
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
						onOpen: openNode,
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
		if (!shouldFitCampaignGraphTopology({
			hasFlowInstance: Boolean(flowInstance),
			flowNodeCount: flowNodes.length,
			graphNodeCount: graph.nodes.length,
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
		const sourceLabels = formatCampaignGraphSourceList(edge.sources, lang.t);
		const presentation = getCampaignGraphConnectionPresentation(
			edge,
			selectedNodeId,
			visibleGraph.nodeById,
			lang.t(getCampaignGraphRelationLabel(edge.relation)),
			sourceLabels,
		);
		if (!presentation) return null;

		return (
			<button
				key={edge.id}
				type="button"
				className="CampaignNotesGraph__connection"
				onClick={() => executeCampaignGraphConnectionAction(
					presentation.action,
					onOpenSession,
					setSelectedNodeId,
				)}
			>
				<span
					className={`CampaignNotesGraph__dot ${getCampaignGraphNodeTypeClass(presentation.node.type)}`}
				/>
				<span className="CampaignNotesGraph__connectionText">
					<strong>{renderMentionText(presentation.node.label)}</strong>
					<span>{renderMentionText(presentation.metaText)}</span>
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
					nodeTypes={NODE_TYPES}
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
