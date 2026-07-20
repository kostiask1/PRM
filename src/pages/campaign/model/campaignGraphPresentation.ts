import type {
	CampaignGraphEdge,
	CampaignGraphNode,
	CampaignGraphResult,
} from "./campaignGraph.ts";
import {
	getCampaignGraphFlowNodeSize,
	getCampaignGraphNodeSize,
	resolveCampaignGraphNodeCollision,
	type CampaignGraphLayoutNode,
	type GraphPosition,
} from "./campaignGraphLayout.ts";
import type {
	CampaignGraphNoteSave,
	CampaignPageEntity,
	CampaignSessionDetails,
} from "./contracts.ts";
import type { SharedNote } from "../../../shared/lib/index.js";

export type CampaignGraphNodeType =
	| "campaign"
	| "campaign-note"
	| "character"
	| "npc"
	| "location"
	| "session"
	| "scene"
	| "session-note"
	| "scene-note"
	| "unresolved";

export type CampaignGraphFilterId =
	| "notes"
	| "characters"
	| "npc"
	| "locations"
	| "sessions"
	| "scenes"
	| "unresolved";

export type CampaignGraphRelation =
	| "contains"
	| "sequence"
	| "related"
	| "mentions";

export type CampaignGraphEntityType = "characters" | "npc" | "locations";
export type CampaignGraphEnabledFilters = Record<CampaignGraphFilterId, boolean>;
export type CampaignGraphTypeCounts = Partial<Record<CampaignGraphFilterId, number>>;
export type GraphTranslate = (key: string) => string;

export interface CampaignGraphFilter {
	id: CampaignGraphFilterId;
	label: string;
	types: readonly CampaignGraphNodeType[];
}

export interface CampaignGraphSource extends Record<string, unknown> {
	field?: unknown;
	type?: unknown;
}

export interface CampaignGraphVisibleResult {
	nodes: CampaignGraphNode[];
	edges: CampaignGraphEdge[];
	visibleNodeIds: Set<string>;
	visibleEdgeIds: Set<string>;
	nodeById: Map<string, CampaignGraphNode>;
}

export interface CampaignGraphBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CampaignGraphFlowNodePresentation {
	position: GraphPosition;
	size: { width: number; height: number };
	color: string;
	typeLabelKey: string;
	isSelected: boolean;
	isMuted: boolean;
	canOpen: boolean;
	hidden: boolean;
	className: string;
}

export interface CampaignGraphFlowNodePresentationInput {
	graphNode: CampaignGraphNode;
	currentNode?: CampaignGraphLayoutNode;
	layoutPosition?: GraphPosition;
	selectedNodeId: string | null;
	focusedNodeId: string | null;
	connectedIds: ReadonlySet<string>;
	visibleNodeIds: ReadonlySet<string>;
	canSaveNote: boolean;
	colors: Readonly<Record<string, string>>;
	typeLabels: Readonly<Record<string, string>>;
}

export interface CampaignGraphEdgeHandles {
	sourceHandle: string;
	targetHandle: string;
}

export interface CampaignGraphNodeCardPresentation {
	className: string;
	showSummary: boolean;
	showDegree: boolean;
	showOpen: boolean;
}

export interface CampaignGraphDetailTextPresentation {
	text: string;
	isVisible: boolean;
	className: string;
	role?: "button";
	tabIndex?: 0;
}

export interface CampaignGraphTopologyFitInput {
	hasFlowInstance: boolean;
	flowNodeCount: number;
	graphNodeCount: number;
	flowNodeTopologyKey: string;
	nodeTopologyKey: string;
	hasManualPositions: boolean;
	hasFittedTopology: boolean;
}

export type CampaignGraphOpenTarget =
	| { kind: "session"; fileName: string }
	| {
			kind: "entity";
			entity: CampaignPageEntity;
			entityType: CampaignGraphEntityType;
	  }
	| { kind: "note"; note: SharedNote }
	| { kind: "none" };

export interface CampaignGraphOpenTargetInput {
	node: CampaignGraphNode;
	characters: CampaignPageEntity[];
	npcs: CampaignPageEntity[];
	locations: CampaignPageEntity[];
	notes: SharedNote[];
	sessionDetails: CampaignSessionDetails;
	canSaveNote: boolean;
}

export const CAMPAIGN_GRAPH_FILTERS: readonly CampaignGraphFilter[] = [
	{
		id: "notes",
		label: "Notes",
		types: ["campaign-note", "session-note", "scene-note"],
	},
	{ id: "characters", label: "Characters", types: ["character"] },
	{ id: "npc", label: "NPC", types: ["npc"] },
	{ id: "locations", label: "Locations/Factions", types: ["location"] },
	{ id: "sessions", label: "Sessions", types: ["session"] },
	{ id: "scenes", label: "Scenes", types: ["scene"] },
	{ id: "unresolved", label: "Unknown mention", types: ["unresolved"] },
];

export const DEFAULT_CAMPAIGN_GRAPH_FILTERS: CampaignGraphEnabledFilters = {
	notes: true,
	characters: true,
	npc: true,
	locations: true,
	sessions: true,
	scenes: true,
	unresolved: true,
};

export function getCampaignGraphNodeCardPresentation(
	node: CampaignGraphNode,
	selected: boolean,
	isSelected: boolean,
	isMuted: boolean,
	canOpen: boolean,
): CampaignGraphNodeCardPresentation {
	return {
		className: [
			"CampaignNotesGraph__nodeCard",
			getCampaignGraphNodeTypeClass(node.type),
			selected || isSelected ? "is_selected" : "",
			isMuted ? "is_muted" : "",
		].filter(Boolean).join(" "),
		showSummary: Boolean(node.summary),
		showDegree: node.degree > 0,
		showOpen: canOpen,
	};
}

export function getCampaignGraphDetailTextPresentation(
	value: unknown,
	canOpen: boolean,
): CampaignGraphDetailTextPresentation {
	const text = String(value || "");
	return {
		text,
		isVisible: Boolean(text.trim()),
		className: canOpen
			? "CampaignNotesGraph__detailText is_clickable"
			: "CampaignNotesGraph__detailText",
		role: canOpen ? "button" : undefined,
		tabIndex: canOpen ? 0 : undefined,
	};
}

export function shouldActivateCampaignGraphDetailText(
	canOpen: boolean,
	trigger: "pointer" | string,
	isInteractiveTarget = false,
): boolean {
	if (!canOpen) return false;
	if (trigger === "pointer") return !isInteractiveTarget;
	return ["Enter", " "].includes(trigger);
}

export function shouldFitCampaignGraphTopology(
	input: CampaignGraphTopologyFitInput,
): boolean {
	return [
		input.hasFlowInstance,
		input.flowNodeCount > 0,
		input.flowNodeCount === input.graphNodeCount,
		input.flowNodeTopologyKey === input.nodeTopologyKey,
		!input.hasManualPositions,
		!input.hasFittedTopology,
	].every(Boolean);
}

function getCampaignGraphFlowNodePosition(
	currentNode: CampaignGraphLayoutNode | undefined,
	layoutPosition: GraphPosition | undefined,
): GraphPosition {
	return (currentNode?.position as GraphPosition | undefined) || layoutPosition || { x: 0, y: 0 };
}

function getCampaignGraphMappedValue(
	values: Readonly<Record<string, string>>,
	key: string,
	fallback: string,
): string {
	return values[key] || fallback;
}

function isCampaignGraphFlowNodeMuted(
	focusedNodeId: string | null,
	connectedIds: ReadonlySet<string>,
	nodeId: string,
): boolean {
	return Boolean(focusedNodeId) && !connectedIds.has(nodeId);
}

export function getCampaignGraphFlowNodePresentation(
	input: CampaignGraphFlowNodePresentationInput,
): CampaignGraphFlowNodePresentation {
	const { graphNode } = input;
	const isSelected = input.selectedNodeId === graphNode.id;
	return {
		position: getCampaignGraphFlowNodePosition(input.currentNode, input.layoutPosition),
		size: getCampaignGraphNodeSize(graphNode.type),
		color: getCampaignGraphMappedValue(input.colors, graphNode.type, "#94a3b8"),
		typeLabelKey: getCampaignGraphMappedValue(input.typeLabels, graphNode.type, graphNode.type),
		isSelected,
		isMuted: isCampaignGraphFlowNodeMuted(input.focusedNodeId, input.connectedIds, graphNode.id),
		canOpen: canOpenCampaignGraphNode(graphNode, input.canSaveNote),
		hidden: !input.visibleNodeIds.has(graphNode.id),
		className: getCampaignGraphNodeTypeClass(graphNode.type),
	};
}

export function resolveNewCampaignGraphNodeCollisions<
	TNode extends CampaignGraphLayoutNode & { id: string; position: GraphPosition },
>(
	nodes: TNode[],
	currentNodeIds: ReadonlySet<string>,
	shouldUseFreshLayout: boolean,
): TNode[] {
	if (shouldUseFreshLayout) return nodes;
	const newNodeIds = nodes
		.filter((node) => !currentNodeIds.has(node.id))
		.map((node) => node.id);
	return newNodeIds.reduce((nextNodes, nodeId) => {
		const position = resolveCampaignGraphNodeCollision(nextNodes, nodeId);
		return nextNodes.map((node) => node.id === nodeId ? { ...node, position } : node);
	}, nodes);
}

const FILTER_BY_NODE_TYPE = new Map<CampaignGraphNodeType, CampaignGraphFilterId>(
	CAMPAIGN_GRAPH_FILTERS.flatMap((filter) =>
		filter.types.map((type) => [type, filter.id] as const),
	),
);

const SOURCE_CONTEXT_LABELS: Readonly<Record<string, string>> = {
	campaign: "Campaign story",
	"campaign-note": "Campaign notes",
	character: "Character",
	npc: "NPC",
	location: "Location/Faction",
	session: "Session",
	"session-note": "Session notes",
	scene: "Scene",
	"scene-note": "Scene notes",
};

const FIELD_LABELS: Readonly<Record<string, string>> = {
	title: "Name",
	name: "Name",
	text: "Note text",
	summary: "Summary",
	goal: "Players' goal",
	location: "Location",
	stakes: "Stakes",
	description: "Description",
	motivation: "Motivation",
	trait: "Trait",
	result_text: "Session result",
};

const ROOT_FIELD_LABELS: Readonly<Record<string, string>> = {
	description: "Campaign story",
	result_text: "Session result",
	notes: "Notes",
	scenes: "Scenes",
};

const NESTED_NOTES_LABELS: Readonly<Record<string, string>> = {
	character: "Character notes",
	npc: "NPC notes",
	location: "Location notes",
	scene: "Scene notes",
	session: "Session notes",
};

const NOTE_FIELD_PREFIXES: Readonly<Record<string, string>> = {
	"campaign-note": "Campaign note",
	"session-note": "Session note",
	"scene-note": "Scene note",
};

function normalizeSourceField(value: unknown): string {
	return String(value || "")
		.replace(/\[\d+\]/g, "")
		.trim();
}

function getNoteFieldLabel(type: string, shortField: string): string {
	const prefix = NOTE_FIELD_PREFIXES[type];
	if (!prefix) return "Note text";
	return shortField === "title" ? `${prefix} title` : `${prefix} text`;
}

export function getCampaignGraphFilterId(type: unknown): CampaignGraphFilterId {
	return FILTER_BY_NODE_TYPE.get(type as CampaignGraphNodeType) ?? "notes";
}

export function getCampaignGraphNodeTypeClass(type: unknown): string {
	return `is_${String(type || "").replace(/-/g, "_")}`;
}

export function getCampaignGraphSessionDisplayName(fileName: unknown): string {
	return String(fileName || "").replace(/\.json$/i, "");
}

export function getCampaignGraphRelationLabel(relation: unknown): string {
	if (relation === "contains") return "Contains";
	if (relation === "sequence") return "Sequence";
	if (relation === "related") return "Related";
	return "Mentions";
}

export function formatCampaignGraphSourceField(
	source: CampaignGraphSource = {},
	translate: GraphTranslate,
): string {
	const field = normalizeSourceField(source.field);
	if (!field) return "";
	const type = String(source.type || "");
	const shortField = field.split(".").pop() ?? "";
	return translate(getSourceFieldLabel(field, type, shortField));
}

function getSourceFieldLabel(
	field: string,
	type: string,
	shortField: string,
): string {
	const rootLabel = ROOT_FIELD_LABELS[field];
	if (rootLabel) return rootLabel;
	const nestedLabel = getNestedSourceFieldLabel(field, type, shortField);
	if (nestedLabel) return nestedLabel;
	return FIELD_LABELS[shortField] ?? SOURCE_CONTEXT_LABELS[type] ?? "Source";
}

function getNestedSourceFieldLabel(
	field: string,
	type: string,
	shortField: string,
): string | null {
	if (field.includes(".notes.")) return NESTED_NOTES_LABELS[type] ?? "Notes";
	if (field.includes(".note.")) return getNoteFieldLabel(type, shortField);
	return null;
}

export interface CampaignGraphEdgePresentation {
	isFocused: boolean;
	type: "smoothstep" | "default";
	animated: boolean;
	isMuted: boolean;
	strokeDasharray?: string;
	hasSequenceMarker: boolean;
	label?: string;
}

interface CampaignGraphRelationPresentation {
	type: "smoothstep" | "default";
	strokeDasharray?: string;
	hasSequenceMarker: boolean;
}

const DEFAULT_GRAPH_RELATION_PRESENTATION: CampaignGraphRelationPresentation = {
	type: "default",
	hasSequenceMarker: false,
};

const GRAPH_RELATION_PRESENTATION: Readonly<Record<string, CampaignGraphRelationPresentation>> = {
	contains: { type: "smoothstep", hasSequenceMarker: false },
	related: { type: "default", strokeDasharray: "7 6", hasSequenceMarker: false },
	sequence: { type: "default", strokeDasharray: "10 7", hasSequenceMarker: true },
};

function getCampaignGraphRelationPresentation(relation: string): CampaignGraphRelationPresentation {
	return GRAPH_RELATION_PRESENTATION[relation] ?? DEFAULT_GRAPH_RELATION_PRESENTATION;
}

function isCampaignGraphEdgeFocused(edge: CampaignGraphEdge, focusedNodeId: string | null): boolean {
	if (!focusedNodeId) return true;
	return [edge.source === focusedNodeId, edge.target === focusedNodeId].includes(true);
}

function isCampaignGraphEdgeAnimated(
	edge: CampaignGraphEdge,
	focusedNodeId: string | null,
	isFocused: boolean,
): boolean {
	return [Boolean(focusedNodeId), isFocused, edge.relation === "mentions"].every(Boolean);
}

function getCampaignGraphEdgeCountLabel(edge: CampaignGraphEdge, isFocused: boolean): string | undefined {
	if (![isFocused, edge.count > 1].every(Boolean)) return undefined;
	return String(edge.count);
}

export function getCampaignGraphEdgePresentation(
	edge: CampaignGraphEdge,
	focusedNodeId: string | null,
): CampaignGraphEdgePresentation {
	const isFocused = isCampaignGraphEdgeFocused(edge, focusedNodeId);
	const relation = getCampaignGraphRelationPresentation(edge.relation);
	return {
		isFocused,
		type: relation.type,
		animated: isCampaignGraphEdgeAnimated(edge, focusedNodeId, isFocused),
		isMuted: !isFocused,
		strokeDasharray: relation.strokeDasharray,
		hasSequenceMarker: relation.hasSequenceMarker,
		label: getCampaignGraphEdgeCountLabel(edge, isFocused),
	};
}

export function formatCampaignGraphSourceList(
	sources: readonly CampaignGraphSource[] = [],
	translate: GraphTranslate,
): string {
	const labels = [
		...new Set(
			sources
				.map((source) => formatCampaignGraphSourceField(source, translate))
				.filter(Boolean),
		),
	];
	const visibleLabels = labels.slice(0, 2);
	const hiddenCount = labels.length - visibleLabels.length;
	return hiddenCount > 0
		? `${visibleLabels.join(", ")} +${hiddenCount}`
		: visibleLabels.join(", ");
}

export function getCampaignGraphEdgeStrokeWidth(edge: CampaignGraphEdge): number {
	if (edge.relation === "mentions") return Math.min(3.1, 1.5 + edge.count * 0.18);
	if (edge.relation === "related") return Math.min(2.6, 1.35 + edge.count * 0.14);
	return edge.relation === "sequence" ? 2.1 : 1.25;
}

export function getCampaignGraphEdgeColor(edge: CampaignGraphEdge): string {
	if (edge.relation === "mentions") return "#38bdf8";
	if (edge.relation === "sequence") return "#e879f9";
	if (edge.relation === "related") return "#f59e0b";
	return "#94a3b8";
}

export function getCampaignGraphEdgeOpacity(
	edge: CampaignGraphEdge,
	isFocused: boolean,
	hasFocus: boolean,
): number {
	return GRAPH_EDGE_OPACITY_READERS[getCampaignGraphEdgeFocusMode(isFocused, hasFocus)](edge.relation);
}

type CampaignGraphEdgeFocusMode = "idle" | "focused" | "muted";

function getCampaignGraphEdgeFocusMode(
	isFocused: boolean,
	hasFocus: boolean,
): CampaignGraphEdgeFocusMode {
	if (!hasFocus) return "idle";
	return isFocused ? "focused" : "muted";
}

function getIdleCampaignGraphEdgeOpacity(relation: string): number {
	return ({ contains: 0.16, sequence: 0.35 } as Readonly<Record<string, number>>)[relation] ?? 0.32;
}

function getFocusedCampaignGraphEdgeOpacity(relation: string): number {
	return relation === "contains" ? 0.55 : 0.9;
}

const GRAPH_EDGE_OPACITY_READERS: Record<CampaignGraphEdgeFocusMode, (relation: string) => number> = {
	idle: getIdleCampaignGraphEdgeOpacity,
	focused: getFocusedCampaignGraphEdgeOpacity,
	muted: () => 0.07,
};

function getPositionCoordinate(
	position: Partial<GraphPosition> | null | undefined,
	key: keyof GraphPosition,
): number {
	const value = position?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function getCampaignGraphEdgeHandles(
	source: Partial<GraphPosition> | null | undefined,
	target: Partial<GraphPosition> | null | undefined,
): CampaignGraphEdgeHandles {
	const dx = getPositionCoordinate(target, "x") - getPositionCoordinate(source, "x");
	const dy = getPositionCoordinate(target, "y") - getPositionCoordinate(source, "y");
	if (Math.abs(dx) >= Math.abs(dy)) {
		return dx >= 0
			? { sourceHandle: "source-right", targetHandle: "target-left" }
			: { sourceHandle: "source-left", targetHandle: "target-right" };
	}
	return dy >= 0
		? { sourceHandle: "source-bottom", targetHandle: "target-top" }
		: { sourceHandle: "source-top", targetHandle: "target-bottom" };
}

export function getVisibleCampaignGraph(
	graph: CampaignGraphResult,
	enabledFilters: CampaignGraphEnabledFilters,
	normalizedQuery: string,
): CampaignGraphVisibleResult {
	const enabledNodes = graph.nodes.filter((node) => {
		if (node.type === "campaign") return true;
		if (
			node.type === "scene-note" &&
			enabledFilters[getCampaignGraphFilterId("scene")] === false
		) {
			return false;
		}
		return enabledFilters[getCampaignGraphFilterId(node.type)] !== false;
	});
	const enabledNodeIds = new Set(enabledNodes.map((node) => node.id));
	const enabledEdges = graph.edges.filter(
		(edge) => enabledNodeIds.has(edge.source) && enabledNodeIds.has(edge.target),
	);
	const visibleNodeIds = getVisibleNodeIds(
		enabledNodes,
		enabledEdges,
		enabledNodeIds,
		normalizedQuery,
	);
	const nodes = enabledNodes.filter((node) => visibleNodeIds.has(node.id));
	const edges = enabledEdges.filter(
		(edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
	);
	return {
		nodes,
		edges,
		visibleNodeIds,
		visibleEdgeIds: new Set(edges.map((edge) => edge.id)),
		nodeById: new Map(nodes.map((node) => [node.id, node])),
	};
}

function getVisibleNodeIds(
	nodes: CampaignGraphNode[],
	edges: CampaignGraphEdge[],
	allNodeIds: Set<string>,
	normalizedQuery: string,
): Set<string> {
	if (!normalizedQuery) return allNodeIds;
	const matchedIds = new Set(
		nodes
			.filter((node) => node.searchText.includes(normalizedQuery))
			.map((node) => node.id),
	);
	const visibleIds = new Set(matchedIds);
	edges.forEach((edge) => {
		if (matchedIds.has(edge.source) || matchedIds.has(edge.target)) {
			visibleIds.add(edge.source);
			visibleIds.add(edge.target);
		}
	});
	return visibleIds;
}

export function getCampaignGraphTypeCounts(
	nodes: CampaignGraphNode[],
): CampaignGraphTypeCounts {
	return nodes.reduce<CampaignGraphTypeCounts>((counts, node) => {
		if (node.type === "campaign") return counts;
		const filterId = getCampaignGraphFilterId(node.type);
		counts[filterId] = (counts[filterId] ?? 0) + 1;
		return counts;
	}, {});
}

export function getCampaignGraphConnectedIds(
	edges: CampaignGraphEdge[],
	nodeId: string | null,
): Set<string> {
	if (!nodeId) return new Set();
	const ids = new Set([nodeId]);
	edges.forEach((edge) => {
		if (edge.source === nodeId) ids.add(edge.target);
		if (edge.target === nodeId) ids.add(edge.source);
	});
	return ids;
}

export function getCampaignGraphConnectedEdges(
	edges: CampaignGraphEdge[],
	nodeId: string | null,
): CampaignGraphEdge[] {
	if (!nodeId) return [];
	return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}

export function getCampaignGraphMiniMapNodeSize(
	node: CampaignGraphLayoutNode,
): { width: number; height: number } {
	return getCampaignGraphFlowNodeSize(node);
}

export function getCampaignGraphMiniMapBounds(
	nodes: CampaignGraphLayoutNode[],
): CampaignGraphBounds | null {
	const visibleNodes = nodes.filter((node) => !node.hidden && node.position);
	if (visibleNodes.length === 0) return null;
	const extents = visibleNodes.reduce(
		(result, node) => {
			const { width, height } = getCampaignGraphMiniMapNodeSize(node);
			const x = getPositionCoordinate(node.position, "x");
			const y = getPositionCoordinate(node.position, "y");
			return {
				minX: Math.min(result.minX, x - width / 2),
				minY: Math.min(result.minY, y - height / 2),
				maxX: Math.max(result.maxX, x + width / 2),
				maxY: Math.max(result.maxY, y + height / 2),
			};
		},
		{ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
	);
	return normalizeMiniMapBounds(extents);
}

function normalizeMiniMapBounds(extents: {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}): CampaignGraphBounds {
	let width = Math.max(extents.maxX - extents.minX, 1);
	let height = Math.max(extents.maxY - extents.minY, 1);
	const centerX = (extents.minX + extents.maxX) / 2;
	const centerY = (extents.minY + extents.maxY) / 2;
	const padding = Math.max(width, height) * 0.055;
	width += padding * 2;
	height += padding * 2;
	const aspectRatio = 3 / 2;
	if (width / height < aspectRatio) width = height * aspectRatio;
	else height = width / aspectRatio;
	return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

function findByIdOrSlug(
	items: CampaignPageEntity[] | undefined,
	sourceId: unknown,
	sourceSlug: unknown,
): CampaignPageEntity | undefined {
	return (items ?? []).find(
		(item) =>
			String(item.id) === String(sourceId) ||
			(Boolean(sourceSlug) && String(item.slug) === String(sourceSlug)),
	);
}

function getSessionDetail(
	sessionDetails: CampaignSessionDetails,
	fileName: unknown,
) {
	return typeof fileName === "string" ? sessionDetails[fileName] : undefined;
}

function findGraphEntity(
	node: CampaignGraphNode,
	campaignEntities: CampaignPageEntity[],
	sessionDetails: CampaignSessionDetails,
	sessionKey: "npcs" | "locations",
): CampaignPageEntity | undefined {
	if (node.meta.scope !== "session") {
		return findByIdOrSlug(campaignEntities, node.sourceId, node.sourceSlug);
	}
	const session = getSessionDetail(sessionDetails, node.meta.fileName);
	return findByIdOrSlug(
		session?.data?.[sessionKey],
		node.sourceId,
		node.sourceSlug,
	);
}

export function findCampaignGraphEditableNote(
	node: CampaignGraphNode,
	notes: SharedNote[],
	sessionDetails: CampaignSessionDetails,
): SharedNote | null {
	if (node.type === "campaign-note") {
		return findCampaignGraphNoteById(notes, node.sourceId);
	}
	const session = getSessionDetail(sessionDetails, node.meta.fileName);
	const finder = SESSION_GRAPH_NOTE_FINDERS[node.type];
	return finder ? finder(node, session) : null;
}

function findCampaignGraphNoteById(
	notes: SharedNote[] | undefined,
	noteId: unknown,
): SharedNote | null {
	return notes?.find((note) => String(note.id) === String(noteId)) ?? null;
}

type SessionGraphNoteFinder = (
	node: CampaignGraphNode,
	session: CampaignSessionDetails[string] | undefined,
) => SharedNote | null;

const findSessionGraphNote: SessionGraphNoteFinder = (node, session) =>
	findCampaignGraphNoteById(session?.data?.notes, node.sourceId);

const findSceneGraphNote: SessionGraphNoteFinder = (node, session) => {
	const scene = session?.data?.scenes?.find(
		(item) => String(item.id) === String(node.meta.sceneId),
	);
	return findCampaignGraphNoteById(scene?.notes, node.sourceId);
};

const SESSION_GRAPH_NOTE_FINDERS: Readonly<Record<string, SessionGraphNoteFinder>> = {
	"session-note": findSessionGraphNote,
	"scene-note": findSceneGraphNote,
};

export function getCampaignGraphOpenTarget(
	input: CampaignGraphOpenTargetInput,
): CampaignGraphOpenTarget {
	return getDirectCampaignGraphOpenTarget(input) ?? getCampaignGraphNoteOpenTarget(input);
}

function getDirectCampaignGraphOpenTarget(
	input: CampaignGraphOpenTargetInput,
): Exclude<CampaignGraphOpenTarget, { kind: "note" } | { kind: "none" }> | null {
	const sessionTarget = getCampaignGraphSessionOpenTarget(input.node);
	return sessionTarget ?? getGraphEntityTarget(input);
}

function getCampaignGraphSessionOpenTarget(
	node: CampaignGraphNode,
): Extract<CampaignGraphOpenTarget, { kind: "session" }> | null {
	if (node.type !== "session" || typeof node.meta.fileName !== "string") return null;
	return { kind: "session", fileName: node.meta.fileName };
}

function getCampaignGraphNoteOpenTarget(
	input: CampaignGraphOpenTargetInput,
): Extract<CampaignGraphOpenTarget, { kind: "note" } | { kind: "none" }> {
	if (!input.canSaveNote) return { kind: "none" };
	const note = findCampaignGraphEditableNote(input.node, input.notes, input.sessionDetails);
	return note ? { kind: "note", note } : { kind: "none" };
}

function getGraphEntityTarget(
	input: CampaignGraphOpenTargetInput,
): Extract<CampaignGraphOpenTarget, { kind: "entity" }> | null {
	const resolver = GRAPH_ENTITY_TARGET_RESOLVERS[input.node.type];
	if (!resolver) return null;
	const resolution = resolver(input);
	return resolution.entity
		? { kind: "entity", entity: resolution.entity, entityType: resolution.entityType }
		: null;
}

interface GraphEntityResolution {
	entity: CampaignPageEntity | undefined;
	entityType: CampaignGraphEntityType;
}

type GraphEntityTargetResolver = (input: CampaignGraphOpenTargetInput) => GraphEntityResolution;

const GRAPH_ENTITY_TARGET_RESOLVERS: Readonly<Record<string, GraphEntityTargetResolver>> = {
	character: (input) => ({
		entity: findByIdOrSlug(input.characters, input.node.sourceId, input.node.sourceSlug),
		entityType: "characters",
	}),
	npc: (input) => ({
		entity: findGraphEntity(input.node, input.npcs, input.sessionDetails, "npcs"),
		entityType: "npc",
	}),
	location: (input) => ({
		entity: findGraphEntity(input.node, input.locations, input.sessionDetails, "locations"),
		entityType: "locations",
	}),
};

export function canOpenCampaignGraphNode(
	node: CampaignGraphNode | null | undefined,
	canSaveNote: boolean,
): boolean {
	if (!node) return false;
	if (["session", "character", "npc", "location"].includes(node.type)) return true;
	return (
		canSaveNote &&
		["campaign-note", "session-note", "scene-note"].includes(node.type)
	);
}

export function getCampaignGraphNoteSaveRequest(
	node: CampaignGraphNode,
	updates: Partial<SharedNote>,
): CampaignGraphNoteSave | null {
	if (!isCampaignGraphNoteType(node.type)) return null;
	if (!isCampaignGraphResourceId(node.sourceId)) return null;
	return {
		nodeType: node.type,
		fileName: node.meta.fileName,
		sceneId: getCampaignGraphResourceId(node.meta.sceneId),
		noteId: node.sourceId,
		updates,
	};
}

const CAMPAIGN_GRAPH_NOTE_TYPES = ["campaign-note", "session-note", "scene-note"] as const;
type CampaignGraphNoteType = (typeof CAMPAIGN_GRAPH_NOTE_TYPES)[number];

function isCampaignGraphNoteType(value: string): value is CampaignGraphNoteType {
	return CAMPAIGN_GRAPH_NOTE_TYPES.includes(value as CampaignGraphNoteType);
}

function isCampaignGraphResourceId(value: unknown): value is string | number {
	return [typeof value === "string", typeof value === "number"].includes(true);
}

function getCampaignGraphResourceId(value: unknown): string | number | undefined {
	return isCampaignGraphResourceId(value) ? value : undefined;
}
