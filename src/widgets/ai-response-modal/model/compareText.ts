export interface ComparedTextPart {
	text: string;
	changed: boolean;
}

const MAX_TEXT_LENGTH = 12000;
const MAX_TOKENS = 240;
const TOKEN_PATTERN = /\s+|[\p{L}\p{M}\p{N}_]+|[^\s\p{L}\p{M}\p{N}_]+/gu;

function append(parts: ComparedTextPart[], text: string, changed: boolean): void {
	const last = parts[parts.length - 1];
	if (last && last.changed === changed) last.text += text;
	else parts.push({ text, changed });
}

/** Compare plain text only; large values use a bounded whole-value fallback. */
export function compareText(before: string, after: string): {
	before: ComparedTextPart[];
	after: ComparedTextPart[];
} {
	if (before === after) {
		return { before: [{ text: before, changed: false }], after: [{ text: after, changed: false }] };
	}
	const fallback = () => ({
		before: [{ text: before, changed: true }],
		after: [{ text: after, changed: true }],
	});
	if (before.length > MAX_TEXT_LENGTH || after.length > MAX_TEXT_LENGTH) return fallback();
	const oldTokens = before.match(TOKEN_PATTERN) ?? [];
	const newTokens = after.match(TOKEN_PATTERN) ?? [];
	if (oldTokens.length > MAX_TOKENS || newTokens.length > MAX_TOKENS) return fallback();

	const width = newTokens.length + 1;
	const lengths = new Uint16Array((oldTokens.length + 1) * width);
	for (let oldIndex = oldTokens.length - 1; oldIndex >= 0; oldIndex--) {
		for (let newIndex = newTokens.length - 1; newIndex >= 0; newIndex--) {
			const index = oldIndex * width + newIndex;
			lengths[index] = oldTokens[oldIndex] === newTokens[newIndex]
				? lengths[(oldIndex + 1) * width + newIndex + 1] + 1
				: Math.max(lengths[(oldIndex + 1) * width + newIndex], lengths[index + 1]);
		}
	}
	const oldParts: ComparedTextPart[] = [];
	const newParts: ComparedTextPart[] = [];
	let oldIndex = 0;
	let newIndex = 0;
	while (oldIndex < oldTokens.length || newIndex < newTokens.length) {
		if (oldIndex < oldTokens.length && newIndex < newTokens.length && oldTokens[oldIndex] === newTokens[newIndex]) {
			append(oldParts, oldTokens[oldIndex++], false);
			append(newParts, newTokens[newIndex++], false);
		} else if (newIndex < newTokens.length && (oldIndex === oldTokens.length || lengths[oldIndex * width + newIndex + 1] > lengths[(oldIndex + 1) * width + newIndex])) {
			append(newParts, newTokens[newIndex++], true);
		} else {
			append(oldParts, oldTokens[oldIndex++], true);
		}
	}
	return { before: oldParts, after: newParts };
}
