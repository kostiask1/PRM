import {
	createContext,
	type Context,
	type ReactElement,
	type ReactNode,
	useContext,
} from "react";

import type { CampaignEntityResolution } from "../../../entities/campaign/index.js";

export interface EditableFieldEntityIdentity {
	scope: string;
	type: string;
	id: string;
	slug: string;
	name: string;
}

export type EditableFieldEntityModalState = CampaignEntityResolution;

export interface EditableFieldEntityLinkResolver {
	resolveEntityByName?: (
		name: string,
	) =>
		| EditableFieldEntityModalState
		| null
		| undefined
		| Promise<EditableFieldEntityModalState | null | undefined>;
	renderModalContent?: (
		modalState: EditableFieldEntityModalState,
		onClose: () => void,
	) => ReactNode;
}

export interface EditableFieldEntityModalProps {
	modalState: EditableFieldEntityModalState | null;
	onClose: () => void;
}

export type EditableFieldEntityModal = (
	props: EditableFieldEntityModalProps,
) => ReactElement | null;

export interface EditableFieldOpenEntityLinkModalOptions {
	campaignSlug: string | null;
	currentEntityIdentity: EditableFieldEntityIdentity | null;
	errorMessage: string;
	modalState: EditableFieldEntityModalState | null;
	name: string;
	scopedEntityLinks?: EditableFieldEntityLinkResolver | null;
	setModalState: (value: EditableFieldEntityModalState) => void;
}

export type EditableFieldOpenEntityLinkModal = (
	options: EditableFieldOpenEntityLinkModalOptions,
) => Promise<void>;

export interface EditableFieldEntityLinkRuntime {
	EntityLinkContext: Context<EditableFieldEntityIdentity | null>;
	EntityLinkResolverContext: Context<EditableFieldEntityLinkResolver | null>;
	EntityModal: EditableFieldEntityModal;
	openEntityLinkModal: EditableFieldOpenEntityLinkModal;
}

export interface EditableFieldEntityLinkProviderProps {
	children?: ReactNode;
	runtime: EditableFieldEntityLinkRuntime;
}

const EditableFieldEntityLinkRuntimeContext =
	createContext<EditableFieldEntityLinkRuntime | null>(null);

export function EditableFieldEntityLinkProvider({
	children,
	runtime,
}: EditableFieldEntityLinkProviderProps) {
	return (
		<EditableFieldEntityLinkRuntimeContext.Provider value={runtime}>
			{children}
		</EditableFieldEntityLinkRuntimeContext.Provider>
	);
}

export function useEditableFieldEntityLinkRuntime(): EditableFieldEntityLinkRuntime {
	const runtime = useContext(EditableFieldEntityLinkRuntimeContext);
	if (!runtime) {
		throw new Error(
			"EditableFieldEntityLinkProvider is required to render EditableField",
		);
	}
	return runtime;
}
