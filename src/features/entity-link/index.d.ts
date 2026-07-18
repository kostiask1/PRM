export { default as EntityLink, type EntityLinkProps } from "./ui/EntityLink.tsx";
export { default as EntityModal, type EntityModalProps } from "./ui/EntityModal.tsx";
export {
	EntityLinkContext,
	EntityLinkResolverContext,
	type EntityIdentity,
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "./model/EntityLinkIdentity.ts";
export {
	openEntityLinkModal,
	type OpenEntityLinkModalOptions,
} from "./model/entityLinkModalUtils.ts";
