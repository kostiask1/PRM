import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactMarkdown from "react-markdown";
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
} from "@xyflow/react";

import Button from "../form/Button";
import EditableField from "../form/EditableField";
import EntityModal from "../common/EntityModal";
import Icon from "../common/Icon";
import classNames from "../../shared/lib/classNames.js";
import {
	buildCampaignGraph,
	getCampaignGraphNodeSize,
	layoutCampaignGraph,
	normalizeGraphName,
	resolveCampaignGraphNodeCollision,
} from "../../entities/campaign/graph.js";
import { lang } from "../../shared/config/index.js";
import { openModalRequest } from "../../shared/model/index.js";
import { useAppSelector } from "../../shared/lib/index.js";
import { renderMentionText } from "../../renderers/contentRenderer.jsx";
import "@xyflow/react/dist/style.css";
import "../../assets/components/CampaignNotesGraph.css";

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

const NODE_COLOR_BY_TYPE = {
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

const NODE_ICON_BY_TYPE = {
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

const FILTER_COLOR_BY_ID = {
	notes: NODE_COLOR_BY_TYPE["campaign-note"],
	characters: NODE_COLOR_BY_TYPE.character,
	npc: NODE_COLOR_BY_TYPE.npc,
	locations: NODE_COLOR_BY_TYPE.location,
	sessions: NODE_COLOR_BY_TYPE.session,
	scenes: NODE_COLOR_BY_TYPE.scene,
	unresolved: NODE_COLOR_BY_TYPE.unresolved,
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

function renderMentionChildren(children) {
	return React.Children.map(children, (child) => {
		if (typeof child === "string") return renderMentionText(child);
		if (React.isValidElement(child) && child.props?.children) {
			if (child.type === "code" || child.type === "pre") return child;
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

function getNodeTypeClass(type) {
	return `is_${String(type || "").replace(/-/g, "_")}`;
}

function getSessionDisplayName(fileName) {
	return String(fileName || "").replace(/\.json$/i, "");
}

function getRelationLabel(relation) {
	if (relation === "contains") return "Contains";
	if (relation === "sequence") return "Sequence";
	if (relation === "related") return "Related";
	return "Mentions";
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
	if (edge.relation === "mentions") {
		return Math.min(3.1, 1.5 + edge.count * 0.18);
	}
	if (edge.relation === "related") {
		return Math.min(2.6, 1.35 + edge.count * 0.14);
	}
	return edge.relation === "sequence" ? 2.1 : 1.25;
}

function getEdgeColor(edge) {
	if (edge.relation === "mentions") return "#38bdf8";
	if (edge.relation === "sequence") return "#e879f9";
	if (edge.relation === "related") return "#f59e0b";
	return "#94a3b8";
}

function getEdgeOpacity(edge, isFocused, hasFocus) {
	if (hasFocus && !isFocused) return 0.07;
	if (isFocused && hasFocus) return edge.relation === "contains" ? 0.55 : 0.9;
	if (edge.relation === "contains") return 0.16;
	if (edge.relation === "sequence") return 0.35;
	return 0.32;
}

function getEdgeHandles(source, target) {
	const dx = (target?.x || 0) - (source?.x || 0);
	const dy = (target?.y || 0) - (source?.y || 0);
	if (Math.abs(dx) >= Math.abs(dy)) {
		return dx >= 0
			? { sourceHandle: "source-right", targetHandle: "target-left" }
			: { sourceHandle: "source-left", targetHandle: "target-right" };
	}
	return dy >= 0
		? { sourceHandle: "source-bottom", targetHandle: "target-top" }
		: { sourceHandle: "source-top", targetHandle: "target-bottom" };
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
				onOpen && "is_clickable",
			)}
			role={onOpen ? "button" : undefined}
			tabIndex={onOpen ? 0 : undefined}
			onClick={(event) => {
				if (!onOpen) return;
				if (event.target?.closest?.("a, button, input, textarea, select")) return;
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
			return undefined;
		}

		const timer = setTimeout(() => {
			onSave?.({ title: draft.title || "", text: draft.text || "" });
		}, 450);

		return () => clearTimeout(timer);
	}, [draft, onSave]);

	const updateDraft = (updates) => {
		setDraft((previous) => ({ ...previous, ...updates }));
	};

	return (
		<div className="CampaignNotesGraph__noteModal">
			{!simplifiedNotes && (
				<EditableField
					value={draft.title || ""}
					enableHistory={false}
					onChange={(event) => updateDraft({ title: event.target.value })}
					placeholder={lang.t("New note")}
					className="CampaignNotesGraph__noteTitle"
				/>
			)}
			<EditableField
				type="textarea"
				value={draft.text || ""}
				enableHistory={false}
				onChange={(event) => updateDraft({ text: event.target.value })}
				placeholder={lang.t("Note text...")}
				campaignSlug={campaignSlug}
				className="CampaignNotesGraph__noteText"
			/>
		</div>
	);
}

const CampaignGraphNode = memo(function CampaignGraphNode({ data, selected }) {
	const graphNode = data.graphNode;
	const nodeTypeClass = getNodeTypeClass(graphNode.type);

	return (
		<div
			className={classNames(
				"CampaignNotesGraph__nodeCard",
				nodeTypeClass,
				(selected || data.isSelected) && "is_selected",
				data.isMuted && "is_muted",
			)}
			style={{ "--graph-node-color": data.color }}
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

const NODE_TYPES = { campaignGraphNode: CampaignGraphNode };

function getGraphTopologyKey(nodes, edges) {
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

function getGraphNodeTopologyKey(nodes) {
	return nodes
		.map(
			(node) =>
				`${node.id}:${node.data?.graphNode?.type || node.type}`,
		)
		.sort()
		.join("|");
}

function useCampaignGraphLayout(nodes, edges) {
	const cacheRef = useRef({ key: null, positions: {} });
	const topologyKey = getGraphTopologyKey(nodes, edges);
	if (cacheRef.current.key !== topologyKey) {
		cacheRef.current = {
			key: topologyKey,
			positions: layoutCampaignGraph(nodes, edges),
		};
	}
	return cacheRef.current.positions;
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

	let visibleNodeIds = enabledNodeIds;
	if (normalizedQuery) {
		const matchedIds = new Set(
			enabledNodes
				.filter((node) => node.searchText.includes(normalizedQuery))
				.map((node) => node.id),
		);
		visibleNodeIds = new Set(matchedIds);
		enabledEdges.forEach((edge) => {
			if (matchedIds.has(edge.source) || matchedIds.has(edge.target)) {
				visibleNodeIds.add(edge.source);
				visibleNodeIds.add(edge.target);
			}
		});
	}

	const nodes = enabledNodes.filter((node) => visibleNodeIds.has(node.id));
	const edges = enabledEdges.filter(
		(edge) =>
			visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
	);

	return {
		nodes,
		edges,
		visibleNodeIds,
		visibleEdgeIds: new Set(edges.map((edge) => edge.id)),
		nodeById: new Map(nodes.map((node) => [node.id, node])),
	};
}

function getTypeCounts(nodes) {
	return nodes.reduce((counts, node) => {
		if (node.type === "campaign") return counts;
		const filterId = getFilterIdForType(node.type);
		counts[filterId] = (counts[filterId] || 0) + 1;
		return counts;
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

const MINIMAP_ASPECT_RATIO = 3 / 2;

function getMiniMapNodeSize(node) {
	const fallback = getCampaignGraphNodeSize(node.data?.graphNode?.type);
	return {
		width: node.measured?.width || Number.parseFloat(node.style?.width) || fallback.width,
		height: node.measured?.height || Number.parseFloat(node.style?.height) || fallback.height,
	};
}

function getMiniMapBounds(nodes) {
	const visibleNodes = nodes.filter((node) => !node.hidden);
	if (!visibleNodes.length) return null;

	const extents = visibleNodes.reduce((result, node) => {
		const { width, height } = getMiniMapNodeSize(node);
		const left = node.position.x - width / 2;
		const top = node.position.y - height / 2;
		return {
			minX: Math.min(result.minX, left),
			minY: Math.min(result.minY, top),
			maxX: Math.max(result.maxX, left + width),
			maxY: Math.max(result.maxY, top + height),
		};
	}, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

	let width = Math.max(extents.maxX - extents.minX, 1);
	let height = Math.max(extents.maxY - extents.minY, 1);
	const centerX = (extents.minX + extents.maxX) / 2;
	const centerY = (extents.minY + extents.maxY) / 2;
	const padding = Math.max(width, height) * 0.055;
	width += padding * 2;
	height += padding * 2;

	if (width / height < MINIMAP_ASPECT_RATIO) width = height * MINIMAP_ASPECT_RATIO;
	else height = width / MINIMAP_ASPECT_RATIO;

	return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

function CampaignGraphMiniMap({ nodes }) {
	const svgRef = useRef(null);
	const activePointerRef = useRef(null);
	const { setCenter } = useReactFlow();
	const viewport = useViewport();
	const flowWidth = useStore((state) => state.width);
	const flowHeight = useStore((state) => state.height);
	const bounds = useMemo(() => getMiniMapBounds(nodes), [nodes]);

	const moveViewport = useCallback((event) => {
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
					const { width, height } = getMiniMapNodeSize(node);
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

function findByIdOrSlug(items, sourceId, sourceSlug) {
	return (items || []).find(
		(item) =>
			String(item.id) === String(sourceId) ||
			(sourceSlug && String(item.slug) === String(sourceSlug)),
	);
}

function findSessionDetail(sessionDetails, fileName) {
	if (sessionDetails instanceof Map) return sessionDetails.get(fileName) || null;
	return sessionDetails?.[fileName] || null;
}

function findGraphEntity(node, campaignEntities, sessionDetails, sessionKey) {
	if (node?.meta?.scope === "session") {
		const session = findSessionDetail(sessionDetails, node.meta?.fileName);
		return findByIdOrSlug(
			session?.data?.[sessionKey],
			node.sourceId,
			node.sourceSlug,
		);
	}
	return findByIdOrSlug(campaignEntities, node.sourceId, node.sourceSlug);
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

function canOpenNode(node, onSaveNote) {
	if (!node) return false;
	if (["session", "character", "npc", "location"].includes(node.type)) {
		return true;
	}
	return (
		typeof onSaveNote === "function" &&
		["campaign-note", "session-note", "scene-note"].includes(node.type)
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
}) {
	const [enabledFilters, setEnabledFilters] = useState(DEFAULT_FILTERS);
	const [query, setQuery] = useState("");
	const [selectedNodeId, setSelectedNodeId] = useState(null);
	const [entityModalState, setEntityModalState] = useState(null);
	const [hoveredNodeId, setHoveredNodeId] = useState(null);
	const [flowInstance, setFlowInstance] = useState(null);
	const [flowNodes, setFlowNodes, onFlowNodesChange] = useNodesState([]);
	const fittedNodeTopologyRef = useRef(null);
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
	const layoutPositions = useCampaignGraphLayout(graph.nodes, graph.edges);
	const nodeTopologyKey = getGraphNodeTopologyKey(graph.nodes);
	const flowNodeTopologyKey = getGraphNodeTopologyKey(flowNodes);
	const focusedNodeId = hoveredNodeId || selectedNodeId;
	const connectedIds = useMemo(
		() => getConnectedIds(visibleGraph.edges, focusedNodeId),
		[focusedNodeId, visibleGraph.edges],
	);
	const selectedNode = selectedNodeId
		? visibleGraph.nodeById.get(selectedNodeId)
		: null;
	const selectedEdges = useMemo(
		() => getConnectedEdges(visibleGraph.edges, selectedNodeId),
		[selectedNodeId, visibleGraph.edges],
	);

	const openNode = useCallback(
		(node) => {
			if (node.type === "session" && node.meta?.fileName) {
				onOpenSession?.(node.meta.fileName);
				return;
			}

			const entityConfig =
				node.type === "character"
					? {
							type: "characters",
							entity: findByIdOrSlug(
								characters,
								node.sourceId,
								node.sourceSlug,
							),
						}
					: node.type === "npc"
						? {
								type: "npc",
								entity: findGraphEntity(
									node,
									npcs,
									sessionDetails,
									"npcs",
								),
							}
						: node.type === "location"
							? {
									type: "locations",
									entity: findGraphEntity(
										node,
										locations,
										sessionDetails,
										"locations",
									),
								}
							: null;

			if (entityConfig?.entity) {
				setEntityModalState({
					entity: entityConfig.entity,
					type: entityConfig.type,
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
				: new Map();
			let nextNodes = graph.nodes.map((graphNode) => {
				const currentNode = currentById.get(graphNode.id);
				const size = getCampaignGraphNodeSize(graphNode.type);
				return {
					...currentNode,
					id: graphNode.id,
					type: "campaignGraphNode",
					position:
						currentNode?.position ||
						layoutPositions[graphNode.id] || { x: 0, y: 0 },
					origin: [0.5, 0.5],
					zIndex: selectedNodeId === graphNode.id ? 3 : 2,
					style: { width: size.width, height: size.height },
					data: {
						graphNode,
						color: NODE_COLOR_BY_TYPE[graphNode.type],
						typeLabel: lang.t(TYPE_LABELS[graphNode.type] || graphNode.type),
						connectionsLabel: lang.t("Connections"),
						isSelected: selectedNodeId === graphNode.id,
						isMuted:
							Boolean(focusedNodeId) && !connectedIds.has(graphNode.id),
						canOpen: canOpenNode(graphNode, onSaveNote),
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
					className: getNodeTypeClass(graphNode.type),
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

	const flowEdges = useMemo(() => {
		const positions = new Map(flowNodes.map((node) => [node.id, node.position]));
		const hasFocus = Boolean(focusedNodeId);
		return graph.edges.map((edge) => {
			const isVisible = visibleGraph.visibleEdgeIds.has(edge.id);
			const isFocused =
				!hasFocus ||
				edge.source === focusedNodeId ||
				edge.target === focusedNodeId;
			const color = getEdgeColor(edge);
			const handles = getEdgeHandles(
				positions.get(edge.source),
				positions.get(edge.target),
			);

			return {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				...handles,
				type: edge.relation === "contains" ? "smoothstep" : "default",
				hidden: !isVisible,
				selectable: false,
				focusable: false,
				deletable: false,
				animated:
					Boolean(focusedNodeId) && isFocused && edge.relation === "mentions",
				className: classNames(
					"CampaignNotesGraph__flowEdge",
					`is_${edge.relation}`,
					!isFocused && "is_muted",
				),
				style: {
					stroke: color,
					strokeWidth: getEdgeStrokeWidth(edge),
					opacity: getEdgeOpacity(edge, isFocused, hasFocus),
					strokeDasharray:
						edge.relation === "related"
							? "7 6"
							: edge.relation === "sequence"
								? "10 7"
								: undefined,
				},
				markerEnd:
					edge.relation === "sequence"
						? {
								type: MarkerType.ArrowClosed,
								color,
								width: 14,
								height: 14,
							}
						: undefined,
				label: isFocused && edge.count > 1 ? String(edge.count) : undefined,
				labelStyle: { fill: "var(--text-bright)", fontWeight: 700 },
				labelBgStyle: {
					fill: "var(--panel)",
					fillOpacity: 0.92,
				},
				labelBgPadding: [5, 3],
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

	const handleNodeDragStop = useCallback(
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
		(changes) => {
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

	const toggleFilter = (filterId) => {
		shouldRelayoutForFilterRef.current = true;
		setEnabledFilters((previous) => ({
			...previous,
			[filterId]: !previous[filterId],
		}));
	};

	const renderConnection = (edge) => {
		const otherId = edge.source === selectedNodeId ? edge.target : edge.source;
		const otherNode = visibleGraph.nodeById.get(otherId);
		if (!otherNode) return null;
		const sourceLabels = formatGraphSourceList(edge.sources);
		const connectionMetaText = `${lang.t(getRelationLabel(edge.relation))}${
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
					className={`CampaignNotesGraph__dot ${getNodeTypeClass(otherNode.type)}`}
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
	const selectedDetailText =
		selectedNode?.detailText || selectedNode?.summary || "";
	const hideSelectedTitle = Boolean(selectedNode?.meta?.isSimplifiedNote);
	const selectedCanOpen = canOpenNode(selectedNode, onSaveNote);

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
				<div className="CampaignNotesGraph__toolbar">
					<div className="CampaignNotesGraph__toolbarPrimary">
						<label className="CampaignNotesGraph__searchWrap">
							<span className="CampaignNotesGraph__visuallyHidden">
								{lang.t("Search graph...")}
							</span>
							<input
								className="CampaignNotesGraph__search"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={lang.t("Search graph...")}
							/>
							<span className="CampaignNotesGraph__visibleCount">
								{visibleNonCampaignNodes}/{totalNonCampaignNodes}
							</span>
						</label>
						<Button
							variant="ghost"
							size={Button.SIZES.SMALL}
							icon="restore"
							onClick={handleRelayout}
							className="CampaignNotesGraph__relayout"
							title={lang.t("Arrange graph")}
						>
							{lang.t("Arrange")}
						</Button>
					</div>
					<div className="CampaignNotesGraph__filters">
						{FILTERS.map((filter) => (
							<Button
								key={filter.id}
								variant={enabledFilters[filter.id] ? "primary" : "ghost"}
								size={Button.SIZES.SMALL}
								onClick={() => toggleFilter(filter.id)}
								className="CampaignNotesGraph__filter"
								style={{ "--filter-color": FILTER_COLOR_BY_ID[filter.id] }}
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
					{visibleNonCampaignNodes === 0 && !isLoading && (
						<div className="CampaignNotesGraph__message">
							{query ? lang.t("Nothing found.") : lang.t("No graph links yet.")}
						</div>
					)}
					<ReactFlow
						nodes={flowNodes}
						edges={flowEdges}
						nodeTypes={NODE_TYPES}
						onInit={setFlowInstance}
						onNodesChange={handleFlowNodesChange}
						onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
						onNodeDoubleClick={(_event, node) => {
							const graphNode = graph.nodes.find((item) => item.id === node.id);
							if (graphNode) openNode(graphNode);
						}}
						onNodeMouseEnter={(_event, node) => setHoveredNodeId(node.id)}
						onNodeMouseLeave={() => setHoveredNodeId(null)}
						onNodeDragStop={handleNodeDragStop}
						onPaneClick={() => setSelectedNodeId(null)}
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
						colorMode={currentTheme === "dark" ? "dark" : "light"}
					>
						<Background
							variant={BackgroundVariant.Dots}
							gap={24}
							size={1.25}
						/>
						<Controls
							position="bottom-left"
							showInteractive={false}
							fitViewOptions={{ padding: 0.16, duration: 420 }}
						/>
						<CampaignGraphMiniMap nodes={flowNodes} />
					</ReactFlow>
				</div>
			</div>

			<aside className="CampaignNotesGraph__details">
				{selectedNode ? (
					<>
						<div className="CampaignNotesGraph__detailHeader">
							<div>
								<div className="CampaignNotesGraph__type">
									<span
										className={`CampaignNotesGraph__dot ${getNodeTypeClass(selectedNode.type)}`}
									/>
									{lang.t(TYPE_LABELS[selectedNode.type] || selectedNode.type)}
								</div>
								{!hideSelectedTitle && <h4>{selectedNode.label}</h4>}
							</div>
							{selectedCanOpen && (
								<Button
									variant="ghost"
									size={Button.SIZES.SMALL}
									icon="forward"
									onClick={() => openNode(selectedNode)}
									title={lang.t("Open {name}", {
										name: selectedNode.label,
									})}
								/>
							)}
						</div>
						<ParsedGraphText
							text={selectedDetailText}
							onOpen={selectedCanOpen ? () => openNode(selectedNode) : null}
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
								{selectedEdges.map(renderConnection)}
							</div>
						)}
					</>
				) : (
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
								<dd>{visibleNonCampaignNodes}</dd>
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
								visibleGraph.nodes.some((node) => node.type === type),
							).map((type) => (
								<span key={type}>
									<span
										className={`CampaignNotesGraph__dot ${getNodeTypeClass(type)}`}
									/>
									{lang.t(TYPE_LABELS[type] || type)}
								</span>
							))}
						</div>
					</>
				)}
			</aside>
			<EntityModal
				modalState={entityModalState}
				onClose={() => setEntityModalState(null)}
			/>
		</div>
	);
}
