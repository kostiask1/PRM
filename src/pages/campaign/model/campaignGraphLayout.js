import {
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
	forceX,
	forceY,
} from "d3-force";

const DEFAULT_NODE_SIZE = Object.freeze({ width: 176, height: 64 });

export const CAMPAIGN_GRAPH_NODE_SIZES = Object.freeze({
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

const TYPE_ANCHORS = Object.freeze({
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

const RELATION_FORCES = Object.freeze({
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

export function getCampaignGraphNodeSize(type) {
	return CAMPAIGN_GRAPH_NODE_SIZES[type] || DEFAULT_NODE_SIZE;
}

function getNodeType(node = {}) {
	return node.type || node.data?.graphNode?.type || "unresolved";
}

function getNodeAnchor(node) {
	return TYPE_ANCHORS[getNodeType(node)] || TYPE_ANCHORS.unresolved;
}

function stableHash(value) {
	let hash = 2166136261;
	for (const character of String(value || "")) {
		hash ^= character.codePointAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function createSeededRandom(seed = 0x2f6e2b1) {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

function getInitialPosition(node, index) {
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

function getRelationForce(edge = {}) {
	return RELATION_FORCES[edge.relation] || DEFAULT_RELATION_FORCE;
}

function getCollisionRadius(node) {
	const size = getCampaignGraphNodeSize(getNodeType(node));
	return Math.hypot(size.width, size.height) / 2 + LAYOUT_COLLISION_MARGIN;
}

function getEdgeNodeId(value) {
	if (value && typeof value === "object") return String(value.id ?? "");
	return String(value ?? "");
}

function roundPosition(value) {
	if (!Number.isFinite(value)) return 0;
	return Math.round(value * POSITION_PRECISION) / POSITION_PRECISION;
}

function toPositiveNumber(value) {
	if (typeof value === "string") {
		const parsedValue = Number.parseFloat(value);
		return Number.isFinite(parsedValue) && parsedValue > 0
			? parsedValue
			: null;
	}
	return Number.isFinite(value) && value > 0 ? value : null;
}

function getFlowNodeSize(node = {}) {
	const fallback = getCampaignGraphNodeSize(getNodeType(node));
	return {
		width:
			toPositiveNumber(node.measured?.width) ||
			toPositiveNumber(node.width) ||
			toPositiveNumber(node.style?.width) ||
			fallback.width,
		height:
			toPositiveNumber(node.measured?.height) ||
			toPositiveNumber(node.height) ||
			toPositiveNumber(node.style?.height) ||
			fallback.height,
	};
}

function getFinitePosition(node = {}) {
	return {
		x: Number.isFinite(node.position?.x) ? node.position.x : 0,
		y: Number.isFinite(node.position?.y) ? node.position.y : 0,
	};
}

function positionsOverlap(
	leftPosition,
	leftSize,
	rightPosition,
	rightSize,
	margin,
) {
	return (
		Math.abs(leftPosition.x - rightPosition.x) <
			(leftSize.width + rightSize.width) / 2 + margin &&
		Math.abs(leftPosition.y - rightPosition.y) <
			(leftSize.height + rightSize.height) / 2 + margin
	);
}

function isCandidateFree(candidate, draggedSize, peers, margin) {
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

function getCollisionCandidates(origin, draggedSize, peers, margin) {
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
	flowNodes,
	draggedNodeId,
	margin = 16,
) {
	const nodes = Array.isArray(flowNodes) ? flowNodes : [];
	const draggedNode = nodes.find(
		(node) => String(node?.id) === String(draggedNodeId),
	);
	const origin = getFinitePosition(draggedNode);
	if (!draggedNode || draggedNode.hidden) return origin;

	const safeMargin = Number.isFinite(margin) ? Math.max(0, margin) : 16;
	const draggedSize = getFlowNodeSize(draggedNode);
	const peers = nodes
		.filter(
			(node) =>
				node &&
				!node.hidden &&
				String(node.id) !== String(draggedNodeId),
		)
		.map((node) => ({
			position: getFinitePosition(node),
			size: getFlowNodeSize(node),
		}));

	if (isCandidateFree(origin, draggedSize, peers, safeMargin)) return origin;

	const resolvedPosition = getCollisionCandidates(
		origin,
		draggedSize,
		peers,
		safeMargin,
	).find((candidate) =>
		isCandidateFree(candidate, draggedSize, peers, safeMargin),
	);

	return resolvedPosition || origin;
}

function resolveRemainingLayoutCollisions(nodes, campaignNodeId) {
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

export function layoutCampaignGraph(nodes, edges) {
	const graphNodes = (Array.isArray(nodes) ? nodes : [])
		.filter((node) => node?.id !== undefined && node?.id !== null)
		.map((node) => ({ ...node, id: String(node.id) }))
		.sort((left, right) => left.id.localeCompare(right.id));
	if (graphNodes.length === 0) return {};

	const nodeIds = new Set(graphNodes.map((node) => node.id));
	const graphEdges = (Array.isArray(edges) ? edges : [])
		.map((edge) => ({
			...edge,
			source: getEdgeNodeId(edge?.source),
			target: getEdgeNodeId(edge?.target),
		}))
		.filter(
			(edge) =>
				edge.source !== edge.target &&
				nodeIds.has(edge.source) &&
				nodeIds.has(edge.target),
		)
		.sort((left, right) =>
			String(left.id || `${left.source}->${left.target}`).localeCompare(
				String(right.id || `${right.source}->${right.target}`),
			),
		);
	const campaignNode = graphNodes.find((node) => node.type === "campaign");
	const simulationNodes = graphNodes.map((node, index) => {
		const initialPosition = getInitialPosition(node, index);
		return {
			id: node.id,
			type: getNodeType(node),
			x: initialPosition.x,
			y: initialPosition.y,
			...(node.id === campaignNode?.id ? { fx: 0, fy: 0 } : {}),
		};
	});

	const simulation = forceSimulation(simulationNodes)
		.randomSource(createSeededRandom())
		.force(
			"links",
			forceLink(graphEdges)
				.id((node) => node.id)
				.distance((edge) => getRelationForce(edge).distance)
				.strength((edge) => getRelationForce(edge).strength)
				.iterations(2),
		)
		.force(
			"charge",
			forceManyBody()
				.strength((node) => (node.type === "campaign" ? -300 : -175))
				.distanceMin(48)
				.distanceMax(950),
		)
		.force(
			"collision",
			forceCollide(getCollisionRadius).strength(1).iterations(4),
		)
		.force(
			"x",
			forceX((node) => getNodeAnchor(node).x).strength((node) =>
				node.type === "campaign" ? 1 : 0.075,
			),
		)
		.force(
			"y",
			forceY((node) => getNodeAnchor(node).y).strength((node) =>
				node.type === "campaign" ? 1 : 0.075,
			),
		)
		.alpha(1)
		.alphaMin(0.001)
		.alphaDecay(0.025)
		.velocityDecay(0.46)
		.stop();

	for (let index = 0; index < LAYOUT_TICKS; index += 1) {
		simulation.tick();
	}
	simulation.stop();

	return resolveRemainingLayoutCollisions(
		simulationNodes,
		campaignNode?.id,
	);
}
