import CampaignView from "./CampaignView";
import SessionView from "./SessionView";
import Bestiary from "./Bestiary";
import EncounterView from "./EncounterView";
import Spells from "./Spells";
import ProjectGuide from "./ProjectGuide";
import { useAppSelector } from "../store/appStore";
import { lang } from "../services/localization";
import "../assets/components/MainContent.css";

export default function MainContent() {
	const campaign = useAppSelector((state) => state.active.campaign);
	const { activeSessionFileName, activeEncounterId } = useAppSelector(
		(state) => state.navigation,
	);

	if (window.location.pathname === "/bestiary") {
		return (
			<main className="MainContent">
				<Bestiary />
			</main>
		);
	}
	if (window.location.pathname === "/spells") {
		return (
			<main className="MainContent">
				<Spells />
			</main>
		);
	}

	if (!campaign) {
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

	return (
		<main className="MainContent">
			{activeEncounterId ? (
				<EncounterView />
			) : activeSessionFileName ? (
				<SessionView />
			) : (
				<CampaignView key={campaign.slug} />
			)}
		</main>
	);
}
