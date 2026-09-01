import type { ReactNode } from "react";
import type { CampaignEntity } from "../../../entities/campaign/index.js";

export interface EntityIdentity {
	scope: string;
	type: string;
	id: string;
	slug: string;
	name: string;
}

export interface EntityLinkModalState {
	entity: CampaignEntity;
	type: string;
	scope?: string;
}

export interface EntityLinkResolver {
	resolveEntityByName?: (
		name: string,
	) =>
		| EntityLinkModalState
		| null
		| undefined
		| Promise<EntityLinkModalState | null | undefined>;
	renderModalContent?: (
		modalState: EntityLinkModalState,
		onClose: () => void,
	) => ReactNode;
}
