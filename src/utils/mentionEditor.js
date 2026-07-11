import {
	$createTextNode,
	$getSelection,
	$isElementNode,
	$isRangeSelection,
	$isTextNode,
} from "lexical";

export const MENTION_BOUNDARY = "\u200B";

export function createMentionBoundaryNode(text = "") {
	return $createTextNode(`${MENTION_BOUNDARY}${text}`);
}

function getMentionBeforeCollapsedSelection(selection, isMentionNode) {
	if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;

	const anchorNode = selection.anchor.getNode();
	const offset = selection.anchor.offset;
	if (isMentionNode(anchorNode)) {
		return offset >= anchorNode.getTextContentSize() ? anchorNode : null;
	}

	if ($isTextNode(anchorNode)) {
		const previousSibling = anchorNode.getPreviousSibling();
		const isAtMentionBoundary =
			anchorNode.getTextContent().startsWith(MENTION_BOUNDARY) &&
			offset <= MENTION_BOUNDARY.length;
		if (offset === 0 || isAtMentionBoundary) {
			return isMentionNode(previousSibling) ? previousSibling : null;
		}
	}

	if ($isElementNode(anchorNode) && offset > 0) {
		const previousChild = anchorNode.getChildAtIndex(offset - 1);
		return isMentionNode(previousChild) ? previousChild : null;
	}

	return null;
}

export function handleSpaceAfterMention(event, isMentionNode) {
	if (event.key !== " " && event.code !== "Space") return false;

	const selection = $getSelection();
	const mentionNode = getMentionBeforeCollapsedSelection(
		selection,
		isMentionNode,
	);
	if (!mentionNode) return false;

	const nextSibling = mentionNode.getNextSibling();
	if ($isTextNode(nextSibling)) {
		const nextText = nextSibling.getTextContent();
		const tail = nextText.startsWith(MENTION_BOUNDARY)
			? nextText.slice(MENTION_BOUNDARY.length)
			: nextText;
		nextSibling.setTextContent(
			`${MENTION_BOUNDARY} ${MENTION_BOUNDARY}${tail}`,
		);
		nextSibling.select(2, 2);
	} else {
		const spaceNode = createMentionBoundaryNode(` ${MENTION_BOUNDARY}`);
		mentionNode.insertAfter(spaceNode);
		spaceNode.select(2, 2);
	}

	event.preventDefault();
	return true;
}
