import { lang } from "../../shared/lib/index.js";

const HOTKEYS = [
	"Ctrl+K — Add character/NPC/location link",
	"Ctrl+B — Bold",
	"Ctrl+I — Italic",
	"Ctrl+] — List",
	"Ctrl+[ — Remove list",
	"Ctrl+1-6 — Headings",
	"Ctrl+Q — Quote",
];

export default function ProjectGuide() {
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
		<section className="ProjectGuide">
			<div className="ProjectGuide__heading">
				<h2>{lang.t("Project guide")}</h2>
				<p className="muted">
					{lang.t("A quick overview of what this campaign manager can do.")}
				</p>
			</div>
			<div className="ProjectGuide__layout">
				<div className="ProjectGuide__features">
					{featureGroups.map((feature) => (
						<div className="ProjectGuide__feature" key={feature.title}>
							<h3>{feature.title}</h3>
							<p>{feature.description}</p>
						</div>
					))}
				</div>
				<div className="ProjectGuide__side">
					<div className="ProjectGuide__workflow">
						<h3>{lang.t("Suggested workflow")}</h3>
						<ol>
							{workflowSteps.map((step) => (
								<li key={step}>{step}</li>
							))}
						</ol>
					</div>
					<div className="ProjectGuide__hotkeys">
						<h3>{lang.t("Notes hotkeys:")}</h3>
						<ul>
							{HOTKEYS.map((hotkey) => (
								<li key={hotkey}>{lang.t(hotkey)}</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</section>
	);
}
