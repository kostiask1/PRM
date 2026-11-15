import type { ReactNode } from "react";

import { splitEntityMentions } from "../../../shared/lib/index.js";
import EntityLink from "./EntityLink.tsx";

export function renderMentionText(text: unknown): ReactNode[] {
	return splitEntityMentions(text).map((part, index) =>
		typeof part === "string"
			? part
			: <EntityLink key={index} name={part.name}>{part.text}</EntityLink>,
	);
}

export function renderMentionPreview(text: unknown, maxLength?: number): ReactNode[] {
	const parts = splitEntityMentions(text);
	const visible = parts.map((part) => typeof part === "string" ? part : part.text).join("");
	const characters = Array.from(visible);
	const truncated = maxLength !== undefined && characters.length > maxLength;
	let remaining = truncated ? Array.from(characters.slice(0, maxLength).join("").trimEnd()).length : characters.length;
	const result: ReactNode[] = [];
	for (const [index, part] of parts.entries()) {
		if (remaining <= 0) break;
		const partText = typeof part === "string" ? part : part.text;
		const shown = Array.from(partText).slice(0, remaining).join("");
		remaining -= Array.from(shown).length;
		if (typeof part !== "string") result.push(<EntityLink key={index} name={part.name} ariaLabel={shown === part.text ? undefined : part.text}>{shown}</EntityLink>);
		else result.push(shown);
	}
	if (truncated) result.push("...");
	return result;
}
