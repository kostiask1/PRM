import type {
	CampaignGraphEdge,
	CampaignGraphNode,
	CampaignGraphResult,
} from "./campaignGraph.ts";
import {
	getCampaignGraphNodeSize,
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

export interface CampaignGraphEdgeHandles {
	sourceHandle: string;
	targetHandle: string;
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

function getGraphEdgeDasharray(relation: string): string | undefined {
	if (relation === "related") return "7 6";
	return relation === "sequence" ? "10 7" : undefined;
}

export function getCampaignGraphEdgePresentation(
	edge: CampaignGraphEdge,
	focusedNodeId: string | null,
): CampaignGraphEdgePresentation {
	const hasFocus = Boolean(focusedNodeId);
	const isFocused =
		!hasFocus || edge.source === focusedNodeId || edge.target === focusedNodeId;
	return {
		isFocused,
		type: edge.relation === "contains" ? "smoothstep" : "default",
		animated: hasFocus && isFocused && edge.relation === "mentions",
		isMuted: !isFocused,
		strokeDasharray: getGraphEdgeDasharray(edge.relation),
		hasSequenceMarker: edge.relation === "sequence",
		label: isFocused && edge.count > 1 ? String(edge.count) : undefined,
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
	if (hasFocus && !isFocused) return 0.07;
	if (isFocused && hasFocus) return edge.relation === "contains" ? 0.55 : 0.9;
	if (edge.relation === "contains") return 0.16;
	if (edge.relation === "sequence") return 0.35;
	return 0.32;
}

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

function getPositiveSize(value: unknown, fallback: number): number {
	const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || ""));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getCampaignGraphMiniMapNodeSize(
	node: CampaignGraphLayoutNode,
): { width: number; height: number } {
	const fallback = getCampaignGraphNodeSize(node.data?.graphNode?.type ?? "");
	return {
		width: getPositiveSize(node.measured?.width ?? node.style?.width, fallback.width),
		height: getPositiveSize(node.measured?.height ?? node.style?.height, fallback.height),
	};
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
		return notes.find((note) => String(note.id) === String(node.sourceId)) ?? null;
	}
	const session = getSessionDetail(sessionDetails, node.meta.fileName);
	if (node.type === "session-note") {
		return (
			session?.data?.notes?.find(
				(note) => String(note.id) === String(node.sourceId),
			) ?? null
		);
	}
	if (node.type !== "scene-note") return null;
	const scene = session?.data?.scenes?.find(
		(item) => String(item.id) === String(node.meta.sceneId),
	);
	return (
		scene?.notes?.find((note) => String(note.id) === String(node.sourceId)) ?? null
	);
}

export function getCampaignGraphOpenTarget(
	input: CampaignGraphOpenTargetInput,
): CampaignGraphOpenTarget {
	const { node } = input;
	if (node.type === "session" && typeof node.meta.fileName === "string") {
		return { kind: "session", fileName: node.meta.fileName };
	}
	const entityTarget = getGraphEntityTarget(input);
	if (entityTarget) return entityTarget;
	if (!input.canSaveNote) return { kind: "none" };
	const note = findCampaignGraphEditableNote(node, input.notes, input.sessionDetails);
	return note ? { kind: "note", note } : { kind: "none" };
}

function getGraphEntityTarget(
	input: CampaignGraphOpenTargetInput,
): Extract<CampaignGraphOpenTarget, { kind: "entity" }> | null {
	const { node } = input;
	if (node.type === "character") {
		const entity = findByIdOrSlug(input.characters, node.sourceId, node.sourceSlug);
		return entity ? { kind: "entity", entity, entityType: "characters" } : null;
	}
	if (node.type === "npc") {
		const entity = findGraphEntity(node, input.npcs, input.sessionDetails, "npcs");
		return entity ? { kind: "entity", entity, entityType: "npc" } : null;
	}
	if (node.type === "location") {
		const entity = findGraphEntity(
			node,
			input.locations,
			input.sessionDetails,
			"locations",
		);
		return entity ? { kind: "entity", entity, entityType: "locations" } : null;
	}
	return null;
}

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
	if (
		node.type !== "campaign-note" &&
		node.type !== "session-note" &&
		node.type !== "scene-note"
	) {
		return null;
	}
	if (typeof node.sourceId !== "string" && typeof node.sourceId !== "number") {
		return null;
	}
	const sceneId =
		typeof node.meta.sceneId === "string" ||
		typeof node.meta.sceneId === "number"
			? node.meta.sceneId
			: undefined;
	return {
		nodeType: node.type,
		fileName: node.meta.fileName,
		sceneId,
		noteId: node.sourceId,
		updates,
	};
}
