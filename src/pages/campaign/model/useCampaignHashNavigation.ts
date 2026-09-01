import { useEffect, useState } from "react";
import { scrollToHashTarget } from "../../../shared/lib/index.js";
import {
	executeCampaignHashNavigationPlan,
	getCampaignHashNavigationPlan,
	type CampaignNotesViewMode,
} from "./campaignPagePresentation.ts";

type CampaignSectionSetter = (collapsed: boolean) => void;

interface UseCampaignHashNavigationOptions {
	campaignSlug: string;
	isCharactersCollapsed: boolean;
	isLocationsCollapsed: boolean;
	isNotesCollapsed: boolean;
	isNpcsCollapsed: boolean;
	notesForRender: unknown;
	setIsCharactersCollapsed: CampaignSectionSetter;
	setIsLocationsCollapsed: CampaignSectionSetter;
	setIsNotesCollapsed: CampaignSectionSetter;
	setIsNpcsCollapsed: CampaignSectionSetter;
	setNotesViewMode: (mode: CampaignNotesViewMode) => void;
	onRevealHistoryTarget?: (hash: string) => void;
}

export function useCampaignHashNavigation({
	campaignSlug,
	isCharactersCollapsed,
	isLocationsCollapsed,
	isNotesCollapsed,
	isNpcsCollapsed,
	notesForRender,
	setIsCharactersCollapsed,
	setIsLocationsCollapsed,
	setIsNotesCollapsed,
	setIsNpcsCollapsed,
	setNotesViewMode,
	onRevealHistoryTarget,
}: UseCampaignHashNavigationOptions): void {
	const [hashVersion, setHashVersion] = useState(0);
	useEffect(() => {
		const handleHashChange = () => setHashVersion((value) => value + 1);
		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, []);
	useEffect(() => {
		const hash = decodeURIComponent(window.location.hash || "");
		const plan = getCampaignHashNavigationPlan({
			hash,
			collapsed: {
				notes: isNotesCollapsed,
				characters: isCharactersCollapsed,
				npc: isNpcsCollapsed,
				locations: isLocationsCollapsed,
			},
		});
		const sectionSetters = {
			notes: setIsNotesCollapsed,
			characters: setIsCharactersCollapsed,
			npc: setIsNpcsCollapsed,
			locations: setIsLocationsCollapsed,
		};
		executeCampaignHashNavigationPlan(plan, {
			useListView: () => setNotesViewMode("list"),
			expandSection: (target) => sectionSetters[target](false),
		});
		onRevealHistoryTarget?.(hash);
		const timer = window.setTimeout(() => scrollToHashTarget(), 120);
		return () => window.clearTimeout(timer);
	}, [
		campaignSlug,
		hashVersion,
		isCharactersCollapsed,
		isLocationsCollapsed,
		isNotesCollapsed,
		isNpcsCollapsed,
		notesForRender,
		setIsCharactersCollapsed,
		setIsLocationsCollapsed,
		setIsNotesCollapsed,
		setIsNpcsCollapsed,
		onRevealHistoryTarget,
	]);
}
