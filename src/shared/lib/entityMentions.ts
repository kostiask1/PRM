export interface EntityMentionPart {
	name: string;
	text: string;
	raw: string;
}

// A backslash protects a closing brace or another backslash in the label.
// Existing [name] links deliberately keep their original syntax.
export const ENTITY_MENTION_PATTERN = /\[([^\]\n]+)\](?:\{((?:\\.|[^}\\\n])+)\})?/g;

export function decodeEntityMentionLabel(value: string): string {
	return value.replace(/\\([\\}])/g, "$1");
}

export function formatEntityMention(name: string, label = name): string {
	if (!label || label === name) return `[${name}]`;
	return `[${name}]{${label.replace(/[\\}]/g, "\\$&")}}`;
}

export function splitEntityMentions(value: unknown): Array<string | EntityMentionPart> {
	const text = String(value || "");
	const parts: Array<string | EntityMentionPart> = [];
	let offset = 0;
	for (const match of text.matchAll(ENTITY_MENTION_PATTERN)) {
		const index = match.index;
		if (index > offset) parts.push(text.slice(offset, index));
		const name = match[1].trim();
		parts.push({ name, text: match[2] === undefined ? name : decodeEntityMentionLabel(match[2]), raw: match[0] });
		offset = index + match[0].length;
	}
	if (offset < text.length) parts.push(text.slice(offset));
	return parts;
}
