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
	confirm,
	refreshEntitiesAction,
	useAppDispatch,
} from "../../../shared/model/index.js";
import {
	getCampaignEntityRenamePlan,
	isCampaignModalEntity,
	sanitizeCampaignModalEntity,
	shouldRenderCampaignEntityModal,
	type CampaignModalEntity,
} from "../model.js";
import CampaignEntityModalCard from "./CampaignEntityModalCard.tsx";

interface CampaignEntityModalContentProps {
	initialEntity: CampaignEntity;
	campaignSlug: string;
	type: string;
	onClose?: () => void;
}

function CampaignEntityModalContent({
	initialEntity,
	campaignSlug,
	type,
	onClose,
}: CampaignEntityModalContentProps) {
	const dispatch = useAppDispatch();
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
		dispatch(refreshEntitiesAction());
	};

	const handleNameBlur = async (
		_id: string | number | undefined,
		updated: CampaignModalEntity,
		oldName: string,
		newName: string,
	): Promise<boolean> => {
		const plan = getCampaignEntityRenamePlan(oldName, newName);
		if (!plan.requiresConfirmation || !isCampaignModalEntity(updated)) return true;

		const shouldUpdateMentions = await dispatch(
			confirm({
				title: lang.t("Update links?"),
				message: lang.t(
					'Update links in the project from "{oldName}" to "{newName}"?',
					{ oldName, newName },
				),
			}),
		);
		if (!shouldUpdateMentions) return false;

		const saved = await updateCampaignEntity(campaignSlug, type, updated.slug, {
			...sanitizeCampaignModalEntity(updated),
			_updateMentionReferences: true,
			_mentionOldName: oldName,
		});
		setEntity(isCampaignModalEntity(saved) ? saved : null);
		dispatch(refreshEntitiesAction());
		return true;
	};

	const handleDelete = async () => {
		if (!entity) return;
		await deleteCampaignEntity(campaignSlug, type, entity.slug);
		dispatch(refreshEntitiesAction());
		onClose?.();
	};

	if (!entity) return null;
	return (
		<CampaignEntityModalCard
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
	campaignSlug?: string | null;
	children?: ReactNode;
}

export default function CampaignEntityModalProvider({
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
					initialEntity={modalState.entity}
					campaignSlug={campaignSlug}
					type={modalState.type}
					onClose={onClose}
				/>
			);
		},
		[campaignSlug, parentEntityLinks],
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
