import CampaignView from "./CampaignView";
import SessionView from "./SessionView";
import Bestiary from "./Bestiary";
import EncounterView from "./EncounterView";
import Spells from "./Spells";
import ProjectGuide from "./ProjectGuide";
import AiAssistantPanel from "./ai/AiAssistantPanel";
import { useLocation } from "react-router";
import { useAppSelector } from "../store/appStore";
import { lang } from "../services/localization";
import "../assets/components/MainContent.css";

export default function MainContent() {
	const location = useLocation();
	const campaign = useAppSelector((state) => state.active.campaign);
	const { activeSessionFileName, activeEncounterId } = useAppSelector(
		(state) => state.navigation,
	);
	const shouldShowAiAssistant =
		location.pathname === "/bestiary" || Boolean(campaign);
	const aiAssistantRouteKey = [
		location.pathname,
		activeSessionFileName || "",
		activeEncounterId || "",
	].join(":");

	if (location.pathname === "/spells") {
		return (
			<main className="MainContent">
				<Spells />
			</main>
		);
	}

	if (!campaign && location.pathname !== "/bestiary") {
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

	const content =
		location.pathname === "/bestiary" ? (
			<Bestiary />
		) : activeEncounterId ? (
			<EncounterView />
		) : activeSessionFileName ? (
			<SessionView />
		) : (
			<CampaignView key={campaign.slug} />
		);

	return (
		<main className="MainContent">
			{content}
			{shouldShowAiAssistant && <AiAssistantPanel key={aiAssistantRouteKey} />}
		</main>
	);
}
