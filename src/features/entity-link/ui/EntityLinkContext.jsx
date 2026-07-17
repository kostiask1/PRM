import { useMemo } from "react";

import {
	EntityLinkContext,
	getEntityIdentity,
} from "../model/EntityLinkIdentity.ts";

function EntityLinkScope({ entity, type, scope = "", children }) {
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
