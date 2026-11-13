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

function isSurrogateSplit(text: string, index: number): boolean {
	const before = text.charCodeAt(index - 1);
	const after = text.charCodeAt(index);
	return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

function isWordSplit(text: string, index: number): boolean {
	return /[\p{L}\p{M}\p{N}_]/u.test(text[index - 1] || "") && /[\p{L}\p{M}\p{N}_]/u.test(text[index] || "");
}

/** Compare plain text, bounding detailed work for large changed regions. */
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
	if (before.length > MAX_TEXT_LENGTH || after.length > MAX_TEXT_LENGTH) {
		let prefixLength = 0;
		while (prefixLength < before.length && prefixLength < after.length && before[prefixLength] === after[prefixLength]) prefixLength++;
		while (prefixLength > 0 && (isWordSplit(before, prefixLength) || isWordSplit(after, prefixLength))) prefixLength--;
		if (isSurrogateSplit(before, prefixLength) || isSurrogateSplit(after, prefixLength)) prefixLength--;
		let suffixLength = 0;
		while (suffixLength < before.length - prefixLength && suffixLength < after.length - prefixLength && before[before.length - 1 - suffixLength] === after[after.length - 1 - suffixLength]) suffixLength++;
		while (suffixLength > 0 && (isWordSplit(before, before.length - suffixLength) || isWordSplit(after, after.length - suffixLength))) suffixLength--;
		if (isSurrogateSplit(before, before.length - suffixLength) || isSurrogateSplit(after, after.length - suffixLength)) suffixLength--;
		if (prefixLength === 0 && suffixLength === 0) return fallback();
		const oldMiddle = before.slice(prefixLength, before.length - suffixLength);
		const newMiddle = after.slice(prefixLength, after.length - suffixLength);
		const middle = oldMiddle.length > MAX_TEXT_LENGTH || newMiddle.length > MAX_TEXT_LENGTH
			? { before: [{ text: oldMiddle, changed: true }], after: [{ text: newMiddle, changed: true }] }
			: compareText(oldMiddle, newMiddle);
		const oldParts: ComparedTextPart[] = [];
		const newParts: ComparedTextPart[] = [];
		const prefix = before.slice(0, prefixLength);
		const suffix = suffixLength ? before.slice(-suffixLength) : "";
		if (prefix) { append(oldParts, prefix, false); append(newParts, prefix, false); }
		for (const part of middle.before) if (part.text) append(oldParts, part.text, part.changed);
		for (const part of middle.after) if (part.text) append(newParts, part.text, part.changed);
		if (suffix) { append(oldParts, suffix, false); append(newParts, suffix, false); }
		return { before: oldParts, after: newParts };
	}
	const beforeTokens = before.match(TOKEN_PATTERN) ?? [];
	const afterTokens = after.match(TOKEN_PATTERN) ?? [];
	let prefixLength = 0;
	while (prefixLength < beforeTokens.length && prefixLength < afterTokens.length && beforeTokens[prefixLength] === afterTokens[prefixLength]) prefixLength++;
	let suffixLength = 0;
	while (suffixLength < beforeTokens.length - prefixLength && suffixLength < afterTokens.length - prefixLength && beforeTokens[beforeTokens.length - 1 - suffixLength] === afterTokens[afterTokens.length - 1 - suffixLength]) suffixLength++;
	const oldTokens = beforeTokens.slice(prefixLength, beforeTokens.length - suffixLength);
	const newTokens = afterTokens.slice(prefixLength, afterTokens.length - suffixLength);
	if (oldTokens.length > MAX_TOKENS || newTokens.length > MAX_TOKENS) {
		const prefix = beforeTokens.slice(0, prefixLength).join("");
		const suffix = suffixLength ? beforeTokens.slice(-suffixLength).join("") : "";
		const oldParts: ComparedTextPart[] = [];
		const newParts: ComparedTextPart[] = [];
		if (prefix) { append(oldParts, prefix, false); append(newParts, prefix, false); }
		if (oldTokens.length) append(oldParts, oldTokens.join(""), true);
		if (newTokens.length) append(newParts, newTokens.join(""), true);
		if (suffix) { append(oldParts, suffix, false); append(newParts, suffix, false); }
		return { before: oldParts, after: newParts };
	}

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
	const prefix = beforeTokens.slice(0, prefixLength).join("");
	if (prefix) {
		append(oldParts, prefix, false);
		append(newParts, prefix, false);
	}
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
	const suffix = suffixLength ? beforeTokens.slice(-suffixLength).join("") : "";
	if (suffix) {
		append(oldParts, suffix, false);
		append(newParts, suffix, false);
	}
	return { before: oldParts, after: newParts };
}
