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
import { renderMentionText } from "../../renderers/contentRenderer.jsx";
import "../../assets/components/CampaignNotesGraph.css";

const GRAPH_WIDTH = 1400;
const GRAPH_HEIGHT = 840;
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

const LAYOUT_GROUPS = [
	{ id: "notes", label: "Notes", color: FILTER_COLOR_BY_ID.notes },
	{
		id: "characters",
		label: "Characters",
		color: FILTER_COLOR_BY_ID.characters,
	},
	{ id: "npc", label: "NPC", color: FILTER_COLOR_BY_ID.npc },
	{
		id: "locations",
		label: "Locations/Factions",
		color: FILTER_COLOR_BY_ID.locations,
	},
	{ id: "sessions", label: "Sessions", color: FILTER_COLOR_BY_ID.sessions },
	{ id: "scenes", label: "Scenes", color: FILTER_COLOR_BY_ID.scenes },
	{
		id: "unresolved",
		label: "Unknown mention",
		color: FILTER_COLOR_BY_ID.unresolved,
	},
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

function truncateLabel(value, maxLength = 18) {
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
		return Math.min(3.4, 1.35 + edge.count * 0.22);
	if (edge.relation === "related")
		return Math.min(2.8, 1.2 + edge.count * 0.18);
	return 1.35;
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
				onOpen && "is_clickable",
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

function pushMapValue(map, key, value) {
	const current = map.get(key) || [];
	current.push(value);
	map.set(key, current);
}

function getLayoutSortIndex(type) {
	const order = [
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
	const index = order.indexOf(type);
	return index === -1 ? order.length : index;
}

function sortLayoutNodes(left, right) {
	const typeDiff =
		getLayoutSortIndex(left.type) - getLayoutSortIndex(right.type);
	if (typeDiff !== 0) return typeDiff;

	const leftFileName = String(left.meta?.fileName || "");
	const rightFileName = String(right.meta?.fileName || "");
	if (leftFileName !== rightFileName) {
		return leftFileName.localeCompare(rightFileName, "uk");
	}

	const leftSceneNumber = Number(left.meta?.sceneNumber || 0);
	const rightSceneNumber = Number(right.meta?.sceneNumber || 0);
	if (leftSceneNumber !== rightSceneNumber) {
		return leftSceneNumber - rightSceneNumber;
	}

	return String(left.label || "").localeCompare(String(right.label || ""), "uk");
}

function getLayoutGroupId(node, visibleNodeIds) {
	if (!node || node.type === "campaign") return null;
	if (node.type === "campaign-note") return "notes";
	if (node.type === "character") return "characters";
	if (node.type === "npc") return "npc";
	if (node.type === "location") return "locations";
	if (node.type === "session") return "sessions";
	if (node.type === "unresolved") return "unresolved";
	if (node.type === "scene") {
		return visibleNodeIds.has(node.meta?.parentId) ? "sessions" : "scenes";
	}
	if (node.type === "session-note" || node.type === "scene-note") {
		return visibleNodeIds.has(node.meta?.parentId) ? "sessions" : "notes";
	}
	return getFilterIdForType(node.type);
}

function getLayoutParentId(node, visibleNodeIds) {
	const parentId = node?.meta?.parentId;
	if (!parentId || !visibleNodeIds.has(parentId)) return null;
	if (["scene", "session-note", "scene-note"].includes(node.type)) {
		return parentId;
	}
	return null;
}

function getOrbitCapacity(radiusX, radiusY, minSpacing) {
	const averageRadius = Math.sqrt((radiusX * radiusX + radiusY * radiusY) / 2);
	return Math.max(1, Math.floor((Math.PI * 2 * averageRadius) / minSpacing));
}

function placeOrbitItems(items, center, positions, options = {}) {
	const {
		radiusX = 58,
		radiusY = radiusX,
		ringGapX = 42,
		ringGapY = ringGapX,
		minSpacing = 42,
		angleOffset = 0,
	} = options;
	const sortedItems = [...items].sort(sortLayoutNodes);
	let cursor = 0;
	let ringIndex = 0;

	while (cursor < sortedItems.length) {
		const currentRadiusX = radiusX + ringGapX * ringIndex;
		const currentRadiusY = radiusY + ringGapY * ringIndex;
		const capacity = getOrbitCapacity(
			currentRadiusX,
			currentRadiusY,
			minSpacing,
		);
		const ringItems = sortedItems.slice(cursor, cursor + capacity);
		const step = (Math.PI * 2) / Math.max(1, ringItems.length);
		const ringOffset = angleOffset + ringIndex * 0.37;

		ringItems.forEach((node, index) => {
			const angle = ringOffset + step * index;
			positions.set(node.id, {
				x: center.x + Math.cos(angle) * currentRadiusX,
				y: center.y + Math.sin(angle) * currentRadiusY,
			});
		});

		cursor += ringItems.length;
		ringIndex += 1;
	}
}

function getChildOrbitOptions(parentNode, childCount, angleOffset) {
	const countBoost = Math.min(38, Math.sqrt(Math.max(1, childCount)) * 8);
	if (parentNode.type === "session") {
		return {
			radiusX: 120 + countBoost,
			radiusY: 88 + countBoost,
			ringGapX: 86,
			ringGapY: 66,
			minSpacing: 90,
			angleOffset,
		};
	}
	if (parentNode.type === "scene") {
		return {
			radiusX: 88 + countBoost,
			radiusY: 66 + countBoost,
			ringGapX: 66,
			ringGapY: 52,
			minSpacing: 76,
			angleOffset: angleOffset + 0.24,
		};
	}
	return {
		radiusX: 104 + countBoost,
		radiusY: 78 + countBoost,
		ringGapX: 76,
		ringGapY: 58,
		minSpacing: 82,
		angleOffset,
	};
}

function placeChildOrbits(parentNode, childrenByParent, positions, depth = 0) {
	const children = childrenByParent.get(parentNode.id) || [];
	const parentPosition = positions.get(parentNode.id);
	if (children.length === 0 || !parentPosition) return;

	const outwardAngle =
		Math.atan2(
			parentPosition.y - GRAPH_CENTER_Y,
			parentPosition.x - GRAPH_CENTER_X,
		) +
		depth * 0.18;

	placeOrbitItems(
		children,
		parentPosition,
		positions,
		getChildOrbitOptions(parentNode, children.length, outwardAngle),
	);

	children.forEach((childNode) => {
		placeChildOrbits(childNode, childrenByParent, positions, depth + 1);
	});
}

function getFitScale(points) {
	const paddingX = 54;
	const paddingY = 44;
	let scale = 1;

	points.forEach((position) => {
		if (position.x < GRAPH_CENTER_X) {
			const distance = GRAPH_CENTER_X - position.x;
			if (distance > 0) {
				scale = Math.min(scale, (GRAPH_CENTER_X - paddingX) / distance);
			}
		} else if (position.x > GRAPH_CENTER_X) {
			const distance = position.x - GRAPH_CENTER_X;
			if (distance > 0) {
				scale = Math.min(
					scale,
					(GRAPH_WIDTH - paddingX - GRAPH_CENTER_X) / distance,
				);
			}
		}

		if (position.y < GRAPH_CENTER_Y) {
			const distance = GRAPH_CENTER_Y - position.y;
			if (distance > 0) {
				scale = Math.min(scale, (GRAPH_CENTER_Y - paddingY) / distance);
			}
		} else if (position.y > GRAPH_CENTER_Y) {
			const distance = position.y - GRAPH_CENTER_Y;
			if (distance > 0) {
				scale = Math.min(
					scale,
					(GRAPH_HEIGHT - paddingY - GRAPH_CENTER_Y) / distance,
				);
			}
		}
	});

	return Number.isFinite(scale) ? Math.max(0.42, Math.min(1, scale)) : 1;
}

function fitStructuredLayout(positions, groupGuides) {
	const points = [
		...positions.values(),
		...groupGuides.map((group) => ({ x: group.x, y: group.y })),
	];
	const scale = getFitScale(points);
	const scalePosition = (position) =>
		clampGraphPosition({
			x: GRAPH_CENTER_X + (position.x - GRAPH_CENTER_X) * scale,
			y: GRAPH_CENTER_Y + (position.y - GRAPH_CENTER_Y) * scale,
		});

	return {
		nodePositions: Object.fromEntries(
			[...positions.entries()].map(([nodeId, position]) => [
				nodeId,
				scalePosition(position),
			]),
		),
		groupGuides: groupGuides.map((group) => {
			const position = scalePosition(group);
			return {
				...group,
				x: position.x,
				y: position.y,
			};
		}),
	};
}

function computeLayout(nodes) {
	if (nodes.length === 0) {
		return { nodePositions: {}, groupGuides: [] };
	}

	const visibleNodeIds = new Set(nodes.map((node) => node.id));
	const positions = new Map();
	const childrenByParent = new Map();
	const rootNodesByGroup = new Map();
	const nodeIdsByGroup = new Map();
	const campaignNode = nodes.find((node) => node.type === "campaign") || nodes[0];

	if (campaignNode) {
		positions.set(campaignNode.id, {
			x: GRAPH_CENTER_X,
			y: GRAPH_CENTER_Y,
		});
	}

	nodes.forEach((node) => {
		if (node.type === "campaign") return;

		const groupId = getLayoutGroupId(node, visibleNodeIds);
		if (!groupId) return;
		pushMapValue(nodeIdsByGroup, groupId, node.id);

		const parentId = getLayoutParentId(node, visibleNodeIds);
		if (parentId) {
			pushMapValue(childrenByParent, parentId, node);
			return;
		}

		pushMapValue(rootNodesByGroup, groupId, node);
	});

	const activeGroups = LAYOUT_GROUPS.filter(
		(group) => (nodeIdsByGroup.get(group.id) || []).length > 0,
	);
	const groupGuides = activeGroups.map((group, index) => {
		const angle = -Math.PI / 2 + (index / activeGroups.length) * Math.PI * 2;
		const orbitX = activeGroups.length <= 3 ? 430 : 520;
		const orbitY = activeGroups.length <= 3 ? 270 : 320;

		return {
			...group,
			angle,
			nodeIds: nodeIdsByGroup.get(group.id) || [],
			x: GRAPH_CENTER_X + Math.cos(angle) * orbitX,
			y: GRAPH_CENTER_Y + Math.sin(angle) * orbitY,
		};
	});

	groupGuides.forEach((group) => {
		const rootNodes = rootNodesByGroup.get(group.id) || [];
		placeOrbitItems(rootNodes, group, positions, {
			radiusX: 124,
			radiusY: 94,
			ringGapX: 94,
			ringGapY: 72,
			minSpacing: 96,
			angleOffset: group.angle,
		});
		rootNodes.forEach((node) => {
			placeChildOrbits(node, childrenByParent, positions);
		});
	});

	return fitStructuredLayout(positions, groupGuides);
}

function getDisplayGroupGuides(groupGuides, displayLayout) {
	return groupGuides.map((group) => {
		const radius = group.nodeIds.reduce((maxDistance, nodeId) => {
			const position = displayLayout[nodeId];
			if (!position) return maxDistance;
			const dx = position.x - group.x;
			const dy = position.y - group.y;
			const distance = Math.sqrt(dx * dx + dy * dy) + 38;
			return Math.max(maxDistance, distance);
		}, 38);

		return {
			...group,
			radius,
			count: group.nodeIds.length,
		};
	});
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

function isCampaignContainEdge(edge, nodeById) {
	if (edge.relation !== "contains") return false;
	const sourceNode = nodeById.get(edge.source);
	const targetNode = nodeById.get(edge.target);
	return sourceNode?.type === "campaign" || targetNode?.type === "campaign";
}

function getDescendantIds(nodeId, childIdsByParent) {
	const result = [];
	const queue = [...(childIdsByParent.get(nodeId) || [])];
	while (queue.length > 0) {
		const childId = queue.shift();
		result.push(childId);
		queue.push(...(childIdsByParent.get(childId) || []));
	}
	return result;
}

function getOffsetPosition(basePosition, offset = { x: 0, y: 0 }) {
	return {
		x: basePosition.x + offset.x,
		y: basePosition.y + offset.y,
	};
}

function constrainMovedNodesToGroupCollisions({
	basePositions,
	offsets,
	groupNodeIds,
	nodeById,
	movedNodeIds,
}) {
	const nextOffsets = { ...offsets };
	const movedNodeIdSet = new Set(movedNodeIds);
	const staticNodeIds = groupNodeIds.filter((nodeId) => !movedNodeIdSet.has(nodeId));

	for (let iteration = 0; iteration < 8; iteration += 1) {
		let moved = false;

		movedNodeIds.forEach((movedNodeId, movedIndex) => {
			const movedBasePosition = basePositions[movedNodeId];
			if (!movedBasePosition) return;

			let movedPosition = getOffsetPosition(
				movedBasePosition,
				nextOffsets[movedNodeId],
			);
			const movedRadius = getNodeRadius(nodeById.get(movedNodeId) || {});

			staticNodeIds.forEach((staticNodeId, staticIndex) => {
				const staticBasePosition = basePositions[staticNodeId];
				if (!staticBasePosition) return;

				const staticPosition = getOffsetPosition(
					staticBasePosition,
					nextOffsets[staticNodeId],
				);
				const staticRadius = getNodeRadius(nodeById.get(staticNodeId) || {});
				let dx = movedPosition.x - staticPosition.x;
				let dy = movedPosition.y - staticPosition.y;
				let distance = Math.sqrt(dx * dx + dy * dy);
				if (distance < 0.01) {
					const angle =
						((movedIndex + staticIndex + iteration + 1) * 2.399963) %
						(Math.PI * 2);
					dx = Math.cos(angle);
					dy = Math.sin(angle);
					distance = 1;
				}

				const minDistance = movedRadius + staticRadius + 56;
				if (distance >= minDistance) return;

				const overlap = minDistance - distance;
				const pushX = (dx / distance) * overlap;
				const pushY = (dy / distance) * overlap;
				movedPosition = clampGraphPosition({
					x: movedPosition.x + pushX,
					y: movedPosition.y + pushY,
				});
				nextOffsets[movedNodeId] = {
					x: movedPosition.x - movedBasePosition.x,
					y: movedPosition.y - movedBasePosition.y,
				};
				moved = true;
			});
		});

		if (!moved) break;
	}

	return nextOffsets;
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
		() => computeLayout(visibleGraph.nodes),
		[visibleGraph.nodes],
	);
	const displayLayout = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(layout.nodePositions).map(([nodeId, position]) => {
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
	const displayGroups = useMemo(
		() => getDisplayGroupGuides(layout.groupGuides, displayLayout),
		[displayLayout, layout.groupGuides],
	);
	const childIdsByParent = useMemo(() => {
		const next = new Map();
		visibleGraph.nodes.forEach((node) => {
			const parentId = node.meta?.parentId;
			if (!parentId || !visibleGraph.nodeById.has(parentId)) return;
			pushMapValue(next, parentId, node.id);
		});
		return next;
	}, [visibleGraph.nodeById, visibleGraph.nodes]);
	const groupIdsByNodeId = useMemo(() => {
		const next = new Map();
		displayGroups.forEach((group) => {
			group.nodeIds.forEach((nodeId) => {
				next.set(nodeId, group.id);
			});
		});
		return next;
	}, [displayGroups]);
	const groupNodeIdsById = useMemo(
		() => new Map(displayGroups.map((group) => [group.id, group.nodeIds])),
		[displayGroups],
	);
	const focusedNodeId = hoveredNodeId || selectedNodeId;
	const connectedIds = useMemo(
		() => getConnectedIds(visibleGraph.edges, focusedNodeId),
		[focusedNodeId, visibleGraph.edges],
	);
	const isCampaignFocused =
		focusedNodeId &&
		visibleGraph.nodeById.get(focusedNodeId)?.type === "campaign";
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
					entityConfig.type === "locations" ? "EntityLinkModal__location" : "",
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
		if (node.type === "campaign") return;
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
			childIds: getDescendantIds(node.id, childIdsByParent),
			groupId: groupIdsByNodeId.get(node.id),
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

				start.childIds.forEach((nodeId) => {
					const childStartOffset = start.startOffsets[nodeId] || {
						x: 0,
						y: 0,
					};
					next[nodeId] = {
						x: childStartOffset.x + dx,
						y: childStartOffset.y + dy,
					};
				});

				const movedNodeIds = [start.nodeId, ...start.childIds];
				const groupNodeIds = groupNodeIdsById.get(start.groupId) || [];
				if (groupNodeIds.length <= 1) return next;

				return constrainMovedNodesToGroupCollisions({
					basePositions: layout.nodePositions,
					offsets: next,
					groupNodeIds,
					nodeById: visibleGraph.nodeById,
					movedNodeIds,
				});
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
				<span className={`CampaignNotesGraph__dot is_${otherNode.type}`} />
				<span className="CampaignNotesGraph__connectionText">
					<strong>{renderMentionText(otherNode.label)}</strong>
					<span>{renderMentionText(connectionMetaText)}</span>
				</span>
			</button>
		);
	};

	const isGroupFocused = (group) =>
		!focusedNodeId ||
		isCampaignFocused ||
		group.nodeIds.some((nodeId) => connectedIds.has(nodeId));

	const renderGroupEdge = (group) => {
		const isFocused = isGroupFocused(group);

		return (
			<line
				key={`group-edge:${group.id}`}
				className={classNames(
					"CampaignNotesGraph__groupEdge",
					!isFocused && "is_muted",
				)}
				x1={GRAPH_CENTER_X}
				y1={GRAPH_CENTER_Y}
				x2={group.x}
				y2={group.y}
				style={{ "--graph-group-color": group.color }}
				vectorEffect="non-scaling-stroke"
			/>
		);
	};

	const renderGroupGuide = (group) => {
		const label = `${lang.t(group.label)} ${group.count}`;

		return (
			<g
				key={`group:${group.id}`}
				className={classNames(
					"CampaignNotesGraph__group",
					`is_${group.id}`,
					!isGroupFocused(group) && "is_muted",
				)}
				transform={`translate(${group.x} ${group.y})`}
				style={{ "--graph-group-color": group.color }}
			>
				<title>{label}</title>
				<circle className="CampaignNotesGraph__groupOrbit" r={group.radius} />
			</g>
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
					`is_${edge.relation}`,
					!isFocused && "is_muted",
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
		(edge) =>
			edge.relation === "contains" &&
			!isCampaignContainEdge(edge, visibleGraph.nodeById),
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
				draggingNodeId && "is_dragging_node",
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
						<div className="CampaignNotesGraph__message CampaignNotesGraph__message__error">
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
								{displayGroups.map(renderGroupEdge)}
								{structuralEdges.map(renderEdge)}
								{relationEdges.map(renderEdge)}
							</g>
							<g className="CampaignNotesGraph__groups">
								{displayGroups.map(renderGroupGuide)}
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
												`is_${node.type}`,
												isSelected && "is_selected",
												draggingNodeId === node.id && "is_dragging",
												!isFocused && "is_muted",
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
								className={`CampaignNotesGraph__dot is_${selectedNode.type}`}
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
									<span className={`CampaignNotesGraph__dot is_${type}`} />
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
