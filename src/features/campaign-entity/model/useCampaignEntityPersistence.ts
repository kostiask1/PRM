import { useCallback, useRef, useState } from "react";
import { updateCampaignEntity } from "./createEntity.ts";
import { createEntitySaveTracker } from "./entitySaveTracker.ts";
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
	version: number;
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
	waitForActiveSaves: () => Promise<void>;
	hasFailedSave: (type: CampaignFeatureEntityType, id: CampaignFeatureEntityId) => boolean;
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
	const trackerRef = useRef<ReturnType<typeof createEntitySaveTracker> | null>(null);
	if (!trackerRef.current) trackerRef.current = createEntitySaveTracker();
	const tracker = trackerRef.current;
	const savingCountRef = useRef(0);
	const [isSaving, setIsSaving] = useState(false);

	const clearSave = useCallback(
		(type: CampaignFeatureEntityType, id: CampaignFeatureEntityId) => {
			const key = `${type}:${id}`;
			if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
			delete timersRef.current[key];
			delete pendingRef.current[key];
			tracker.clear(`${campaignSlug}\0${key}`);
		},
		[campaignSlug, tracker],
	);

	const persist = useCallback(
		(
			pending: PendingCampaignEntitySave | undefined,
			{ throwOnError = false }: FlushCampaignEntitySavesOptions = {},
		): Promise<void> => {
			if (!pending?.entity?.slug) return Promise.resolve();
			const entitySlug = pending.entity.slug;
			const saveKey = `${pending.campaignSlug}\0${pending.type}:${pending.entity.id}`;
			const previousSave = tracker.lastForKey(saveKey);
			savingCountRef.current += 1;
			setIsSaving(true);
			const active = (async () => { try {
				if (previousSave) await previousSave.catch(() => {});
				await updateCampaignEntity(
					pending.campaignSlug,
					pending.type,
					entitySlug,
					sanitizeEntity(pending.entity),
				);
				tracker.succeeded(saveKey, pending.version);
			} catch (error) {
				tracker.failed(saveKey, pending.version);
				onError(`Failed to update ${pending.type} entity`, error);
				if (throwOnError) throw error;
			} finally {
				savingCountRef.current = Math.max(0, savingCountRef.current - 1);
				if (savingCountRef.current === 0) setIsSaving(false);
			} })();
			tracker.track(active, pending.campaignSlug, saveKey);
			return active;
		},
		[onError, sanitizeEntity, tracker],
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
				version: tracker.nextVersion(),
			};
			timersRef.current[key] = setTimeout(async () => {
				const pending = pendingRef.current[key];
				delete pendingRef.current[key];
				delete timersRef.current[key];
				await persist(pending);
			}, delay);
		},
		[campaignSlug, delay, persist, sanitizeEntity, tracker],
	);

	const discardSaves = useCallback(() => {
		Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
		timersRef.current = {};
		pendingRef.current = {};
		tracker.clearFailures();
	}, [tracker]);

	const waitForActiveSaves = useCallback(() => tracker.wait(campaignSlug), [campaignSlug, tracker]);
	const hasFailedSave = useCallback((type: CampaignFeatureEntityType, id: CampaignFeatureEntityId) =>
		tracker.hasFailed(`${campaignSlug}\0${type}:${id}`), [campaignSlug, tracker]);

	const flushSaves = useCallback(async (
		options: FlushCampaignEntitySavesOptions = {},
	) => {
		Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
		timersRef.current = {};
		await waitForActiveSaves();
		Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
		timersRef.current = {};
		const entries = Object.values(pendingRef.current);
		pendingRef.current = {};
		await Promise.all(entries.map((entry) => persist(entry, options)));
	}, [persist, waitForActiveSaves]);

	return { clearSave, discardSaves, flushSaves, hasFailedSave, isSaving, scheduleSave, waitForActiveSaves };
}
