import { CampaignPage } from "../../pages/campaign/index.js";
import { SessionPage } from "../../pages/session/index.js";
import { EncounterBestiary, EncounterPage } from "../../pages/encounter/index.js";
import ProjectGuide from "./ProjectGuide";
import { AiAssistantV2 } from "../../widgets/ai-assistant/index.js";
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
		BestiaryBrowser: EncounterBestiary,
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

function EmptyState({
	className = "",
	showAssistant = false,
}: {
	className?: string;
	showAssistant?: boolean;
}) {
	const isRulesReferenceOpen = useAppSelector(
		(state) => state.rulesReference.isOpen,
	);
	const content = (
		<section className="MainContent__emptyState Panel">
			<h2>{lang.t("Choose a campaign or create a new one")}</h2>
			<p>{lang.t("The campaign menu is on the left.")}</p>
			<ProjectGuide />
		</section>
	);

	if (!showAssistant || !isRulesReferenceOpen) {
		return content;
	}

	return (
		<main className={classNames("MainContent", className)}>
			<div className="MainContent__workspaceArea">{content}</div>
			<AiAssistantV2 ResponseModal={MainContentAiResponseModal} />
		</main>
	);
}

function MainContentLayout({ className = "" }: { className?: string }) {
	const activeCampaign = useAppSelector(
		(state) => state.active.campaign as CampaignRecord | null,
	);
	const activeSession = useAppSelector(
		(state) => state.active.session as { name?: string } | null,
	);

	return (
		<main className={classNames("MainContent", className)}>
			<div className="MainContent__workspaceArea">
				<AiAssistantRuntimeHost>
					<BestiaryBrowserRuntimeHost>
						<CampaignSearchRuntimeHost>
							<Outlet />
						</CampaignSearchRuntimeHost>
					</BestiaryBrowserRuntimeHost>
				</AiAssistantRuntimeHost>
			</div>
			<AiAssistantV2
				campaignTitle={activeCampaign?.name}
				sessionTitle={activeSession?.name}
				ResponseModal={MainContentAiResponseModal}
			/>
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
	const { pathname } = useLocation();
	const campaign = useAppSelector(
		(state) => state.active.campaign as CampaignRecord | null,
	);
	if (!campaign) return <EmptyState />;

	return (
		<div key={pathname} style={{ display: "contents" }}>
			<EncounterPageRuntimeHost>
				<EncounterPage />
			</EncounterPageRuntimeHost>
		</div>
	);
}

export default function MainContent() {
	return (
		<Routes>
			<Route path="/" element={<EmptyState showAssistant />} />
			<Route element={<MainContentLayout />}>
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
			<Route path="*" element={<EmptyState showAssistant />} />
		</Routes>
	);
}
