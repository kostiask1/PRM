import {
	$getRoot,
	$isElementNode,
	type LexicalNode,
	type TextNode,
} from "lexical";

const PRIVATE_USE_START = 0xe000;
const PRIVATE_USE_END = 0xf8ff;

export interface HistoryCaretSelectionOptions {
	isMentionNode: (node: LexicalNode | null | undefined) => boolean;
	loadValue: (value: string) => void;
	normalizedValue: string;
	offset: number;
	readValue: () => string;
	sourceValue: string;
}

function getUnusedHistoryCaretMarker(value: string): string | null {
	for (let code = PRIVATE_USE_START; code <= PRIVATE_USE_END; code += 1) {
		const marker = String.fromCharCode(code);
		if (!value.includes(marker)) return marker;
	}
	return null;
}

function selectHistoryCaretMarker(
	node: TextNode,
	marker: string,
	isMentionNode: HistoryCaretSelectionOptions["isMentionNode"],
): boolean {
	const text = node.getTextContent();
	const markerOffset = text.indexOf(marker);
	if (markerOffset < 0) return false;

	const parent = node.getParent();
	const nodeIndex = node.getIndexWithinParent();
	const nextText = `${text.slice(0, markerOffset)}${text.slice(
		markerOffset + marker.length,
	)}`;
	node.setTextContent(nextText);

	if (isMentionNode(node)) {
		if ($isElementNode(parent)) {
			const offset = markerOffset <= 0 ? nodeIndex : nodeIndex + 1;
			parent.select(offset, offset);
		} else {
			node.select(markerOffset, markerOffset);
		}
		return true;
	}

	if (nextText) {
		node.select(markerOffset, markerOffset);
		return true;
	}

	if ($isElementNode(parent)) {
		node.remove();
		parent.select(nodeIndex, nodeIndex);
		return true;
	}

	node.select(0, 0);
	return true;
}

export function applyHistoryCaretSourceOffset({
	isMentionNode,
	loadValue,
	normalizedValue,
	offset,
	readValue,
	sourceValue,
}: HistoryCaretSelectionOptions): boolean {
	const marker = getUnusedHistoryCaretMarker(sourceValue);
	if (!marker) return false;
	const clampedOffset = Math.min(Math.max(0, offset), sourceValue.length);
	loadValue(
		`${sourceValue.slice(0, clampedOffset)}${marker}${sourceValue.slice(
			clampedOffset,
		)}`,
	);

	const markerNode = $getRoot()
		.getAllTextNodes()
		.find((node) => node.getTextContent().includes(marker));
	const selected = markerNode
		? selectHistoryCaretMarker(markerNode, marker, isMentionNode)
		: false;
	if (selected && readValue() === normalizedValue) return true;

	loadValue(normalizedValue);
	return false;
}
