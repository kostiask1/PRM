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
	altKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
	preventDefault: () => void;
}

function getEditableMentionAtCursor(isMentionNode: IsMentionNode) {
	const mentionNode = getMentionBeforeCollapsedSelection(
		$getSelection(),
		isMentionNode,
	);
	return $isTextNode(mentionNode) ? mentionNode : null;
}

export function handleTextAfterMention(
	event: MentionKeyboardEvent,
	isMentionNode: IsMentionNode,
): boolean {
	if (
		event.key.length !== 1 ||
		event.key === " " ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey
	) {
		return false;
	}

	const mentionNode = getEditableMentionAtCursor(isMentionNode);
	if (!mentionNode) return false;

	const nextText = `${mentionNode.getTextContent()}${event.key}`;
	mentionNode.setTextContent(nextText);
	mentionNode.select(nextText.length, nextText.length);
	event.preventDefault();
	return true;
}

export function createMentionBoundaryNode(text = ""): TextNode {
	return $createTextNode(`${MENTION_BOUNDARY}${text}`);
}

export function handleSpaceAfterMention(
	event: MentionKeyboardEvent,
	isMentionNode: IsMentionNode,
): boolean {
	if (event.key !== " " && event.code !== "Space") return false;

	const mentionNode = getEditableMentionAtCursor(isMentionNode);
	if (!mentionNode) return false;

	const mentionText = mentionNode.getTextContent();
	if (!mentionText.endsWith(" ")) {
		const nextText = `${mentionText} `;
		mentionNode.setTextContent(nextText);
		mentionNode.select(nextText.length, nextText.length);
		event.preventDefault();
		return true;
	}

	const trimmedMentionText = mentionText.trimEnd();
	mentionNode.setTextContent(trimmedMentionText);

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
