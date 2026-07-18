import { type ReactNode, useMemo } from "react";
import type { CampaignEntity } from "../../../entities/campaign/index.js";

import {
	EntityLinkContext,
	getEntityIdentity,
} from "../model/EntityLinkIdentity.ts";

export interface EntityLinkScopeProps {
	entity: CampaignEntity | null;
	type: string;
	scope?: string;
	children?: ReactNode;
}

function EntityLinkScope({
	entity,
	type,
	scope = "",
	children,
}: EntityLinkScopeProps) {
	const value = useMemo(
		() => (entity ? getEntityIdentity(entity, type, scope) : null),
		[entity, scope, type],
	);

	return (
		<EntityLinkContext.Provider value={value}>
			{children}
		</EntityLinkContext.Provider>
	);
}

export { EntityLinkScope };
