import { createContext } from "react";
import type {
	EntityIdentity,
	EntityLinkResolver,
} from "./entityLinkContracts.ts";

const EntityLinkContext = createContext<EntityIdentity | null>(null);
const EntityLinkResolverContext = createContext<EntityLinkResolver | null>(null);

export { EntityLinkContext, EntityLinkResolverContext };
export {
	getEntityIdentity,
	isSameEntityIdentity,
} from "./entityLinkIdentityPolicy.ts";
export type {
	EntityIdentity,
	EntityLinkModalState,
	EntityLinkResolver,
} from "./entityLinkContracts.ts";
