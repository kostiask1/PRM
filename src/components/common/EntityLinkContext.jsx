import { useMemo } from "react";

import { EntityLinkContext, getEntityIdentity } from "./EntityLinkIdentity";

function EntityLinkScope({ entity, type, children }) {
	const value = useMemo(
		() => (entity ? getEntityIdentity(entity, type) : null),
		[entity, type],
	);

	return (
		<EntityLinkContext.Provider value={value}>
			{children}
		</EntityLinkContext.Provider>
	);
}

export { EntityLinkScope };
