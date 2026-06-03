import CampaignView from "./CampaignView";
import SessionView from "./SessionView";
import Bestiary from "./Bestiary";
import EncounterView from "./EncounterView";
import Spells from "./Spells";
import ProjectGuide from "./ProjectGuide";
import AiAssistantPanel from "./ai/AiAssistantPanel";
import { Outlet, Route, Routes, useLocation } from "react-router";
import { useAppSelector } from "../store/appStore";
import { lang } from "../services/localization";
import "../assets/components/MainContent.css";

function EmptyState() {
	return (
		<main className="MainContent">
			<section className="MainContent__emptyState Panel">
				<h2>{lang.t("Choose a campaign or create a new one")}</h2>
				<p>{lang.t("The campaign menu is on the left.")}</p>
				<ProjectGuide />
			</section>
		</main>
	);
}

function MainContentLayout({ showAiAssistant = false }) {
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
		<main className="MainContent">
			<Outlet />
			{showAiAssistant && <AiAssistantPanel key={aiAssistantRouteKey} />}
		</main>
	);
}

function CampaignRoute() {
	const campaign = useAppSelector((state) => state.active.campaign);
	if (!campaign) return <EmptyState />;

	return <CampaignView key={campaign.slug} />;
}

function SessionRoute() {
	const campaign = useAppSelector((state) => state.active.campaign);
	if (!campaign) return <EmptyState />;

	return <SessionView />;
}

function EncounterRoute() {
	const campaign = useAppSelector((state) => state.active.campaign);
	if (!campaign) return <EmptyState />;

	return <EncounterView />;
}

function BestiaryRoute() {
	return <Bestiary />;
}

function SpellsRoute() {
	return <Spells />;
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
				<Route path="/bestiary" element={<BestiaryRoute />} />
			</Route>
			<Route element={<MainContentLayout />}>
				<Route path="/spells" element={<SpellsRoute />} />
			</Route>
			<Route path="*" element={<EmptyState />} />
		</Routes>
	);
}
