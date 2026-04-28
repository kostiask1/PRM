import CampaignView from "./CampaignView";
import SessionView from "./SessionView";
import Bestiary from "./Bestiary";
import EncounterView from "./EncounterView";
import Spells from "./Spells";
import { useAppSelector } from "../store/appStore";
import { lang } from "../services/localization";
import "../assets/components/MainContent.css";

function ProjectTutorial() {
	const featureGroups = [
		{
			title: lang.t("Campaign workspace"),
			description: lang.t(
				"Keep campaign story, notes, characters, NPCs, locations, and factions in one place.",
			),
		},
		{
			title: lang.t("Session preparation"),
			description: lang.t(
				"Create sessions with scenes, goals, checks, notes, outcomes, and encounters.",
			),
		},
		{
			title: lang.t("Characters and worldbuilding"),
			description: lang.t(
				"Build character, NPC, location, and faction cards with notes, images, and quick mentions.",
			),
		},
		{
			title: lang.t("Encounters and references"),
			description: lang.t(
				"Use the bestiary, spell list, conditions, dice tools, and encounter view during play.",
			),
		},
		{
			title: lang.t("AI assistant"),
			description: lang.t(
				"Generate scenes, notes, outcomes, characters, NPCs, and locations using selected campaign context.",
			),
		},
		{
			title: lang.t("Local archive"),
			description: lang.t(
				"Export and import campaigns with their sessions, entities, and image assets.",
			),
		},
	];

	const workflowSteps = [
		lang.t("Start with the campaign story and reusable notes."),
		lang.t("Add player characters, NPCs, locations, and factions."),
		lang.t("Create a session, plan scenes, then add encounters as needed."),
		lang.t("Use mentions to connect notes, scenes, and entity cards."),
	];

	return (
		<section className="ProjectTutorial">
			<div className="ProjectTutorial__heading">
				<h2>{lang.t("Project guide")}</h2>
				<p className="muted">
					{lang.t("A quick overview of what this campaign manager can do.")}
				</p>
			</div>
			<div className="ProjectTutorial__layout">
				<div className="ProjectTutorial__features">
					{featureGroups.map((feature) => (
						<div className="ProjectTutorial__feature" key={feature.title}>
							<h3>{feature.title}</h3>
							<p>{feature.description}</p>
						</div>
					))}
				</div>
				<div className="ProjectTutorial__workflow">
					<h3>{lang.t("Suggested workflow")}</h3>
					<ol>
						{workflowSteps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
				</div>
			</div>
		</section>
	);
}

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
					<ProjectTutorial />
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
