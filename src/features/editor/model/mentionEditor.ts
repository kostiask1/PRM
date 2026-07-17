import {
	$createTextNode,
	$getSelection,
	$isElementNode,
	$isRangeSelection,
	$isTextNode,
	type BaseSelection,
	type LexicalNode,
	type TextNode,
} from "lexical";

export const MENTION_BOUNDARY = "\u200B";

export interface MentionKeyboardEvent {
	key: string;
	code: string;
	preventDefault: () => void;
}

export type IsMentionNode = (
	node: LexicalNode | null | undefined,
) => node is LexicalNode;

export function createMentionBoundaryNode(text = ""): TextNode {
	return $createTextNode(`${MENTION_BOUNDARY}${text}`);
}

function getMentionBeforeCollapsedSelection(
	selection: BaseSelection | null,
	isMentionNode: IsMentionNode,
): LexicalNode | null {
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

export function handleSpaceAfterMention(
	event: MentionKeyboardEvent,
	isMentionNode: IsMentionNode,
): boolean {
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
