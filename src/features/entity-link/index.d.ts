export { renderMentionText } from "./ui/renderMentionText.tsx";
export { default as EntityModal, type EntityModalProps } from "./ui/EntityModal.tsx";
export {
	EntityLinkContext,
	EntityLinkResolverContext,
	type EntityIdentity,
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "./model/EntityLinkIdentity.ts";
export {
	buildEntityLinkModalTargetPlan,
	openEntityLinkModal,
	type EntityLinkModalTargetPlan,
	type OpenEntityLinkModalOptions,
} from "./model/entityLinkModalUtils.ts";
