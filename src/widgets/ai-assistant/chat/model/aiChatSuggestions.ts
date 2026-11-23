import type { AiWorkspaceContext } from "./aiChatTypes.ts";

export interface AiChatQuickSuggestion {
	id: string;
	command: string;
	label: string;
	prompt: string;
}

export interface GetContextualChatSuggestionsOptions {
	viewType: AiWorkspaceContext["viewType"];
	activeSection?: string;
	isBestiaryScope?: boolean;
	isBestiaryOpen?: boolean;
	translate: (key: string) => string;
}

export function getContextualChatSuggestions({
	viewType,
	activeSection = "",
	isBestiaryScope = false,
	isBestiaryOpen = false,
	translate: t,
}: GetContextualChatSuggestionsOptions): AiChatQuickSuggestion[] {
	const normalizedSection = String(activeSection || "").trim().toLowerCase();

	if (isBestiaryScope || viewType === "bestiary" || isBestiaryOpen) {
		const suggestions: AiChatQuickSuggestion[] = [
			{
				id: "bestiary-create",
				command: "@bestiary",
				label: t("@bestiary create a custom 5e creature with a stat block"),
				prompt: t(
					"@bestiary create a custom 5e creature with a full stat block, traits, and actions: ",
				),
			},
			{
				id: "bestiary-image",
				command: "@image",
				label: t("@image generate a creature portrait or token"),
				prompt: t("@image generate an atmospheric creature illustration for "),
			},
		];

		if (!isBestiaryScope) {
			suggestions.push({
				id: "bestiary-encounter",
				command: "@encounter",
				label: t("@encounter build a combat encounter around a creature"),
				prompt: t("@encounter build a balanced combat encounter with minions around "),
			});
		}

		suggestions.push({
			id: "bestiary-rules",
			command: "@rules",
			label: t("@rules explain monster abilities or legendary actions"),
			prompt: t("@rules explain how these monster abilities and mechanics work in combat: "),
		});

		return suggestions;
	}

	if (viewType === "encounter") {
		return [
			{
				id: "encounter-balance",
				command: "@encounter",
				label: t("@encounter balance the current combat or add tactical complications"),
				prompt: t(
					"@encounter balance the current combat encounter for the party and suggest tactical complications",
				),
			},
			{
				id: "encounter-bestiary",
				command: "@bestiary",
				label: t("@bestiary create a custom monster or boss for this fight"),
				prompt: t("@bestiary create a custom monster or boss tailored for this encounter: "),
			},
			{
				id: "encounter-rules",
				command: "@rules",
				label: t("@rules quick combat rules reference (conditions, cover, grappling)"),
				prompt: t("@rules explain the combat rules for "),
			},
			{
				id: "encounter-dice",
				command: "@dice",
				label: t("@dice roll a group check, saving throw, or battlefield hazard"),
				prompt: t("@dice roll "),
			},
		];
	}

	if (viewType === "session") {
		switch (normalizedSection) {
			case "notes":
				return [
					{
						id: "session-notes-structure",
						command: "@notes",
						label: t("@notes organize session notes and highlight key events"),
						prompt: t(
							"@notes organize the draft notes for this session and highlight the main events",
						),
					},
					{
						id: "session-notes-scene",
						command: "@scene",
						label: t("@scene turn a note idea into a new session scene"),
						prompt: t("@scene create a new scene for this session based on the idea: "),
					},
					{
						id: "session-notes-dice",
						command: "@dice",
						label: t("@dice roll a random event or hidden skill check"),
						prompt: t("@dice roll a hidden check or random complication for the session"),
					},
				];
			case "entities":
				return [
					{
						id: "session-entities-npc",
						command: "@npc",
						label: t("@npc create a new NPC for this session"),
						prompt: t(
							"@npc create a memorable NPC for this session with appearance, motivation, and a secret",
						),
					},
					{
						id: "session-entities-image",
						command: "@image",
						label: t("@image generate a portrait for a session NPC"),
						prompt: t("@image generate a character portrait for the NPC "),
					},
					{
						id: "session-entities-scene",
						command: "@scene",
						label: t("@scene add a social interaction or dialogue scene with an NPC"),
						prompt: t("@scene add a social scene or encounter featuring the NPC "),
					},
				];
			case "locations":
				return [
					{
						id: "session-locations-location",
						command: "@location",
						label: t("@location create a location or faction for this session"),
						prompt: t(
							"@location create a detailed location or faction for this session with atmosphere and hooks",
						),
					},
					{
						id: "session-locations-scene",
						command: "@scene",
						label: t("@scene create an exploration or infiltration scene in a location"),
						prompt: t("@scene create an exploration scene with interactive details in "),
					},
					{
						id: "session-locations-image",
						command: "@image",
						label: t("@image generate an atmospheric location illustration"),
						prompt: t("@image generate an atmospheric fantasy illustration of the location "),
					},
				];
			case "result":
				return [
					{
						id: "session-result-notes",
						command: "@notes",
						label: t("@notes summarize session outcomes and player decisions"),
						prompt: t(
							"@notes write a structured summary of this session's outcomes, player decisions, and consequences",
						),
					},
					{
						id: "session-result-next",
						command: "@session",
						label: t("@session plan the next session based on these outcomes"),
						prompt: t(
							"@session plan the next session with scenes and hooks based on the consequences of this session",
						),
					},
					{
						id: "session-result-npc",
						command: "@npc",
						label: t("@npc update NPC or faction reactions after the session"),
						prompt: t("@npc update how NPCs and factions react to the party's actions in this session"),
					},
				];
			case "scenes":
			default:
				return [
					{
						id: "session-scenes-details",
						command: "@scene",
						label: t("@scene details and clue for the scene"),
						prompt: t("@scene add sensory details and one hidden clue"),
					},
					{
						id: "session-scenes-encounter",
						command: "@encounter",
						label: t("@encounter create and balance a combat for the scene"),
						prompt: t("@encounter balance a medium difficulty combat encounter for the party"),
					},
					{
						id: "session-scenes-npc",
						command: "@npc",
						label: t("@npc add an NPC the players meet in this scene"),
						prompt: t("@npc create a charismatic informant for the current location"),
					},
				];
		}
	}

	// Campaign view (viewType === "campaign")
	switch (normalizedSection) {
		case "characters":
			return [
				{
					id: "campaign-characters-hooks",
					command: "@notes",
					label: t("@notes create personal quest hooks for the party heroes"),
					prompt: t("@notes generate personal quest hooks and dramatic ties for the party characters"),
				},
				{
					id: "campaign-characters-npc",
					command: "@npc",
					label: t("@npc create an NPC tied to a hero's backstory"),
					prompt: t("@npc create a recurring NPC connected to a party character's backstory: "),
				},
				{
					id: "campaign-characters-encounter",
					command: "@encounter",
					label: t("@encounter design a combat tailored to the party's level"),
					prompt: t("@encounter balance a medium difficulty combat encounter for the party"),
				},
			];
		case "npc":
			return [
				{
					id: "campaign-npc-create",
					command: "@npc",
					label: t("@npc create a charismatic NPC with a secret and motivation"),
					prompt: t(
						"@npc create a charismatic NPC for the campaign with a distinct personality, goal, and secret",
					),
				},
				{
					id: "campaign-npc-image",
					command: "@image",
					label: t("@image generate a portrait for a new or existing NPC"),
					prompt: t("@image generate a fantasy character portrait for the NPC "),
				},
				{
					id: "campaign-npc-connections",
					command: "@notes",
					label: t("@notes design a web of relationships and conflicts between NPCs"),
					prompt: t("@notes suggest intrigues, alliances, and conflicts between the campaign NPCs"),
				},
			];
		case "locations":
			return [
				{
					id: "campaign-locations-create",
					command: "@location",
					label: t("@location describe a new location with atmosphere and secrets"),
					prompt: t(
						"@location create a new location or faction for the campaign with atmosphere, secrets, and hooks",
					),
				},
				{
					id: "campaign-locations-npc",
					command: "@npc",
					label: t("@npc create a notable inhabitant or faction leader"),
					prompt: t("@npc create a memorable inhabitant or faction leader for "),
				},
				{
					id: "campaign-locations-encounter",
					command: "@encounter",
					label: t("@encounter prepare a signature skirmish or ambush for a location"),
					prompt: t("@encounter design a thematic encounter or ambush set in "),
				},
			];
		case "notes":
		case "story":
			return [
				{
					id: "campaign-story-notes",
					command: "@notes",
					label: t("@notes structure plot ideas and extract quest hooks"),
					prompt: t("@notes organize the campaign story ideas and highlight key plot hooks"),
				},
				{
					id: "campaign-story-session",
					command: "@session",
					label: t("@session turn story notes into the next session plan"),
					prompt: t(
						"@session create a full session plan with scenes, NPCs, and encounters based on the campaign story",
					),
				},
				{
					id: "campaign-story-location",
					command: "@location",
					label: t("@location add an important story location or faction"),
					prompt: t("@location create a key story location or faction connected to the main plot: "),
				},
			];
		case "overview":
		case "sessions":
		default:
			return [
				{
					id: "campaign-overview-session",
					command: "@session",
					label: t("@session plan a new session with scenes, NPCs, and encounters"),
					prompt: t(
						"@session create a new session with scenes, local NPCs, locations, and a balanced encounter",
					),
				},
				{
					id: "campaign-overview-npc",
					command: "@npc",
					label: t("@npc create a key NPC for the campaign"),
					prompt: t("@npc create a key NPC for the campaign with motivation and plot hooks"),
				},
				{
					id: "campaign-overview-location",
					command: "@location",
					label: t("@location create a new location or faction"),
					prompt: t("@location create a new campaign location or faction with secrets and atmosphere"),
				},
			];
	}
}
