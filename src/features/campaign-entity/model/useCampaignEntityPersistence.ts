import { useCallback, useRef, useState } from "react";
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

interface FlushCampaignEntitySavesOptions {
	throwOnError?: boolean;
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
	isSaving: boolean;
	flushSaves: (options?: FlushCampaignEntitySavesOptions) => Promise<void>;
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
	const savingCountRef = useRef(0);
	const [isSaving, setIsSaving] = useState(false);

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
		async (
			pending: PendingCampaignEntitySave | undefined,
			{ throwOnError = false }: FlushCampaignEntitySavesOptions = {},
		) => {
			if (!pending?.entity?.slug) return;
			savingCountRef.current += 1;
			setIsSaving(true);
			try {
				await updateCampaignEntity(
					pending.campaignSlug,
					pending.type,
					pending.entity.slug,
					sanitizeEntity(pending.entity),
				);
			} catch (error) {
				onError(`Failed to update ${pending.type} entity`, error);
				if (throwOnError) throw error;
			} finally {
				savingCountRef.current = Math.max(0, savingCountRef.current - 1);
				if (savingCountRef.current === 0) setIsSaving(false);
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

	const flushSaves = useCallback(async (
		options: FlushCampaignEntitySavesOptions = {},
	) => {
		Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
		timersRef.current = {};
		const entries = Object.values(pendingRef.current);
		pendingRef.current = {};
		await Promise.all(entries.map((entry) => persist(entry, options)));
	}, [persist]);

	return { clearSave, discardSaves, flushSaves, isSaving, scheduleSave };
}
