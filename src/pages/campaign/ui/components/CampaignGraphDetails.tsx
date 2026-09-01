import React, { type ReactElement, type ReactNode, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

import { renderMentionText } from "../../../../features/entity-link/index.js";
import { lang } from "../../../../shared/lib/index.js";
import { Button, Icon } from "../../../../shared/ui/index.js";
import type {
	CampaignGraphEdge,
	CampaignGraphNode,
	CampaignGraphResult,
} from "../../graph.js";
import {
	getCampaignGraphDetailTextPresentation,
	getCampaignGraphNodeTypeClass,
	getCampaignGraphSessionDisplayName,
	shouldActivateCampaignGraphDetailText,
} from "../../model/campaignGraphPresentation.ts";

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

interface CampaignGraphSelectedDetailsProps {
	node: CampaignGraphNode;
	edges: CampaignGraphEdge[];
	detailText: unknown;
	hideTitle: boolean;
	canOpen: boolean;
	onOpen: () => void;
	renderConnection: (edge: CampaignGraphEdge) => ReactNode;
	typeLabels: Readonly<Record<string, string>>;
}

function CampaignGraphSelectedDetails({
	node,
	edges,
	detailText,
	hideTitle,
	canOpen,
	onOpen,
	renderConnection,
	typeLabels,
}: CampaignGraphSelectedDetailsProps) {
	return (
		<>
			<CampaignGraphSelectedHeader
				node={node}
				hideTitle={hideTitle}
				canOpen={canOpen}
				onOpen={onOpen}
				typeLabels={typeLabels}
			/>
			<ParsedGraphText text={detailText} onOpen={canOpen ? onOpen : undefined} />
			<CampaignGraphSelectedStats node={node} edgeCount={edges.length} />
			<CampaignGraphSelectedConnections edges={edges} renderConnection={renderConnection} />
		</>
	);
}

function CampaignGraphSelectedHeader({
	node,
	hideTitle,
	canOpen,
	onOpen,
	typeLabels,
}: Pick<CampaignGraphSelectedDetailsProps, "node" | "hideTitle" | "canOpen" | "onOpen"> & {
	typeLabels: Readonly<Record<string, string>>;
}) {
	return (
		<div className="CampaignNotesGraph__detailHeader">
			<div>
				<div className="CampaignNotesGraph__type">
					<span className={`CampaignNotesGraph__dot ${getCampaignGraphNodeTypeClass(node.type)}`} />
					{lang.t(typeLabels[node.type] || node.type)}
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
	typeLabels: Readonly<Record<string, string>>;
}

function CampaignGraphOverview({
	visibleNodeCount,
	visibleEdgeCount,
	unresolvedCount,
	visibleNodes,
	typeLabels,
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
						{lang.t(typeLabels[type] || type)}
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
	typeLabels: Readonly<Record<string, string>>;
	visibleNodes: CampaignGraphNode[];
	visibleEdgeCount: number;
	visibleNodeCount: number;
}

export function CampaignGraphDetails({
	selectedNode,
	selectedEdges,
	selectedCanOpen,
	onOpenSelected,
	renderConnection,
	graph,
	typeLabels,
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
					typeLabels={typeLabels}
				/>
			) : (
				<CampaignGraphOverview
					visibleNodeCount={visibleNodeCount}
					visibleEdgeCount={visibleEdgeCount}
					unresolvedCount={graph.stats.unresolved}
					visibleNodes={visibleNodes}
					typeLabels={typeLabels}
				/>
			)}
		</aside>
	);
}
