import { CampaignPage } from "../../pages/campaign/index.js";
import { SessionPage } from "../../pages/session/index.js";
import { EncounterPage } from "../../pages/encounter/index.js";
import {
	AiAssistantPanel,
} from "../../widgets/ai-assistant/index.js";
import { RulesReferenceModalContent } from "../../widgets/rules-reference/index.js";
import ProjectGuide from "./ProjectGuide";
import { Outlet, Route, Routes, useLocation } from "react-router";
import { useAppSelector } from "../../shared/lib/index.js";
import { lang } from "../../shared/config/index.js";
import classNames from "../../shared/lib/classNames.js";
import "../../assets/components/MainContent.css";

const renderRulesReferencePicker = ({ onSelectReference }) => (
	<RulesReferenceModalContent onSelectReference={onSelectReference} />
);

function EmptyState({ className = "" }) {
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

function MainContentLayout({ className = "", showAiAssistant = false }) {
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
			<Outlet />
			{showAiAssistant && (
				<AiAssistantPanel
					key={aiAssistantRouteKey}
					renderRulesReference={renderRulesReferencePicker}
				/>
			)}
		</main>
	);
}

function CampaignRoute() {
	const campaign = useAppSelector((state) => state.active.campaign);
	if (!campaign) return <EmptyState />;

	return <CampaignPage key={campaign.slug} />;
}

function SessionRoute() {
	const campaign = useAppSelector((state) => state.active.campaign);
	if (!campaign) return <EmptyState />;

	return <SessionPage />;
}

function EncounterRoute() {
	const campaign = useAppSelector((state) => state.active.campaign);
	if (!campaign) return <EmptyState />;

	return <EncounterPage />;
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
