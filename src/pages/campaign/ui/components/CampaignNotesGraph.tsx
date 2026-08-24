import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactElement,
} from "react";
import {
	useNodesState,
	type ReactFlowInstance,
} from "@xyflow/react";

import { useSimplifiedNotesEnabled } from "../../../../features/notes/ui/index.js";
import {
	EntityModal,
	type EntityModalProps,
} from "../../../../features/entity-link/index.js";
import {
	buildCampaignGraph,
	normalizeGraphName,
} from "../../graph.js";
import {
	DEFAULT_CAMPAIGN_GRAPH_FILTERS,
	canOpenCampaignGraphNode,
	executeCampaignGraphOpenTarget,
	formatCampaignGraphSourceList,
	getCampaignGraphConnectionPresentation,
	getCampaignGraphNodeTopologyKey,
	getCampaignGraphNoteSaveRequest,
	getCampaignGraphOpenTarget,
	getCampaignGraphRelationLabel,
	getCampaignGraphTypeCounts,
	getVisibleCampaignGraph,
	type CampaignGraphEnabledFilters,
	type CampaignGraphFilterId,
} from "../../model/campaignGraphPresentation.ts";
import type {
	CampaignGraphEdge,
	CampaignGraphNode,
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
import { CampaignGraphConnection } from "./CampaignGraphConnection.tsx";
import { CampaignGraphDetails } from "./CampaignGraphDetails.tsx";
import { CampaignGraphNoteModal } from "./CampaignGraphNoteModal.tsx";
import { CampaignGraphToolbar } from "./CampaignGraphToolbar.tsx";
import {
	executeCampaignGraphConnectionAction,
} from "./campaignGraphControllerHelpers.ts";
import { useCampaignGraphLayout } from "./useCampaignGraphLayout.ts";
import { useCampaignGraphFlowEdges } from "./useCampaignGraphFlowEdges.ts";
import { useCampaignGraphFlowInteractions } from "./useCampaignGraphFlowInteractions.ts";
import { useCampaignGraphFlowNodeProjection } from "./useCampaignGraphFlowNodeProjection.ts";
import { useCampaignGraphSelection } from "./useCampaignGraphSelection.ts";
import { useCampaignGraphViewport } from "./useCampaignGraphViewport.ts";
import "@xyflow/react/dist/style.css";
import "../../../../assets/components/CampaignNotesGraph.css";

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

const FILTER_COLOR_BY_ID: Readonly<Record<CampaignGraphFilterId, string>> = {
	notes: NODE_COLOR_BY_TYPE["campaign-note"],
	characters: NODE_COLOR_BY_TYPE.character,
	npc: NODE_COLOR_BY_TYPE.npc,
	locations: NODE_COLOR_BY_TYPE.location,
	sessions: NODE_COLOR_BY_TYPE.session,
	scenes: NODE_COLOR_BY_TYPE.scene,
	unresolved: NODE_COLOR_BY_TYPE.unresolved,
};

type CampaignGraphEntityModalState = NonNullable<EntityModalProps["modalState"]>;

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

const NODE_TYPES = { campaignGraphNode: CampaignGraphNodeCard };

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
	const [entityModalState, setEntityModalState] =
		useState<CampaignGraphEntityModalState | null>(null);
	const [flowInstance, setFlowInstance] =
		useState<ReactFlowInstance<CampaignFlowNode, CampaignFlowEdge> | null>(null);
	const [flowNodes, setFlowNodes, onFlowNodesChange] =
		useNodesState<CampaignFlowNode>([]);
	const hasManualPositionsRef = useRef(false);
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
	const {
		selectedNodeId,
		setSelectedNodeId,
		setHoveredNodeId,
		focusedNodeId,
		connectedIds,
		selectedNode,
		selectedEdges,
	} = useCampaignGraphSelection({
		campaignSlug: campaign.slug,
		visibleGraph,
		hasManualPositionsRef,
	});

	const openGraphNote = useCallback(
		(node: CampaignGraphNode, note: SharedNote) => {
			if (typeof onSaveNote !== "function") return;
			openModal({
				title: lang.t("Note"),
				type: "note",
				showFooter: false,
				children: (
					<CampaignGraphNoteModal
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

	useCampaignGraphFlowNodeProjection({
		campaignSlug: campaign.slug,
		graphNodes: graph.nodes,
		layoutPositions,
		selectedNodeId,
		focusedNodeId,
		connectedIds,
		visibleNodeIds: visibleGraph.visibleNodeIds,
		canSaveNote: typeof onSaveNote === "function",
		colors: NODE_COLOR_BY_TYPE,
		typeLabels: TYPE_LABELS,
		onOpen: openNode,
		setFlowNodes,
		hasManualPositionsRef,
	});

	const { requestFilterRelayout, handleRelayout } = useCampaignGraphViewport({
		campaignSlug: campaign.slug,
		flowInstance,
		setFlowNodes,
		visibleNodes: visibleGraph.nodes,
		visibleEdges: visibleGraph.edges,
		flowNodeCount: flowNodes.length,
		graphNodeCount: graph.nodes.length,
		flowNodeTopologyKey,
		nodeTopologyKey,
		hasManualPositionsRef,
	});

	const flowEdges = useCampaignGraphFlowEdges({
		flowNodes,
		edges: graph.edges,
		visibleEdgeIds: visibleGraph.visibleEdgeIds,
		focusedNodeId,
	});

	const { handleNodeDragStop, handleFlowNodesChange } =
		useCampaignGraphFlowInteractions({
			setFlowNodes,
			setSelectedNodeId,
			onFlowNodesChange,
			hasManualPositionsRef,
		});

	const toggleFilter = (filterId: CampaignGraphFilterId) => {
		requestFilterRelayout();
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
			<CampaignGraphConnection
				key={edge.id}
				presentation={presentation}
				onActivate={() => executeCampaignGraphConnectionAction(
					presentation.action,
					onOpenSession,
					setSelectedNodeId,
				)}
			/>
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
					filterColors={FILTER_COLOR_BY_ID}
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
				typeLabels={TYPE_LABELS}
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
