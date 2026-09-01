import {
	$isElementNode,
	$isRangeSelection,
	$isTextNode,
	type BaseSelection,
	type LexicalNode,
} from "lexical";

export const MENTION_BOUNDARY = "\u200B";

export type IsMentionNode = (
	node: LexicalNode | null | undefined,
) => node is LexicalNode;

interface MentionSelectionAnchor {
	node: LexicalNode;
	offset: number;
}

interface MentionCandidateResolution {
	handled: boolean;
	candidate: LexicalNode | null;
}

type MentionCandidateResolver = (
	node: LexicalNode,
	offset: number,
	isMentionNode: IsMentionNode,
) => MentionCandidateResolution;

const UNHANDLED_MENTION_CANDIDATE: MentionCandidateResolution = {
	handled: false,
	candidate: null,
};

export function isMentionBoundaryPosition(
	text: string,
	offset: number,
): boolean {
	return text.startsWith(MENTION_BOUNDARY) && offset <= MENTION_BOUNDARY.length;
}

function getCollapsedSelectionAnchor(
	selection: BaseSelection | null,
): MentionSelectionAnchor | null {
	if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
	return {
		node: selection.anchor.getNode(),
		offset: selection.anchor.offset,
	};
}

const resolveMentionAnchorCandidate: MentionCandidateResolver = (
	node,
	offset,
	isMentionNode,
) => {
	if (!isMentionNode(node)) return UNHANDLED_MENTION_CANDIDATE;
	return {
		handled: true,
		candidate: offset >= node.getTextContentSize() ? node : null,
	};
};

const resolveTextAnchorCandidate: MentionCandidateResolver = (
	node,
	offset,
) => {
	if (!$isTextNode(node)) return UNHANDLED_MENTION_CANDIDATE;
	const canUsePreviousSibling =
		offset === 0 || isMentionBoundaryPosition(node.getTextContent(), offset);
	return {
		handled: true,
		candidate: canUsePreviousSibling ? node.getPreviousSibling() : null,
	};
};

const resolveElementAnchorCandidate: MentionCandidateResolver = (
	node,
	offset,
) => {
	if (!$isElementNode(node)) return UNHANDLED_MENTION_CANDIDATE;
	return {
		handled: true,
		candidate: offset > 0 ? node.getChildAtIndex(offset - 1) : null,
	};
};

const MENTION_CANDIDATE_RESOLVERS: readonly MentionCandidateResolver[] = [
	resolveMentionAnchorCandidate,
	resolveTextAnchorCandidate,
	resolveElementAnchorCandidate,
];

export function getMentionBeforeCollapsedSelection(
	selection: BaseSelection | null,
	isMentionNode: IsMentionNode,
): LexicalNode | null {
	const anchor = getCollapsedSelectionAnchor(selection);
	if (!anchor) return null;
	const resolution = MENTION_CANDIDATE_RESOLVERS.map((resolveCandidate) =>
		resolveCandidate(anchor.node, anchor.offset, isMentionNode),
	).find((candidate) => candidate.handled);
	return isMentionNode(resolution?.candidate) ? resolution.candidate : null;
}
