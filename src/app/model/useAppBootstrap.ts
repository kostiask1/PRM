import { useCallback, useEffect } from "react";
import { campaignApi } from "../../entities/campaign/index.js";
import {
	applyTheme,
	settingsApi,
	type SettingsPayload,
} from "../../features/settings/index.js";
import { lang } from "../../shared/lib/index.js";
import {
	alert,
	setCampaignsAction,
	setLanguageAction,
	setUiSettingsAction,
	type AppDispatch,
} from "../../shared/model/index.js";
import {
	getAppSettingsProjection,
	isSettingsSyncEvent,
} from "./appShellPresentation.ts";

const api = { ...campaignApi, ...settingsApi };

type IsMounted = () => boolean;

interface UseAppBootstrapOptions {
	dispatch: AppDispatch;
	campaignsReloadVersion: number;
	currentTheme: unknown;
	syncEvent: unknown;
}

export function useAppBootstrap({
	dispatch,
	campaignsReloadVersion,
	currentTheme,
	syncEvent,
}: UseAppBootstrapOptions): void {
	const loadCampaigns = useCallback(async () => {
		try {
			const data = await api.listCampaigns();
			dispatch(setCampaignsAction(data));
		} catch (err) {
			console.error("Failed to load campaigns", err);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to load campaigns"),
				}),
			);
		}
	}, [dispatch]);

	const applySettingsToStore = useCallback(
		(settings: SettingsPayload) => {
			const projection = getAppSettingsProjection(settings);
			dispatch(setLanguageAction(projection.language));
			dispatch(setUiSettingsAction(projection.ui));
		},
		[dispatch],
	);

	const loadSettings = useCallback(
		async (isMounted: IsMounted, errorMessage: string) => {
			try {
				const settings = await api.getSettings();
				if (!isMounted() || !settings) return;
				applySettingsToStore(settings);
			} catch (error) {
				console.error(errorMessage, error);
			}
		},
		[applySettingsToStore],
	);

	useEffect(() => {
		loadCampaigns();
	}, [loadCampaigns, campaignsReloadVersion]);

	useEffect(() => {
		applyTheme(currentTheme);
	}, [currentTheme]);

	useEffect(() => {
		let isMounted = true;
		loadSettings(() => isMounted, "Failed to load settings");

		return () => {
			isMounted = false;
		};
	}, [loadSettings]);

	useEffect(() => {
		if (!isSettingsSyncEvent(syncEvent)) return;

		let isMounted = true;
		loadSettings(
			() => isMounted,
			"Failed to reload settings after sync event",
		);
		return () => {
			isMounted = false;
		};
	}, [loadSettings, syncEvent]);
}
