import { CampaignPage } from "../../pages/campaign/index.js";
import { SessionPage } from "../../pages/session/index.js";
import { EncounterPage } from "../../pages/encounter/index.js";
import ProjectGuide from "./ProjectGuide";
import { AiAssistantPanel } from "../../widgets/ai-assistant/index.js";
import { createAiResponseModalComponent } from "../../widgets/ai-response-modal/index.js";
import {
	CharacterCard,
	LocationCard,
} from "../../widgets/campaign-entity-card/index.js";
import { createMonsterEditorModalComponent } from "../../widgets/monster-editor-modal/index.js";
import { MonsterStatBlock } from "../../widgets/monster-stat-block/index.js";
import { SpellsBrowser } from "../../widgets/spells-browser/index.js";
import { createRulesReferenceModalContentComponent } from "../../widgets/rules-reference-modal/index.js";
import { Outlet, Route, Routes, useLocation } from "react-router";
import { useAppSelector } from "../model/index.js";
import AiAssistantRuntimeHost from "../ui/AiAssistantRuntimeHost.tsx";
import BestiaryBrowserRuntimeHost from "../ui/BestiaryBrowserRuntimeHost.tsx";
import CampaignPageRuntimeHost from "../ui/CampaignPageRuntimeHost.tsx";
import CampaignSearchRuntimeHost from "../ui/CampaignSearchRuntimeHost.tsx";
import EncounterPageRuntimeHost from "../ui/EncounterPageRuntimeHost.tsx";
import SessionPageRuntimeHost from "../ui/SessionPageRuntimeHost.tsx";
import { lang } from "../../shared/lib/index.js";
import { classNames } from "../../shared/lib/index.js";
import "../../assets/components/MainContent.css";
import type { CampaignRecord } from "../../entities/campaign/index.js";

const MainContentRulesReferenceContent =
	createRulesReferenceModalContentComponent({
		MonsterStatBlock,
		SpellsBrowser,
	});
const MainContentMonsterEditorModal = createMonsterEditorModalComponent({
	RulesReferenceContent: MainContentRulesReferenceContent,
});
const MainContentAiResponseModal = createAiResponseModalComponent({
	CharacterCard,
	LocationCard,
	MonsterStatBlock,
	MonsterEditorModal: MainContentMonsterEditorModal,
});

function EmptyState({ className = "" }: { className?: string }) {
	return (
		<main className={classNames("MainContent", className)}>
			<section className="MainContent__emptyState Panel">
				<h2>{lang.t("Choose a campaign or create a new one")}</h2>
				<p>{lang.t("The campaign menu is on the left.")}</p>
				<ProjectGuide />
			</section>
		</main>
	);
}

function MainContentLayout({
	className = "",
	showAiAssistant = false,
}: {
	className?: string;
	showAiAssistant?: boolean;
}) {
	const location = useLocation();
	const { activeSessionFileName, activeEncounterId } = useAppSelector(
		(state) => state.navigation,
	);
	const aiAssistantRouteKey = [
		location.pathname,
		activeSessionFileName || "",
		activeEncounterId || "",
	].join(":");

	return (
		<main className={classNames("MainContent", className)}>
			<AiAssistantRuntimeHost>
				<BestiaryBrowserRuntimeHost>
					<CampaignSearchRuntimeHost>
						<Outlet />
					</CampaignSearchRuntimeHost>
				</BestiaryBrowserRuntimeHost>
				{showAiAssistant && (
					<AiAssistantPanel
						key={aiAssistantRouteKey}
						ResponseModal={MainContentAiResponseModal}
					/>
				)}
			</AiAssistantRuntimeHost>
		</main>
	);
}

function CampaignRoute() {
	const campaign = useAppSelector(
		(state) => state.active.campaign as CampaignRecord | null,
	);
	if (!campaign) return <EmptyState />;

	return (
		<CampaignPageRuntimeHost>
			<CampaignPage key={campaign.slug} />
		</CampaignPageRuntimeHost>
	);
}

function SessionRoute() {
	const campaign = useAppSelector(
		(state) => state.active.campaign as CampaignRecord | null,
	);
	if (!campaign) return <EmptyState />;

	return (
		<SessionPageRuntimeHost>
			<SessionPage />
		</SessionPageRuntimeHost>
	);
}

function EncounterRoute() {
	const campaign = useAppSelector(
		(state) => state.active.campaign as CampaignRecord | null,
	);
	if (!campaign) return <EmptyState />;

	return (
		<EncounterPageRuntimeHost>
			<EncounterPage />
		</EncounterPageRuntimeHost>
	);
}

export default function MainContent() {
	return (
		<Routes>
			<Route path="/" element={<EmptyState />} />
			<Route element={<MainContentLayout showAiAssistant />}>
				<Route path="/campaign/:slug" element={<CampaignRoute />} />
				<Route
					path="/campaign/:slug/session/:fileName"
					element={<SessionRoute />}
				/>
				<Route
					path="/campaign/:slug/session/:fileName/encounter/:encounterId"
					element={<EncounterRoute />}
				/>
			</Route>
			<Route path="*" element={<EmptyState />} />
		</Routes>
	);
}
