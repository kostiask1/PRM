import {
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
	forceX,
	forceY,
	type SimulationLinkDatum,
	type SimulationNodeDatum,
} from "d3-force";

export interface GraphPosition {
	x: number;
	y: number;
}

export interface GraphNodeSize {
	width: number;
	height: number;
}

export interface CampaignGraphLayoutNode {
	id?: unknown;
	type?: string;
	hidden?: boolean;
	position?: Partial<GraphPosition>;
	measured?: Partial<GraphNodeSize>;
	width?: unknown;
	height?: unknown;
	style?: { width?: unknown; height?: unknown };
	data?: { graphNode?: { type?: string } };
}

export interface CampaignGraphLayoutEdge {
	id?: unknown;
	source?: unknown;
	target?: unknown;
	relation?: string;
}

interface SimulationGraphNode extends SimulationNodeDatum {
	id: string;
	type: string;
	x: number;
	y: number;
}

interface SimulationGraphEdge extends SimulationLinkDatum<SimulationGraphNode> {
	id?: unknown;
	source: string | SimulationGraphNode;
	target: string | SimulationGraphNode;
	relation?: string;
}

interface CollisionPeer {
	position: GraphPosition;
	size: GraphNodeSize;
}

interface NormalizedCampaignGraphLayoutNode extends CampaignGraphLayoutNode {
	id: string;
}

export type CampaignGraphPositions = Record<string, GraphPosition>;

const DEFAULT_NODE_SIZE = Object.freeze({ width: 176, height: 64 });

export const CAMPAIGN_GRAPH_NODE_SIZES: Readonly<Record<string, GraphNodeSize>> = Object.freeze({
	campaign: Object.freeze({ width: 208, height: 72 }),
	"campaign-note": Object.freeze({ width: 196, height: 76 }),
	character: Object.freeze({ width: 184, height: 68 }),
	npc: Object.freeze({ width: 184, height: 68 }),
	location: Object.freeze({ width: 190, height: 68 }),
	session: Object.freeze({ width: 196, height: 72 }),
	scene: Object.freeze({ width: 184, height: 68 }),
	"session-note": Object.freeze({ width: 196, height: 76 }),
	"scene-note": Object.freeze({ width: 196, height: 76 }),
	unresolved: Object.freeze({ width: 168, height: 60 }),
});

const TYPE_ANCHORS: Readonly<Record<string, GraphPosition>> = Object.freeze({
	campaign: Object.freeze({ x: 0, y: 0 }),
	"campaign-note": Object.freeze({ x: -330, y: -250 }),
	"session-note": Object.freeze({ x: -245, y: -365 }),
	"scene-note": Object.freeze({ x: -70, y: -410 }),
	character: Object.freeze({ x: 300, y: -265 }),
	npc: Object.freeze({ x: 420, y: -30 }),
	location: Object.freeze({ x: 300, y: 285 }),
	session: Object.freeze({ x: -285, y: 270 }),
	scene: Object.freeze({ x: -430, y: 35 }),
	unresolved: Object.freeze({ x: 35, y: 420 }),
});

const RELATION_FORCES: Readonly<
	Record<string, { distance: number; strength: number }>
> = Object.freeze({
	contains: Object.freeze({ distance: 225, strength: 0.72 }),
	sequence: Object.freeze({ distance: 215, strength: 0.68 }),
	mentions: Object.freeze({ distance: 305, strength: 0.42 }),
	related: Object.freeze({ distance: 270, strength: 0.3 }),
});

const DEFAULT_RELATION_FORCE = Object.freeze({
	distance: 285,
	strength: 0.34,
});

const LAYOUT_COLLISION_MARGIN = 14;
const LAYOUT_TICKS = 360;
const POSITION_PRECISION = 1000;

export function getCampaignGraphNodeSize(type: string): GraphNodeSize {
	return CAMPAIGN_GRAPH_NODE_SIZES[type] || DEFAULT_NODE_SIZE;
}

function getNodeType(node: CampaignGraphLayoutNode = {}): string {
	return node.type || node.data?.graphNode?.type || "unresolved";
}

function getNodeAnchor(node: CampaignGraphLayoutNode): GraphPosition {
	return TYPE_ANCHORS[getNodeType(node)] || TYPE_ANCHORS.unresolved;
}

function stableHash(value: unknown): number {
	let hash = 2166136261;
	for (const character of String(value || "")) {
		hash ^= character.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function createSeededRandom(seed = 0x2f6e2b1): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

function getInitialPosition(
	node: CampaignGraphLayoutNode,
	index: number,
): GraphPosition {
	if (getNodeType(node) === "campaign") return { x: 0, y: 0 };

	const anchor = getNodeAnchor(node);
	const hash = stableHash(node.id);
	const angle = ((hash % 4096) / 4096) * Math.PI * 2;
	const ring = 34 + ((hash >>> 12) % 5) * 23 + (index % 3) * 7;
	return {
		x: anchor.x + Math.cos(angle) * ring,
		y: anchor.y + Math.sin(angle) * ring,
	};
}

function getRelationForce(edge: CampaignGraphLayoutEdge = {}) {
	return (edge.relation && RELATION_FORCES[edge.relation]) || DEFAULT_RELATION_FORCE;
}

function getCollisionRadius(node: CampaignGraphLayoutNode): number {
	const size = getCampaignGraphNodeSize(getNodeType(node));
	return Math.hypot(size.width, size.height) / 2 + LAYOUT_COLLISION_MARGIN;
}

function getEdgeNodeId(value: unknown): string {
	if (value && typeof value === "object") {
		return String((value as { id?: unknown }).id ?? "");
	}
	return String(value ?? "");
}

function roundPosition(value: number | undefined): number {
	if (!Number.isFinite(value)) return 0;
	return Math.round((value ?? 0) * POSITION_PRECISION) / POSITION_PRECISION;
}

function toPositiveNumber(value: unknown): number | null {
	const numericValue = getNumericDimensionCandidate(value);
	return isPositiveFiniteNumber(numericValue) ? numericValue : null;
}

function getNumericDimensionCandidate(value: unknown): unknown {
	if (typeof value === "string") return Number.parseFloat(value);
	return value;
}

function isPositiveFiniteNumber(value: unknown): value is number {
	if (typeof value !== "number") return false;
	return [Number.isFinite(value), value > 0].every(Boolean);
}

function getFirstPositiveNodeDimension(
	values: readonly unknown[],
	fallback: number,
): number {
	for (const value of values) {
		const dimension = toPositiveNumber(value);
		if (dimension !== null) return dimension;
	}
	return fallback;
}

export function getCampaignGraphFlowNodeSize(
	node: CampaignGraphLayoutNode = {},
): GraphNodeSize {
	const fallback = getCampaignGraphNodeSize(getNodeType(node));
	return {
		width: getFirstPositiveNodeDimension(
			[node.measured?.width, node.width, node.style?.width],
			fallback.width,
		),
		height: getFirstPositiveNodeDimension(
			[node.measured?.height, node.height, node.style?.height],
			fallback.height,
		),
	};
}

function getFinitePosition(node: CampaignGraphLayoutNode = {}): GraphPosition {
	return {
		x: getFiniteCoordinate(node.position?.x),
		y: getFiniteCoordinate(node.position?.y),
	};
}

function getFiniteCoordinate(value: unknown): number {
	if (typeof value !== "number") return 0;
	return Number.isFinite(value) ? value : 0;
}

function positionsOverlap(
	leftPosition: GraphPosition,
	leftSize: GraphNodeSize,
	rightPosition: GraphPosition,
	rightSize: GraphNodeSize,
	margin: number,
): boolean {
	return (
		Math.abs(leftPosition.x - rightPosition.x) <
			(leftSize.width + rightSize.width) / 2 + margin &&
		Math.abs(leftPosition.y - rightPosition.y) <
			(leftSize.height + rightSize.height) / 2 + margin
	);
}

function isCandidateFree(
	candidate: GraphPosition,
	draggedSize: GraphNodeSize,
	peers: CollisionPeer[],
	margin: number,
): boolean {
	return peers.every(
		(peer) =>
			!positionsOverlap(
				candidate,
				draggedSize,
				peer.position,
				peer.size,
				margin,
			),
	);
}

function getCollisionCandidates(
	origin: GraphPosition,
	draggedSize: GraphNodeSize,
	peers: CollisionPeer[],
	margin: number,
): GraphPosition[] {
	const candidates = [{ ...origin }];

	peers.forEach((peer) => {
		const xDistance = (draggedSize.width + peer.size.width) / 2 + margin;
		const yDistance = (draggedSize.height + peer.size.height) / 2 + margin;
		const xBoundaries = [
			peer.position.x - xDistance,
			peer.position.x + xDistance,
		];
		const yBoundaries = [
			peer.position.y - yDistance,
			peer.position.y + yDistance,
		];

		xBoundaries.forEach((x) => {
			candidates.push({ x, y: origin.y });
			yBoundaries.forEach((y) => candidates.push({ x, y }));
		});
		yBoundaries.forEach((y) => candidates.push({ x: origin.x, y }));
	});

	return candidates.sort((left, right) => {
		const leftDistance =
			(left.x - origin.x) ** 2 + (left.y - origin.y) ** 2;
		const rightDistance =
			(right.x - origin.x) ** 2 + (right.y - origin.y) ** 2;
		if (leftDistance !== rightDistance) return leftDistance - rightDistance;
		if (left.x !== right.x) return left.x - right.x;
		return left.y - right.y;
	});
}

export function resolveCampaignGraphNodeCollision(
	flowNodes: CampaignGraphLayoutNode[],
	draggedNodeId: unknown,
	margin = 16,
): GraphPosition {
	const nodes = getCampaignGraphLayoutCollection(flowNodes);
	const draggedNode = findCampaignGraphLayoutNode(nodes, draggedNodeId);
	const origin = getFinitePosition(draggedNode);
	if (!isMovableCampaignGraphLayoutNode(draggedNode)) return origin;
	const safeMargin = getCampaignGraphCollisionMargin(margin);
	const draggedSize = getCampaignGraphFlowNodeSize(draggedNode);
	const peers = getCampaignGraphCollisionPeers(nodes, draggedNodeId);
	return getFreeCampaignGraphPosition(origin, draggedSize, peers, safeMargin);
}

function getCampaignGraphLayoutCollection(
	nodes: CampaignGraphLayoutNode[],
): CampaignGraphLayoutNode[] {
	return Array.isArray(nodes) ? nodes : [];
}

function findCampaignGraphLayoutNode(
	nodes: CampaignGraphLayoutNode[],
	nodeId: unknown,
): CampaignGraphLayoutNode | undefined {
	return nodes.find((node) => String(node?.id) === String(nodeId));
}

function isMovableCampaignGraphLayoutNode(
	node: CampaignGraphLayoutNode | undefined,
): node is CampaignGraphLayoutNode {
	return Boolean(node) && !node?.hidden;
}

function getCampaignGraphCollisionMargin(margin: number): number {
	return Number.isFinite(margin) ? Math.max(0, margin) : 16;
}

function getCampaignGraphCollisionPeers(
	nodes: CampaignGraphLayoutNode[],
	draggedNodeId: unknown,
): CollisionPeer[] {
	return nodes
		.filter((node) => isCampaignGraphCollisionPeer(node, draggedNodeId))
		.map((node) => ({
			position: getFinitePosition(node),
			size: getCampaignGraphFlowNodeSize(node),
		}));
}

function isCampaignGraphCollisionPeer(
	node: CampaignGraphLayoutNode | undefined,
	draggedNodeId: unknown,
): node is CampaignGraphLayoutNode {
	if (!node) return false;
	return [!node.hidden, String(node.id) !== String(draggedNodeId)].every(Boolean);
}

function getFreeCampaignGraphPosition(
	origin: GraphPosition,
	draggedSize: GraphNodeSize,
	peers: CollisionPeer[],
	margin: number,
): GraphPosition {
	if (isCandidateFree(origin, draggedSize, peers, margin)) return origin;
	return getCollisionCandidates(origin, draggedSize, peers, margin).find(
		(candidate) => isCandidateFree(candidate, draggedSize, peers, margin),
	) ?? origin;
}

function resolveRemainingLayoutCollisions(
	nodes: SimulationGraphNode[],
	campaignNodeId?: string,
): CampaignGraphPositions {
	let flowNodes = nodes.map((node) => ({
		id: node.id,
		position: { x: roundPosition(node.x), y: roundPosition(node.y) },
		data: { graphNode: { type: node.type } },
	}));

	flowNodes.forEach((node) => {
		if (node.id === campaignNodeId) return;
		const position = resolveCampaignGraphNodeCollision(
			flowNodes,
			node.id,
			LAYOUT_COLLISION_MARGIN,
		);
		flowNodes = flowNodes.map((currentNode) =>
			currentNode.id === node.id
				? { ...currentNode, position }
				: currentNode,
		);
	});

	return Object.fromEntries(
		flowNodes.map((node) => [
			node.id,
			{
				x: roundPosition(node.position.x),
				y: roundPosition(node.position.y),
			},
		]),
	);
}

export function layoutCampaignGraph(
	nodes: CampaignGraphLayoutNode[],
	edges: CampaignGraphLayoutEdge[],
): CampaignGraphPositions {
	const graphNodes = normalizeCampaignGraphLayoutNodes(nodes);
	if (graphNodes.length === 0) return {};
	const nodeIds = new Set(graphNodes.map((node) => node.id));
	const graphEdges = normalizeCampaignGraphLayoutEdges(edges, nodeIds);
	const campaignNode = graphNodes.find((node) => node.type === "campaign");
	const simulationNodes = createCampaignGraphSimulationNodes(graphNodes, campaignNode?.id);
	const simulation = createCampaignGraphSimulation(simulationNodes, graphEdges);
	runCampaignGraphSimulation(simulation);
	return resolveRemainingLayoutCollisions(simulationNodes, campaignNode?.id);
}

function normalizeCampaignGraphLayoutNodes(
	nodes: CampaignGraphLayoutNode[],
): NormalizedCampaignGraphLayoutNode[] {
	return getCampaignGraphLayoutCollection(nodes)
		.filter(hasCampaignGraphLayoutNodeId)
		.map((node) => ({ ...node, id: String(node.id) }))
		.sort((left, right) => left.id.localeCompare(right.id));
}

function hasCampaignGraphLayoutNodeId(
	node: CampaignGraphLayoutNode | undefined,
): node is CampaignGraphLayoutNode & { id: unknown } {
	return node?.id !== undefined && node.id !== null;
}

function normalizeCampaignGraphLayoutEdges(
	edges: CampaignGraphLayoutEdge[],
	nodeIds: ReadonlySet<string>,
): SimulationGraphEdge[] {
	return (Array.isArray(edges) ? edges : [])
		.map(normalizeCampaignGraphLayoutEdge)
		.filter((edge) => isCampaignGraphLayoutEdgeValid(edge, nodeIds))
		.sort(compareCampaignGraphLayoutEdges);
}

function normalizeCampaignGraphLayoutEdge(edge: CampaignGraphLayoutEdge): SimulationGraphEdge {
	return {
		...edge,
		source: getEdgeNodeId(edge?.source),
		target: getEdgeNodeId(edge?.target),
	};
}

function isCampaignGraphLayoutEdgeValid(
	edge: SimulationGraphEdge,
	nodeIds: ReadonlySet<string>,
): boolean {
	return [
		edge.source !== edge.target,
		nodeIds.has(String(edge.source)),
		nodeIds.has(String(edge.target)),
	].every(Boolean);
}

function compareCampaignGraphLayoutEdges(
	left: SimulationGraphEdge,
	right: SimulationGraphEdge,
): number {
	return getCampaignGraphLayoutEdgeSortKey(left).localeCompare(
		getCampaignGraphLayoutEdgeSortKey(right),
	);
}

function getCampaignGraphLayoutEdgeSortKey(edge: SimulationGraphEdge): string {
	return String(edge.id || `${getEdgeNodeId(edge.source)}->${getEdgeNodeId(edge.target)}`);
}

function createCampaignGraphSimulationNodes(
	nodes: NormalizedCampaignGraphLayoutNode[],
	campaignNodeId?: string,
): SimulationGraphNode[] {
	return nodes.map((node, index) => createCampaignGraphSimulationNode(node, index, campaignNodeId));
}

function createCampaignGraphSimulationNode(
	node: NormalizedCampaignGraphLayoutNode,
	index: number,
	campaignNodeId?: string,
): SimulationGraphNode {
	const initialPosition = getInitialPosition(node, index);
	return {
		id: node.id,
		type: getNodeType(node),
		x: initialPosition.x,
		y: initialPosition.y,
		...(node.id === campaignNodeId ? { fx: 0, fy: 0 } : {}),
	};
}

function createCampaignGraphSimulation(
	simulationNodes: SimulationGraphNode[],
	graphEdges: SimulationGraphEdge[],
) {
	return forceSimulation(simulationNodes)
		.randomSource(createSeededRandom())
		.force(
			"links",
			forceLink<SimulationGraphNode, SimulationGraphEdge>(graphEdges)
				.id((node) => node.id)
				.distance((edge) => getRelationForce(edge).distance)
				.strength((edge) => getRelationForce(edge).strength)
				.iterations(2),
		)
		.force(
			"charge",
			forceManyBody<SimulationGraphNode>()
				.strength((node) => (node.type === "campaign" ? -300 : -175))
				.distanceMin(48)
				.distanceMax(950),
		)
		.force(
			"collision",
			forceCollide<SimulationGraphNode>(getCollisionRadius)
				.strength(1)
				.iterations(4),
		)
		.force(
			"x",
			forceX<SimulationGraphNode>((node) => getNodeAnchor(node).x).strength((node) =>
				node.type === "campaign" ? 1 : 0.075,
			),
		)
		.force(
			"y",
			forceY<SimulationGraphNode>((node) => getNodeAnchor(node).y).strength((node) =>
				node.type === "campaign" ? 1 : 0.075,
			),
		)
		.alpha(1)
		.alphaMin(0.001)
		.alphaDecay(0.025)
		.velocityDecay(0.46)
		.stop();
}

function runCampaignGraphSimulation(
	simulation: ReturnType<typeof createCampaignGraphSimulation>,
): void {
	for (let index = 0; index < LAYOUT_TICKS; index += 1) {
		simulation.tick();
	}
	simulation.stop();
}
