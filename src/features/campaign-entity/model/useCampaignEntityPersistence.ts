import { useCallback, useRef } from "react";
import { updateCampaignEntity } from "./createEntity.ts";
import type {
	CampaignEntityErrorHandler,
	CampaignEntitySanitizer,
	CampaignFeatureEntity,
	CampaignFeatureEntityId,
	CampaignFeatureEntityType,
} from "./contracts.ts";

interface PendingCampaignEntitySave {
	campaignSlug: string;
	type: CampaignFeatureEntityType;
	entity: CampaignFeatureEntity;
}

interface CampaignEntityPersistenceOptions {
	campaignSlug: string;
	sanitizeEntity: CampaignEntitySanitizer;
	delay?: number;
	onError?: CampaignEntityErrorHandler;
}

export interface CampaignEntityPersistence {
	clearSave: (
		type: CampaignFeatureEntityType,
		id: CampaignFeatureEntityId,
	) => void;
	discardSaves: () => void;
	flushSaves: () => Promise<void>;
	scheduleSave: (
		type: CampaignFeatureEntityType,
		entity: CampaignFeatureEntity,
	) => void;
}

export function useCampaignEntityPersistence({
	campaignSlug,
	sanitizeEntity,
	delay = 500,
	onError = console.error,
}: CampaignEntityPersistenceOptions): CampaignEntityPersistence {
	const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	const pendingRef = useRef<Record<string, PendingCampaignEntitySave>>({});

	const clearSave = useCallback(
		(type: CampaignFeatureEntityType, id: CampaignFeatureEntityId) => {
			const key = `${type}:${id}`;
			if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
			delete timersRef.current[key];
			delete pendingRef.current[key];
		},
		[],
	);

	const persist = useCallback(
		async (pending: PendingCampaignEntitySave | undefined) => {
			if (!pending?.entity?.slug) return;
			try {
				await updateCampaignEntity(
					pending.campaignSlug,
					pending.type,
					pending.entity.slug,
					sanitizeEntity(pending.entity),
				);
			} catch (error) {
				onError(`Failed to update ${pending.type} entity`, error);
			}
		},
		[onError, sanitizeEntity],
	);

	const scheduleSave = useCallback(
		(type: CampaignFeatureEntityType, entity: CampaignFeatureEntity) => {
			if (!entity?.slug || entity._isPending) return;
			const key = `${type}:${entity.id}`;
			if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
			pendingRef.current[key] = {
				campaignSlug,
				type,
				entity: sanitizeEntity(entity),
			};
			timersRef.current[key] = setTimeout(async () => {
				const pending = pendingRef.current[key];
				delete pendingRef.current[key];
				delete timersRef.current[key];
				await persist(pending);
			}, delay);
		},
		[campaignSlug, delay, persist, sanitizeEntity],
	);

	const discardSaves = useCallback(() => {
		Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
		timersRef.current = {};
		pendingRef.current = {};
	}, []);

	const flushSaves = useCallback(async () => {
		Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
		timersRef.current = {};
		const entries = Object.values(pendingRef.current);
		pendingRef.current = {};
		await Promise.all(entries.map(persist));
	}, [persist]);

	return { clearSave, discardSaves, flushSaves, scheduleSave };
}
