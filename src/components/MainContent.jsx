import CampaignView from "./CampaignView";
import SessionView from "./SessionView";
import Bestiary from "./Bestiary";
import EncounterView from "./EncounterView";
import Spells from "./Spells";
import { useAppSelector } from "../store/appStore";
import { lang } from "../services/localization";

export default function MainContent({ campaign }) {
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
				</section>
			</main>
		);
	}

	return (
		<main className="MainContent">
			{activeEncounterId ? (
				<EncounterView
					campaign={campaign}
					sessionId={activeSessionFileName}
					encounterId={activeEncounterId}
				/>
			) : activeSessionFileName ? (
				<SessionView campaign={campaign} sessionId={activeSessionFileName} />
			) : (
				<CampaignView campaign={campaign} />
			)}
		</main>
	);
}
