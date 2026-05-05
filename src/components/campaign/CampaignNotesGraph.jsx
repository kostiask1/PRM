import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactMarkdown from "react-markdown";

import Button from "../form/Button";
import EditableField from "../form/EditableField";
import EntityModalContent from "../modals/EntityModalContent.jsx";
import classNames from "../../utils/classNames";
import {
	buildCampaignGraph,
	normalizeGraphName,
} from "../../utils/campaignGraph.js";
import { lang } from "../../services/localization";
import {
	closeActiveModal,
	openModalRequest,
	useAppSelector,
} from "../../store/appStore";
import { renderMentionText } from "../../utils/parser.jsx";
import "../../assets/components/CampaignNotesGraph.css";

const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 620;
const GRAPH_CENTER_X = GRAPH_WIDTH / 2;
const GRAPH_CENTER_Y = GRAPH_HEIGHT / 2;

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

const TYPE_LABELS = {
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

const FILTER_COLOR_BY_ID = {
	notes: "#38bdf8",
	characters: "#22c55e",
	npc: "#f97316",
	locations: "#a3e635",
	sessions: "#818cf8",
	scenes: "#e879f9",
	unresolved: "#94a3b8",
};

const FILTERS = [
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

const DEFAULT_FILTERS = Object.fromEntries(
	FILTERS.map((filter) => [filter.id, true]),
);

const MARKDOWN_TAGS_WITH_MENTIONS = [
	"p",
	"strong",
	"em",
	"del",
	"code",
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

function renderMentionChildren(children) {
	return React.Children.map(children, (child) => {
		if (typeof child === "string") {
			return renderMentionText(child);
		}
		if (React.isValidElement(child) && child.props?.children) {
			return React.cloneElement(child, {
				...child.props,
				children: renderMentionChildren(child.props.children),
			});
		}
		return child;
	});
}

function getFilterIdForType(type) {
	const filter = FILTERS.find((item) => item.types.includes(type));
	return filter?.id || "notes";
}

function truncateLabel(value, maxLength = 20) {
	const text = String(value || "").trim();
	if (text.length <= maxLength) return text;
	return `${text
		.slice(0, maxLength - 1)
		.trim()
		.replace(/[[\]]/g, "")}...`;
}

function getSessionDisplayName(fileName) {
	return String(fileName || "").replace(/\.json$/i, "");
}

function getNodeRadius(node) {
	if (node.type === "campaign") return 20;
	if (node.type === "session") return 15;
	if (node.type === "scene") return 12;
	if (node.type === "unresolved") return 10;
	return Math.min(16, 9 + Math.sqrt(Math.max(1, node.degree || 1)) * 2);
}

function clampGraphPosition(position) {
	return {
		x: Math.min(GRAPH_WIDTH - 45, Math.max(45, position.x)),
		y: Math.min(GRAPH_HEIGHT - 40, Math.max(40, position.y)),
	};
}

function getRelationLabel(relation) {
	if (relation === "contains") return "Contains";
	if (relation === "related") return "Related";
	return "Mentions";
}

function getRelationDistance(edge, nodeById = new Map()) {
	const sourceNode = nodeById.get(edge.source);
	const targetNode = nodeById.get(edge.target);
	const types = new Set([sourceNode?.type, targetNode?.type]);

	if (
		edge.relation === "contains" &&
		types.has("session") &&
		types.has("scene")
	) {
		return 66;
	}
	if (
		edge.relation === "contains" &&
		types.has("scene") &&
		types.has("scene-note")
	) {
		return 62;
	}
	if (edge.relation === "contains") return 126;
	if (edge.relation === "related") return 92;
	return 104;
}

function getRelationStrength(relation) {
	if (relation === "contains") return 0.026;
	if (relation === "related") return 0.026;
	return 0.021;
}

function getSourceContextLabel(sourceType) {
	if (sourceType === "campaign") return "Campaign story";
	if (sourceType === "campaign-note") return "Campaign notes";
	if (sourceType === "character") return "Character";
	if (sourceType === "npc") return "NPC";
	if (sourceType === "location") return "Location/Faction";
	if (sourceType === "session") return "Session";
	if (sourceType === "session-note") return "Session notes";
	if (sourceType === "scene") return "Scene";
	if (sourceType === "scene-note") return "Scene notes";
	return "Source";
}

function formatGraphSourceField(source = {}) {
	const field = String(source.field || "")
		.replace(/\[\d+\]/g, "")
		.trim();
	const shortField = field.split(".").pop();

	if (!field) return "";
	if (field === "description") return lang.t("Campaign story");
	if (field === "result_text") return lang.t("Session result");
	if (field === "notes") return lang.t("Notes");
	if (field === "scenes") return lang.t("Scenes");
	if (field.includes(".notes.")) {
		if (source.type === "character") return lang.t("Character notes");
		if (source.type === "npc") return lang.t("NPC notes");
		if (source.type === "location") return lang.t("Location notes");
		if (source.type === "scene") return lang.t("Scene notes");
		if (source.type === "session") return lang.t("Session notes");
		return lang.t("Notes");
	}
	if (field.includes(".note.")) {
		if (source.type === "campaign-note") {
			return shortField === "title"
				? lang.t("Campaign note title")
				: lang.t("Campaign note text");
		}
		if (source.type === "session-note") {
			return shortField === "title"
				? lang.t("Session note title")
				: lang.t("Session note text");
		}
		if (source.type === "scene-note") {
			return shortField === "title"
				? lang.t("Scene note title")
				: lang.t("Scene note text");
		}
		return lang.t("Note text");
	}

	const fieldLabels = {
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

	return lang.t(fieldLabels[shortField] || getSourceContextLabel(source.type));
}

function formatGraphSourceList(sources = []) {
	const labels = [
		...new Set(sources.map(formatGraphSourceField).filter(Boolean)),
	];
	const visibleLabels = labels.slice(0, 2);
	const hiddenCount = labels.length - visibleLabels.length;
	if (hiddenCount <= 0) return visibleLabels.join(", ");
	return `${visibleLabels.join(", ")} +${hiddenCount}`;
}

function getEdgeStrokeWidth(edge) {
	if (edge.relation === "mentions")
		return Math.min(5.5, 2.4 + edge.count * 0.45);
	if (edge.relation === "related")
		return Math.min(4.5, 2.2 + edge.count * 0.35);
	return 1.6;
}

function getEdgeColor(edge) {
	if (edge.relation === "mentions") return "#38bdf8";
	if (edge.relation === "related") return "#f59e0b";
	return "#94a3b8";
}

function getEdgeOpacity(edge, isFocused) {
	if (!isFocused) return 0.16;
	if (edge.relation === "contains") return 0.34;
	return 0.92;
}

function ParsedGraphText({ text, onOpen }) {
	const components = useMemo(
		() =>
			Object.fromEntries(
				MARKDOWN_TAGS_WITH_MENTIONS.map((tag) => [
					tag,
					({ children, ...tagProps }) =>
						React.createElement(tag, tagProps, renderMentionChildren(children)),
				]),
			),
		[],
	);

	if (!String(text || "").trim()) return null;

	return (
		<div
			className={classNames(
				"CampaignNotesGraph__detailText",
				onOpen && "is-clickable",
			)}
			role={onOpen ? "button" : undefined}
			tabIndex={onOpen ? 0 : undefined}
			onClick={(event) => {
				if (!onOpen) return;
				if (event.target?.closest?.("a, button, input, textarea, select")) {
					return;
				}
				onOpen();
			}}
			onKeyDown={(event) => {
				if (!onOpen || (event.key !== "Enter" && event.key !== " ")) return;
				event.preventDefault();
				onOpen();
			}}
		>
			<ReactMarkdown components={components}>{text}</ReactMarkdown>
		</div>
	);
}

function GraphNoteModalContent({
	note,
	simplifiedNotes,
	campaignSlug,
	onSave,
}) {
	const [draft, setDraft] = useState(note || {});
	const didMountRef = useRef(false);

	useEffect(() => {
		setDraft(note || {});
	}, [note]);

	useEffect(() => {
		if (!didMountRef.current) {
			didMountRef.current = true;
			return;
		}

		const timer = setTimeout(() => {
			onSave?.({
				title: draft.title || "",
				text: draft.text || "",
			});
		}, 450);

		return () => clearTimeout(timer);
	}, [draft, onSave]);

	const updateDraft = (updates) => {
		setDraft((prev) => ({ ...prev, ...updates }));
	};

	return (
		<div className="CampaignNotesGraph__noteModal">
			{!simplifiedNotes && (
				<EditableField
					value={draft.title || ""}
					onChange={(event) => updateDraft({ title: event.target.value })}
					placeholder={lang.t("New note")}
					className="CampaignNotesGraph__noteTitle"
				/>
			)}
			<EditableField
				type="textarea"
				value={draft.text || ""}
				onChange={(event) => updateDraft({ text: event.target.value })}
				placeholder={lang.t("Note text...")}
				campaignSlug={campaignSlug}
				className="CampaignNotesGraph__noteText"
			/>
		</div>
	);
}

function groupNodesByType(nodes) {
	const groups = new Map();
	nodes.forEach((node) => {
		const group = groups.get(node.type) || [];
		group.push(node);
		groups.set(node.type, group);
	});
	return groups;
}

function createInitialPositions(nodes) {
	const groups = groupNodesByType(nodes);
	const positions = new Map();
	const childIdsByParentId = new Map();

	nodes.forEach((node) => {
		const parentId = node.meta?.parentId;
		if (!parentId) return;
		const childIds = childIdsByParentId.get(parentId) || [];
		childIds.push(node.id);
		childIdsByParentId.set(parentId, childIds);
	});

	const getChildPosition = (node) => {
		const parentId = node.meta?.parentId;
		const parentPosition = parentId ? positions.get(parentId) : null;
		if (!parentPosition) return null;

		const siblings = (childIdsByParentId.get(parentId) || []).filter((id) => {
			const sibling = nodes.find((item) => item.id === id);
			return sibling?.type === node.type;
		});
		const siblingIndex = Math.max(0, siblings.indexOf(node.id));
		const siblingCount = Math.max(1, siblings.length);
		const angle =
			(siblingIndex / siblingCount) * Math.PI * 2 +
			(node.type === "scene-note"
				? 0.34
				: node.type === "session-note"
					? 1.15
					: 0);
		const radius =
			node.type === "scene"
				? 92
				: node.type === "scene-note"
					? 56
					: node.type === "session-note"
						? 76
						: 84;

		return {
			x: parentPosition.x + Math.cos(angle) * radius,
			y: parentPosition.y + Math.sin(angle) * radius,
		};
	};

	nodes.forEach((node, index) => {
		if (node.type === "campaign") {
			positions.set(node.id, { x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y });
			return;
		}

		if (["scene", "scene-note", "session-note"].includes(node.type)) {
			const childPosition = getChildPosition(node);
			if (childPosition) {
				positions.set(node.id, childPosition);
				return;
			}
		}

		const typeIndex = Math.max(1, NODE_TYPE_ORDER.indexOf(node.type));
		const group = groups.get(node.type) || [];
		const groupIndex = Math.max(
			0,
			group.findIndex((item) => item.id === node.id),
		);
		const angle =
			(groupIndex / Math.max(1, group.length)) * Math.PI * 2 + typeIndex * 0.48;
		const ring =
			120 +
			(typeIndex % 4) * 58 +
			Math.floor(typeIndex / 4) * 54 +
			(index % 3) * 12;

		positions.set(node.id, {
			x: GRAPH_CENTER_X + Math.cos(angle) * ring,
			y: GRAPH_CENTER_Y + Math.sin(angle) * ring,
		});
	});

	return positions;
}

function fitPositionsToCanvas(positions) {
	const values = [...positions.values()];
	if (values.length === 0) return {};

	const minX = Math.min(...values.map((position) => position.x));
	const maxX = Math.max(...values.map((position) => position.x));
	const minY = Math.min(...values.map((position) => position.y));
	const maxY = Math.max(...values.map((position) => position.y));
	const contentWidth = Math.max(1, maxX - minX);
	const contentHeight = Math.max(1, maxY - minY);
	const scale = Math.min(
		1.35,
		(GRAPH_WIDTH - 100) / contentWidth,
		(GRAPH_HEIGHT - 90) / contentHeight,
	);
	const midX = minX + contentWidth / 2;
	const midY = minY + contentHeight / 2;

	return Object.fromEntries(
		[...positions.entries()].map(([id, position]) => [
			id,
			{
				x: GRAPH_CENTER_X + (position.x - midX) * scale,
				y: GRAPH_CENTER_Y + (position.y - midY) * scale,
			},
		]),
	);
}

function resolveNodeCollisions(positions, nodes, iterations = 18) {
	const next = new Map(
		positions instanceof Map ? positions : Object.entries(positions || {}),
	);
	const radii = new Map(nodes.map((node) => [node.id, getNodeRadius(node)]));

	for (let iteration = 0; iteration < iterations; iteration += 1) {
		let moved = false;

		for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
			for (
				let rightIndex = leftIndex + 1;
				rightIndex < nodes.length;
				rightIndex += 1
			) {
				const left = nodes[leftIndex];
				const right = nodes[rightIndex];
				const leftPosition = next.get(left.id);
				const rightPosition = next.get(right.id);
				if (!leftPosition || !rightPosition) continue;

				let dx = rightPosition.x - leftPosition.x;
				let dy = rightPosition.y - leftPosition.y;
				let distance = Math.sqrt(dx * dx + dy * dy);
				const minDistance =
					(radii.get(left.id) || 10) + (radii.get(right.id) || 10) + 10;

				if (distance >= minDistance) continue;
				if (distance < 0.01) {
					const angle =
						((leftIndex + rightIndex + 1) * 2.399963) % (Math.PI * 2);
					dx = Math.cos(angle);
					dy = Math.sin(angle);
					distance = 1;
				}

				const push = ((minDistance - distance) / 2) * 1.04;
				const pushX = (dx / distance) * push;
				const pushY = (dy / distance) * push;
				const leftWeight = left.type === "campaign" ? 0.35 : 1;
				const rightWeight = right.type === "campaign" ? 0.35 : 1;

				leftPosition.x = Math.min(
					GRAPH_WIDTH - 45,
					Math.max(45, leftPosition.x - pushX * leftWeight),
				);
				leftPosition.y = Math.min(
					GRAPH_HEIGHT - 40,
					Math.max(40, leftPosition.y - pushY * leftWeight),
				);
				rightPosition.x = Math.min(
					GRAPH_WIDTH - 45,
					Math.max(45, rightPosition.x + pushX * rightWeight),
				);
				rightPosition.y = Math.min(
					GRAPH_HEIGHT - 40,
					Math.max(40, rightPosition.y + pushY * rightWeight),
				);
				moved = true;
			}
		}

		if (!moved) break;
	}

	return next;
}

function computeLayout(nodes, edges) {
	if (nodes.length === 0) return {};
	if (nodes.length === 1) {
		return {
			[nodes[0].id]: { x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y },
		};
	}

	const positions = createInitialPositions(nodes);
	const nodeIds = new Set(nodes.map((node) => node.id));
	const nodeById = new Map(nodes.map((node) => [node.id, node]));
	const edgePairs = edges
		.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
		.map((edge) => ({
			source: edge.source,
			target: edge.target,
			relation: edge.relation,
			count: edge.count || 1,
		}));
	const iterations = nodes.length > 180 ? 36 : nodes.length > 90 ? 58 : 86;

	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const forces = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]));

		for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
			for (
				let rightIndex = leftIndex + 1;
				rightIndex < nodes.length;
				rightIndex += 1
			) {
				const left = nodes[leftIndex];
				const right = nodes[rightIndex];
				const leftPosition = positions.get(left.id);
				const rightPosition = positions.get(right.id);
				let dx = rightPosition.x - leftPosition.x;
				let dy = rightPosition.y - leftPosition.y;
				let distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < 0.01) {
					dx = 0.01;
					dy = 0.01;
					distance = 0.02;
				}

				const force = Math.min(3, 4300 / Math.max(120, distance * distance));
				const forceX = (dx / distance) * force;
				const forceY = (dy / distance) * force;
				forces.get(left.id).x -= forceX;
				forces.get(left.id).y -= forceY;
				forces.get(right.id).x += forceX;
				forces.get(right.id).y += forceY;
			}
		}

		edgePairs.forEach((edge) => {
			const sourcePosition = positions.get(edge.source);
			const targetPosition = positions.get(edge.target);
			const dx = targetPosition.x - sourcePosition.x;
			const dy = targetPosition.y - sourcePosition.y;
			const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
			const desiredDistance = getRelationDistance(edge, nodeById);
			const strength =
				getRelationStrength(edge.relation) *
				Math.min(2.4, 1 + edge.count * 0.18);
			const force = (distance - desiredDistance) * strength;
			const forceX = (dx / distance) * force;
			const forceY = (dy / distance) * force;

			forces.get(edge.source).x += forceX;
			forces.get(edge.source).y += forceY;
			forces.get(edge.target).x -= forceX;
			forces.get(edge.target).y -= forceY;
		});

		nodes.forEach((node) => {
			const position = positions.get(node.id);
			const force = forces.get(node.id);
			const centerStrength = node.type === "campaign" ? 0.08 : 0.009;
			force.x += (GRAPH_CENTER_X - position.x) * centerStrength;
			force.y += (GRAPH_CENTER_Y - position.y) * centerStrength;

			position.x = Math.min(
				GRAPH_WIDTH - 45,
				Math.max(45, position.x + force.x * 0.86),
			);
			position.y = Math.min(
				GRAPH_HEIGHT - 40,
				Math.max(40, position.y + force.y * 0.86),
			);
		});
	}

	return Object.fromEntries(
		resolveNodeCollisions(
			fitPositionsToCanvas(resolveNodeCollisions(positions, nodes)),
			nodes,
			24,
		).entries(),
	);
}

function getVisibleGraph(graph, enabledFilters, query) {
	const normalizedQuery = normalizeGraphName(query);
	const enabledNodes = graph.nodes.filter((node) => {
		if (node.type === "campaign") return true;
		if (
			node.type === "scene-note" &&
			enabledFilters[getFilterIdForType("scene")] === false
		) {
			return false;
		}
		return enabledFilters[getFilterIdForType(node.type)] !== false;
	});
	const enabledNodeIds = new Set(enabledNodes.map((node) => node.id));
	const enabledEdges = graph.edges.filter(
		(edge) =>
			enabledNodeIds.has(edge.source) && enabledNodeIds.has(edge.target),
	);

	if (!normalizedQuery) {
		return {
			nodes: enabledNodes,
			edges: enabledEdges,
			nodeById: new Map(enabledNodes.map((node) => [node.id, node])),
		};
	}

	const matchedIds = new Set(
		enabledNodes
			.filter((node) => node.searchText.includes(normalizedQuery))
			.map((node) => node.id),
	);
	const visibleIds = new Set(matchedIds);
	enabledEdges.forEach((edge) => {
		if (matchedIds.has(edge.source) || matchedIds.has(edge.target)) {
			visibleIds.add(edge.source);
			visibleIds.add(edge.target);
		}
	});

	const nodes = enabledNodes.filter((node) => visibleIds.has(node.id));
	const nodeIds = new Set(nodes.map((node) => node.id));
	const edges = enabledEdges.filter(
		(edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
	);

	return {
		nodes,
		edges,
		nodeById: new Map(nodes.map((node) => [node.id, node])),
	};
}

function getTypeCounts(nodes) {
	return nodes.reduce((acc, node) => {
		const filterId = getFilterIdForType(node.type);
		if (node.type !== "campaign") acc[filterId] = (acc[filterId] || 0) + 1;
		return acc;
	}, {});
}

function getConnectedIds(edges, nodeId) {
	if (!nodeId) return new Set();
	const ids = new Set([nodeId]);
	edges.forEach((edge) => {
		if (edge.source === nodeId) ids.add(edge.target);
		if (edge.target === nodeId) ids.add(edge.source);
	});
	return ids;
}

function getConnectedEdges(edges, nodeId) {
	if (!nodeId) return [];
	return edges.filter(
		(edge) => edge.source === nodeId || edge.target === nodeId,
	);
}

function getDirectNeighborIds(edges, nodeId) {
	if (!nodeId) return [];
	return [
		...new Set(
			edges.flatMap((edge) => {
				if (edge.source === nodeId) return [edge.target];
				if (edge.target === nodeId) return [edge.source];
				return [];
			}),
		),
	];
}

function getEntityDisplayName(entity, type) {
	if (type === "locations") {
		return String(entity.name || entity.title || "").trim();
	}
	return (
		`${entity.firstName || ""} ${entity.lastName || ""}`.trim() ||
		String(entity.name || entity.title || "").trim()
	);
}

function findByIdOrSlug(items, sourceId, sourceSlug) {
	return (items || []).find(
		(item) =>
			String(item.id) === String(sourceId) ||
			(sourceSlug && String(item.slug) === String(sourceSlug)),
	);
}

function findSessionDetail(sessionDetails, fileName) {
	return sessionDetails?.[fileName] || null;
}

function findEditableNote(node, notes, sessionDetails) {
	if (!node) return null;

	if (node.type === "campaign-note") {
		return (notes || []).find(
			(note) => String(note.id) === String(node.sourceId),
		);
	}

	if (node.type === "session-note") {
		const session = findSessionDetail(sessionDetails, node.meta?.fileName);
		return (session?.data?.notes || []).find(
			(note) => String(note.id) === String(node.sourceId),
		);
	}

	if (node.type === "scene-note") {
		const session = findSessionDetail(sessionDetails, node.meta?.fileName);
		const scene = (session?.data?.scenes || []).find(
			(item) => String(item.id) === String(node.meta?.sceneId),
		);
		return (scene?.notes || []).find(
			(note) => String(note.id) === String(node.sourceId),
		);
	}

	return null;
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
}) {
	const [enabledFilters, setEnabledFilters] = useState(DEFAULT_FILTERS);
	const [query, setQuery] = useState("");
	const [selectedNodeId, setSelectedNodeId] = useState(null);
	const [hoveredNodeId, setHoveredNodeId] = useState(null);
	const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
	const [nodePositionOffsets, setNodePositionOffsets] = useState({});
	const [draggingNodeId, setDraggingNodeId] = useState(null);
	const simplifiedNotesEnabled = useAppSelector(
		(state) => state.ui.simplifiedNotes,
	);
	const panStartRef = useRef(null);
	const nodeDragStartRef = useRef(null);
	const suppressNextNodeClickRef = useRef(false);
	const svgRef = useRef(null);
	const canvasWrapRef = useRef(null);

	useEffect(() => {
		onLoadSessionDetails?.();
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
		() => getVisibleGraph(graph, enabledFilters, query),
		[enabledFilters, graph, query],
	);
	const typeCounts = useMemo(() => getTypeCounts(graph.nodes), [graph.nodes]);
	const layout = useMemo(
		() => computeLayout(visibleGraph.nodes, visibleGraph.edges),
		[visibleGraph.edges, visibleGraph.nodes],
	);
	const displayLayout = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(layout).map(([nodeId, position]) => {
					const offset = nodePositionOffsets[nodeId];
					if (!offset) return [nodeId, position];
					return [
						nodeId,
						clampGraphPosition({
							x: position.x + offset.x,
							y: position.y + offset.y,
						}),
					];
				}),
			),
		[layout, nodePositionOffsets],
	);
	const focusedNodeId = hoveredNodeId || selectedNodeId;
	const connectedIds = useMemo(
		() => getConnectedIds(visibleGraph.edges, focusedNodeId),
		[focusedNodeId, visibleGraph.edges],
	);
	const selectedNode = selectedNodeId
		? visibleGraph.nodeById.get(selectedNodeId)
		: null;
	const selectedDetailText =
		selectedNode?.detailText || selectedNode?.summary || "";
	const hideSelectedTitle = Boolean(selectedNode?.meta?.isSimplifiedNote);
	const selectedEdges = useMemo(
		() => getConnectedEdges(visibleGraph.edges, selectedNodeId),
		[selectedNodeId, visibleGraph.edges],
	);

	useEffect(() => {
		if (selectedNodeId && !visibleGraph.nodeById.has(selectedNodeId)) {
			setSelectedNodeId(null);
		}
	}, [selectedNodeId, visibleGraph.nodeById]);

	useEffect(() => {
		setNodePositionOffsets((prev) => {
			const visibleNodeIds = new Set(visibleGraph.nodes.map((node) => node.id));
			const next = Object.fromEntries(
				Object.entries(prev).filter(([nodeId]) => visibleNodeIds.has(nodeId)),
			);
			return Object.keys(next).length === Object.keys(prev).length
				? prev
				: next;
		});
	}, [visibleGraph.nodes]);

	const toggleFilter = (filterId) => {
		setEnabledFilters((prev) => ({
			...prev,
			[filterId]: !prev[filterId],
		}));
	};

	const handleNodeClick = (node, event) => {
		event.stopPropagation();
		if (suppressNextNodeClickRef.current) {
			suppressNextNodeClickRef.current = false;
			return;
		}
		if (selectedNodeId === node.id) {
			openNode(node);
			return;
		}
		setSelectedNodeId(node.id);
	};

	function openNode(node) {
		if (node.type === "session" && node.meta?.fileName) {
			onOpenSession?.(node.meta.fileName);
			return;
		}

		const entityConfig =
			node.type === "character"
				? {
						type: "characters",
						entity: findByIdOrSlug(characters, node.sourceId, node.sourceSlug),
					}
				: node.type === "npc"
					? {
							type: "npc",
							entity: findByIdOrSlug(npcs, node.sourceId, node.sourceSlug),
						}
					: node.type === "location"
						? {
								type: "locations",
								entity: findByIdOrSlug(
									locations,
									node.sourceId,
									node.sourceSlug,
								),
							}
						: null;

		if (entityConfig?.entity) {
			openModalRequest({
				title: lang
					.t("{type}: {name}", {
						type:
							entityConfig.type === "locations"
								? lang.t("Location/Faction")
								: entityConfig.type === "npc"
									? "NPC"
									: lang.t("Character"),
						name: getEntityDisplayName(entityConfig.entity, entityConfig.type),
					})
					.trim(),
				type: entityConfig.type === "locations" ? "location" : "character",
				className:
					entityConfig.type === "locations" ? "EntityLinkModal--location" : "",
				showFooter: false,
				children: (
					<EntityModalContent
						initialEntity={entityConfig.entity}
						campaignSlug={campaign.slug}
						type={entityConfig.type}
						onClose={() => closeActiveModal(null)}
					/>
				),
			});
			return;
		}

		if (
			["campaign-note", "session-note", "scene-note"].includes(node.type) &&
			typeof onSaveNote === "function"
		) {
			const note = findEditableNote(node, notes, sessionDetails);
			if (!note) return;

			openModalRequest({
				title: lang.t("Note"),
				type: "note",
				showFooter: false,
				children: (
					<GraphNoteModalContent
						note={note}
						simplifiedNotes={simplifiedNotesEnabled}
						campaignSlug={campaign.slug}
						onSave={(updates) =>
							onSaveNote({
								nodeType: node.type,
								fileName: node.meta?.fileName,
								sceneId: node.meta?.sceneId,
								noteId: node.sourceId,
								updates,
							})
						}
					/>
				),
			});
		}
	}

	const handleNodePointerDown = (node, event) => {
		if (event.button !== 0) return;
		const position = displayLayout[node.id];
		if (!position) return;

		event.stopPropagation();
		event.currentTarget.setPointerCapture?.(event.pointerId);
		nodeDragStartRef.current = {
			pointerId: event.pointerId,
			nodeId: node.id,
			x: event.clientX,
			y: event.clientY,
			startOffsets: nodePositionOffsets,
			neighborIds: getDirectNeighborIds(visibleGraph.edges, node.id),
			didMove: false,
		};
		setDraggingNodeId(node.id);
	};

	const handlePointerDown = (event) => {
		if (event.button !== 0) return;
		if (event.target?.closest?.(".CampaignNotesGraph__node")) return;
		panStartRef.current = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			transform,
		};
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};

	const handlePointerMove = (event) => {
		if (nodeDragStartRef.current) {
			const start = nodeDragStartRef.current;
			if (start.pointerId !== event.pointerId) return;
			const rect = svgRef.current?.getBoundingClientRect();
			const scaleX = rect?.width ? GRAPH_WIDTH / rect.width : 1;
			const scaleY = rect?.height ? GRAPH_HEIGHT / rect.height : 1;
			const dx =
				((event.clientX - start.x) * scaleX) / Math.max(0.1, transform.scale);
			const dy =
				((event.clientY - start.y) * scaleY) / Math.max(0.1, transform.scale);

			if (Math.sqrt(dx * dx + dy * dy) > 3) {
				start.didMove = true;
			}

			setNodePositionOffsets(() => {
				const next = { ...start.startOffsets };
				const draggedStartOffset = start.startOffsets[start.nodeId] || {
					x: 0,
					y: 0,
				};
				next[start.nodeId] = {
					x: draggedStartOffset.x + dx,
					y: draggedStartOffset.y + dy,
				};

				start.neighborIds.forEach((nodeId) => {
					const neighborStartOffset = start.startOffsets[nodeId] || {
						x: 0,
						y: 0,
					};
					next[nodeId] = {
						x: neighborStartOffset.x + dx * 0.28,
						y: neighborStartOffset.y + dy * 0.28,
					};
				});

				return next;
			});
			return;
		}

		if (!panStartRef.current) return;
		const start = panStartRef.current;
		const rect = svgRef.current?.getBoundingClientRect();
		const scaleX = rect?.width ? GRAPH_WIDTH / rect.width : 1;
		const scaleY = rect?.height ? GRAPH_HEIGHT / rect.height : 1;
		setTransform({
			...start.transform,
			x: start.transform.x + (event.clientX - start.x) * scaleX,
			y: start.transform.y + (event.clientY - start.y) * scaleY,
		});
	};

	const handlePointerUp = (event) => {
		if (nodeDragStartRef.current?.pointerId === event.pointerId) {
			suppressNextNodeClickRef.current = nodeDragStartRef.current.didMove;
			nodeDragStartRef.current = null;
			setDraggingNodeId(null);
		}
		if (panStartRef.current?.pointerId === event.pointerId) {
			panStartRef.current = null;
		}
	};

	const handleWheel = useCallback((event) => {
		event.preventDefault();
		event.stopPropagation();
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect?.width || !rect?.height) return;
		const point = {
			x: ((event.clientX - rect.left) / rect.width) * GRAPH_WIDTH,
			y: ((event.clientY - rect.top) / rect.height) * GRAPH_HEIGHT,
		};
		const direction = event.deltaY > 0 ? -1 : 1;
		setTransform((prev) => {
			const nextScale = Math.min(
				2.3,
				Math.max(0.45, prev.scale + direction * 0.09),
			);
			const graphPoint = {
				x: (point.x - prev.x) / prev.scale,
				y: (point.y - prev.y) / prev.scale,
			};

			return {
				scale: nextScale,
				x: point.x - graphPoint.x * nextScale,
				y: point.y - graphPoint.y * nextScale,
			};
		});
	}, []);

	useEffect(() => {
		const element = canvasWrapRef.current;
		if (!element) return undefined;
		element.addEventListener("wheel", handleWheel, { passive: false });
		return () => element.removeEventListener("wheel", handleWheel);
	}, [handleWheel]);

	const handleCanvasClick = (event) => {
		if (event.target === event.currentTarget) {
			setSelectedNodeId(null);
		}
	};

	const renderConnection = (edge) => {
		const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
		const otherNode = visibleGraph.nodeById.get(otherId);
		if (!otherNode) return null;
		const sourceLabels = formatGraphSourceList(edge.sources);

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
				<span className={`CampaignNotesGraph__dot is-${otherNode.type}`} />
				<span className="CampaignNotesGraph__connectionText">
					<strong>{otherNode.label}</strong>
					<span>
						{lang.t(getRelationLabel(edge.relation))}
						{edge.count > 1 ? ` (${edge.count})` : ""}
						{sourceLabels ? ` · ${sourceLabels}` : ""}
					</span>
				</span>
			</button>
		);
	};

	const renderEdge = (edge) => {
		const source = displayLayout[edge.source];
		const target = displayLayout[edge.target];
		if (!source || !target) return null;
		const isFocused =
			!focusedNodeId ||
			edge.source === focusedNodeId ||
			edge.target === focusedNodeId;

		return (
			<line
				key={edge.id}
				className={classNames(
					"CampaignNotesGraph__edge",
					`is-${edge.relation}`,
					!isFocused && "is-muted",
				)}
				x1={source.x}
				y1={source.y}
				x2={target.x}
				y2={target.y}
				stroke={getEdgeColor(edge)}
				strokeOpacity={getEdgeOpacity(edge, isFocused)}
				strokeWidth={getEdgeStrokeWidth(edge)}
				vectorEffect="non-scaling-stroke"
			/>
		);
	};

	const structuralEdges = visibleGraph.edges.filter(
		(edge) => edge.relation === "contains",
	);
	const relationEdges = visibleGraph.edges.filter(
		(edge) => edge.relation !== "contains",
	);

	const openSelectedNode = () => {
		if (selectedNode) openNode(selectedNode);
	};

	return (
		<div
			className={classNames(
				"CampaignNotesGraph",
				draggingNodeId && "is-dragging-node",
			)}
		>
			<div className="CampaignNotesGraph__workspace">
				<div className="CampaignNotesGraph__toolbar">
					<input
						className="CampaignNotesGraph__search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={lang.t("Search graph...")}
					/>
					<div className="CampaignNotesGraph__filters">
						{FILTERS.map((filter) => (
							<Button
								key={filter.id}
								variant={enabledFilters[filter.id] ? "primary" : "ghost"}
								size={Button.SIZES.SMALL}
								onClick={() => toggleFilter(filter.id)}
								className="CampaignNotesGraph__filter"
								style={{ "--filter-color": FILTER_COLOR_BY_ID[filter.id] }}
							>
								{lang.t(filter.label)}
								{typeCounts[filter.id] ? ` ${typeCounts[filter.id]}` : ""}
							</Button>
						))}
					</div>
				</div>

				<div ref={canvasWrapRef} className="CampaignNotesGraph__canvasWrap">
					{error && (
						<div className="CampaignNotesGraph__message CampaignNotesGraph__message--error">
							{error}
						</div>
					)}
					{isLoading && (
						<div className="CampaignNotesGraph__message">
							{lang.t("Loading graph...")}
						</div>
					)}
					{visibleGraph.nodes.length <= 1 && !isLoading && (
						<div className="CampaignNotesGraph__message">
							{query ? lang.t("Nothing found.") : lang.t("No graph links yet.")}
						</div>
					)}
					<svg
						ref={svgRef}
						className="CampaignNotesGraph__canvas"
						viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
						role="img"
						aria-label={lang.t("Campaign graph")}
						onClick={handleCanvasClick}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						onPointerCancel={handlePointerUp}
					>
						<g
							transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}
						>
							<g className="CampaignNotesGraph__edges">
								{structuralEdges.map(renderEdge)}
								{relationEdges.map(renderEdge)}
							</g>
							<g className="CampaignNotesGraph__nodes">
								{visibleGraph.nodes.map((node) => {
									const position = displayLayout[node.id];
									if (!position) return null;
									const radius = getNodeRadius(node);
									const isFocused = !focusedNodeId || connectedIds.has(node.id);
									const isSelected = selectedNodeId === node.id;

									return (
										<g
											key={node.id}
											className={classNames(
												"CampaignNotesGraph__node",
												`is-${node.type}`,
												isSelected && "is-selected",
												draggingNodeId === node.id && "is-dragging",
												!isFocused && "is-muted",
											)}
											transform={`translate(${position.x} ${position.y})`}
											onPointerDown={(event) =>
												handleNodePointerDown(node, event)
											}
											onClick={(event) => handleNodeClick(node, event)}
											onMouseEnter={() => setHoveredNodeId(node.id)}
											onMouseLeave={() => setHoveredNodeId(null)}
										>
											<title>{node.label}</title>
											<circle r={radius} />
											<text y={radius + 14}>{truncateLabel(node.label)}</text>
										</g>
									);
								})}
							</g>
						</g>
					</svg>
				</div>
			</div>

			<aside
				className="CampaignNotesGraph__details"
				onWheel={(event) => event.stopPropagation()}
			>
				{selectedNode ? (
					<>
						<div className="CampaignNotesGraph__type">
							<span
								className={`CampaignNotesGraph__dot is-${selectedNode.type}`}
							/>
							{lang.t(TYPE_LABELS[selectedNode.type] || selectedNode.type)}
						</div>
						{!hideSelectedTitle && <h4>{selectedNode.label}</h4>}
						<ParsedGraphText
							text={selectedDetailText}
							onOpen={openSelectedNode}
						/>
						<dl className="CampaignNotesGraph__stats">
							<div>
								<dt>{lang.t("Connections")}</dt>
								<dd>{selectedEdges.length}</dd>
							</div>
							{selectedNode.meta?.fileName && (
								<div>
									<dt>{lang.t("Session")}</dt>
									<dd>{getSessionDisplayName(selectedNode.meta.fileName)}</dd>
								</div>
							)}
						</dl>
						{selectedEdges.length > 0 && (
							<div className="CampaignNotesGraph__connections">
								<h5>{lang.t("Connections")}</h5>
								{selectedEdges.map(renderConnection)}
							</div>
						)}
					</>
				) : (
					<>
						<h4>{lang.t("Graph overview")}</h4>
						<dl className="CampaignNotesGraph__stats">
							<div>
								<dt>{lang.t("Nodes")}</dt>
								<dd>{visibleGraph.nodes.length}</dd>
							</div>
							<div>
								<dt>{lang.t("Connections")}</dt>
								<dd>{visibleGraph.edges.length}</dd>
							</div>
							<div>
								<dt>{lang.t("Unknown mention")}</dt>
								<dd>{graph.stats.unresolved}</dd>
							</div>
						</dl>
						<div className="CampaignNotesGraph__legend">
							{NODE_TYPE_ORDER.filter((type) =>
								graph.nodes.some((node) => node.type === type),
							).map((type) => (
								<span key={type}>
									<span className={`CampaignNotesGraph__dot is-${type}`} />
									{lang.t(TYPE_LABELS[type] || type)}
								</span>
							))}
						</div>
					</>
				)}
			</aside>
		</div>
	);
}
