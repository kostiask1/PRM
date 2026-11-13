import type { ReactNode } from "react";

import EntityLink from "./EntityLink.tsx";

export function renderMentionText(text: unknown): ReactNode[] {
	return String(text || "")
		.split(/(\[[^\]]+\])/g)
		.map((part, index) => {
			if (!part.startsWith("[") || !part.endsWith("]")) return part;
			const name = part.slice(1, -1).trim();
			return <EntityLink key={index} name={name}>{name}</EntityLink>;
		});
}

export function renderMentionPreview(text: unknown, maxLength?: number): ReactNode[] {
	const parts = String(text || "").split(/(\[[^\]]+\])/g).map((part) => {
		const isMention = part.startsWith("[") && part.endsWith("]");
		return { isMention, text: isMention ? part.slice(1, -1).trim() : part };
	});
	const visible = parts.map((part) => part.text).join("");
	const characters = Array.from(visible);
	const truncated = maxLength !== undefined && characters.length > maxLength;
	let remaining = truncated ? Array.from(characters.slice(0, maxLength).join("").trimEnd()).length : characters.length;
	const result: ReactNode[] = [];
	for (const [index, part] of parts.entries()) {
		if (remaining <= 0) break;
		const shown = Array.from(part.text).slice(0, remaining).join("");
		remaining -= Array.from(shown).length;
		if (part.isMention) result.push(<EntityLink key={index} name={part.text} ariaLabel={shown === part.text ? undefined : part.text}>{shown}</EntityLink>);
		else result.push(shown);
	}
	if (truncated) result.push("...");
	return result;
}
