import {
	$createTextNode,
	$getSelection,
	$isTextNode,
	type TextNode,
} from "lexical";
import {
	getMentionBeforeCollapsedSelection,
	MENTION_BOUNDARY,
	type IsMentionNode,
} from "./mentionSelectionPolicy.ts";

export { MENTION_BOUNDARY } from "./mentionSelectionPolicy.ts";

export interface MentionKeyboardEvent {
	key: string;
	code: string;
	preventDefault: () => void;
}

export function createMentionBoundaryNode(text = ""): TextNode {
	return $createTextNode(`${MENTION_BOUNDARY}${text}`);
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
