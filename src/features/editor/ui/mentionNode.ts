import type { TextMatchTransformer } from "@lexical/markdown";
import { $applyNodeReplacement, TextNode, type EditorConfig, type LexicalNode, type SerializedTextNode } from "lexical";
import { decodeEntityMentionLabel, formatEntityMention, lang } from "../../../shared/lib/index.js";
import { createMentionBoundaryNode } from "../model/mentionEditor.ts";
import { normalizeEditableText } from "./editorPresentation.ts";

const MENTION_CLASS = "EntityLink EditableField__mention";
export const MENTION_TOOLTIP_KEY = "Ctrl+click to open entity";

function setMentionDomAttributes(
	element: HTMLElement,
	mentionName: string,
) {
	element.dataset.mention = mentionName;
	element.setAttribute("data-mention-tooltip", lang.t(MENTION_TOOLTIP_KEY));
}

export class MentionNode extends TextNode {
	__mentionName: string;

	constructor(text: string, key?: string, mentionName?: string) {
		super(text, key);
		this.__mentionName = mentionName || text;
	}
	static getType() {
		return "mention";
	}

	static clone(node: MentionNode): MentionNode {
		return new MentionNode(node.__text, node.__key, node.__mentionName);
	}

	static importJSON(serializedNode: SerializedTextNode): MentionNode {
		return $createMentionNode(serializedNode.text, (serializedNode as SerializedTextNode & { mentionName?: string }).mentionName)
			.updateFromJSON(serializedNode)
			.setMode("normal") as MentionNode;
	}

	createDOM(config: EditorConfig): HTMLElement {
		const element = super.createDOM(config);
		element.className = `${element.className} ${MENTION_CLASS}`.trim();
		setMentionDomAttributes(element, this.__mentionName);
		element.spellcheck = false;
		return element;
	}

	updateDOM(
		prevNode: this,
		dom: HTMLElement,
		config: EditorConfig,
	): boolean {
		const shouldReplace = super.updateDOM(prevNode, dom, config);
		if (!shouldReplace) {
			setMentionDomAttributes(dom, this.__mentionName);
		}
		return shouldReplace;
	}

	exportJSON() {
		return {
			...super.exportJSON(),
			type: "mention",
			version: 1,
			mentionName: this.__mentionName,
		};
	}

	canInsertTextBefore() {
		return false;
	}

	canInsertTextAfter() {
		return true;
	}

	isTextEntity() {
		return true;
	}
}

export function $createMentionNode(name = "", target = name): MentionNode {
	return $applyNodeReplacement(new MentionNode(String(name).trim(), undefined, target));
}

export function $isMentionNode(
	node: LexicalNode | null | undefined,
): node is MentionNode {
	return node instanceof MentionNode;
}

export const MENTION_TRANSFORMER: TextMatchTransformer = {
	dependencies: [MentionNode],
	export: (node) => {
		if (!$isMentionNode(node)) return null;
		const mentionName = normalizeEditableText(node.getTextContent()).trim();
		return mentionName ? formatEntityMention(node.__mentionName, mentionName) : "";
	},
	importRegExp: /\[([^\]\n]+)\](?:\{((?:\\.|[^}\\\n])+)\})?/,
	regExp: /\[([^\]\n]+)\]$/,
	replace: (textNode, match) => {
		const mentionName = normalizeEditableText(match[1]).trim();
		if (!mentionName) return;

		const mentionNode = $createMentionNode(match[2] ? decodeEntityMentionLabel(match[2]) : mentionName, mentionName);
		mentionNode.setFormat(textNode.getFormat());
		textNode.replace(mentionNode);
		mentionNode.insertAfter(createMentionBoundaryNode());
	},
	trigger: "]",
	type: "text-match",
};

