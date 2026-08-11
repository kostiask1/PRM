import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

import type { CampaignEntity } from "../../../entities/campaign/index.js";
import {
	deleteCampaignEntity,
	updateCampaignEntity,
} from "../../../features/campaign-entity/index.js";
import {
	EntityLinkResolverContext,
	type EntityLinkModalState,
	type EntityLinkResolver,
} from "../../../features/entity-link/index.js";
import { lang } from "../../../shared/lib/index.js";
import {
	getCampaignEntityRenamePlan,
	isCampaignModalEntity,
	sanitizeCampaignModalEntity,
	shouldRenderCampaignEntityModal,
	type CampaignModalEntity,
} from "../model.js";
import CampaignEntityModalCard from "./CampaignEntityModalCard.tsx";
import type {
	CampaignEntityModalCharacterCardComponent,
	CampaignEntityModalLocationCardComponent,
} from "./campaignEntityModalSlots.ts";

export interface CampaignEntityModalConfirmation extends Record<string, unknown> {
	message: string;
	title: string;
}

export interface CampaignEntityModalRuntime {
	requestConfirmation(
		payload: CampaignEntityModalConfirmation,
	): Promise<unknown>;
	refreshEntities(): void;
}

interface CampaignEntityModalContentProps {
	CharacterCard: CampaignEntityModalCharacterCardComponent;
	LocationCard: CampaignEntityModalLocationCardComponent;
	runtime: CampaignEntityModalRuntime;
	initialEntity: CampaignEntity;
	campaignSlug: string;
	type: string;
	onClose?: () => void;
}

function CampaignEntityModalContent({
	CharacterCard,
	LocationCard,
	runtime,
	initialEntity,
	campaignSlug,
	type,
	onClose,
}: CampaignEntityModalContentProps) {
	const [entity, setEntity] = useState<CampaignModalEntity | null>(
		isCampaignModalEntity(initialEntity) ? initialEntity : null,
	);

	useEffect(() => {
		setEntity(isCampaignModalEntity(initialEntity) ? initialEntity : null);
	}, [initialEntity]);

	const handleUpdate = async (
		_id: string | number | undefined,
		updated: CampaignModalEntity,
	) => {
		if (!isCampaignModalEntity(updated)) return;
		setEntity(updated);
		await updateCampaignEntity(
			campaignSlug,
			type,
			updated.slug,
			sanitizeCampaignModalEntity(updated),
		);
		runtime.refreshEntities();
	};

	const handleNameBlur = async (
		_id: string | number | undefined,
		updated: CampaignModalEntity,
		oldName: string,
		newName: string,
	): Promise<boolean> => {
		const plan = getCampaignEntityRenamePlan(oldName, newName);
		if (!plan.requiresConfirmation || !isCampaignModalEntity(updated)) return true;

		const shouldUpdateMentions = await runtime.requestConfirmation(
			{
				title: lang.t("Update links?"),
				message: lang.t(
					'Update links in the project from "{oldName}" to "{newName}"?',
					{ oldName, newName },
				),
			},
		);
		if (!shouldUpdateMentions) return false;

		const saved = await updateCampaignEntity(campaignSlug, type, updated.slug, {
			...sanitizeCampaignModalEntity(updated),
			_updateMentionReferences: true,
			_mentionOldName: oldName,
		});
		setEntity(isCampaignModalEntity(saved) ? saved : null);
		runtime.refreshEntities();
		return true;
	};

	const handleDelete = async () => {
		if (!entity) return;
		await deleteCampaignEntity(campaignSlug, type, entity.slug);
		runtime.refreshEntities();
		onClose?.();
	};

	if (!entity) return null;
	return (
		<CampaignEntityModalCard
			CharacterCard={CharacterCard}
			LocationCard={LocationCard}
			entity={entity}
			campaignSlug={campaignSlug}
			type={type}
			onChange={handleUpdate}
			onNameBlur={handleNameBlur}
			onDelete={handleDelete}
		/>
	);
}

export interface CampaignEntityModalProviderProps {
	CharacterCard: CampaignEntityModalCharacterCardComponent;
	LocationCard: CampaignEntityModalLocationCardComponent;
	runtime: CampaignEntityModalRuntime;
	campaignSlug?: string | null;
	children?: ReactNode;
}

export default function CampaignEntityModalProvider({
	CharacterCard,
	LocationCard,
	runtime,
	campaignSlug,
	children,
}: CampaignEntityModalProviderProps) {
	const parentEntityLinks = useContext(EntityLinkResolverContext);

	const renderModalContent = useCallback(
		(modalState: EntityLinkModalState, onClose: () => void) => {
			const parentContent = parentEntityLinks?.renderModalContent?.(
				modalState,
				onClose,
			);
			if (parentContent) return parentContent;
			if (
				!campaignSlug ||
				!shouldRenderCampaignEntityModal(campaignSlug, modalState.scope)
			) {
				return null;
			}
			return (
				<CampaignEntityModalContent
					CharacterCard={CharacterCard}
					LocationCard={LocationCard}
					runtime={runtime}
					initialEntity={modalState.entity}
					campaignSlug={campaignSlug}
					type={modalState.type}
					onClose={onClose}
				/>
			);
		},
		[CharacterCard, LocationCard, campaignSlug, parentEntityLinks, runtime],
	);

	const value = useMemo<EntityLinkResolver>(
		() => ({
			...(parentEntityLinks || {}),
			renderModalContent,
		}),
		[parentEntityLinks, renderModalContent],
	);

	return (
		<EntityLinkResolverContext.Provider value={value}>
			{children}
		</EntityLinkResolverContext.Provider>
	);
}
