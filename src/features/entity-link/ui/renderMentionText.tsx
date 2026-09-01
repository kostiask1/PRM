import type { ReactNode } from "react";

import EntityLink from "./EntityLink.tsx";

export function renderMentionText(text: unknown): ReactNode[] {
	return String(text || "")
		.split(/(\[[^\]]+\])/g)
		.map((part, index) => {
			if (!part.startsWith("[") || !part.endsWith("]")) return part;
			const name = part.slice(1, -1).trim();
			return (
				<EntityLink key={index} name={name}>
					{name}
				</EntityLink>
			);
		});
}
