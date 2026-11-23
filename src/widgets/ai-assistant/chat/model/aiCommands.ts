import type { AiCommandItem } from "./aiChatTypes.ts";

export const AI_COMMANDS: readonly AiCommandItem[] = [
	{
		command: "@session",
		name: "Session",
		description: "Create a new session with scenes, NPCs, locations, and encounters",
		example: "@session plan a new session about rescuing a caravan in a gorge with 2 encounters and NPCs",
		category: "scene",
	},
	{
		command: "@scene",
		name: "Scene",
		description: "Edit descriptions, add details, discoveries, or ability checks",
		example: "@scene add a secret passage behind a wine barrel with a DC 15 check",
		category: "scene",
	},
	{
		command: "@npc",
		name: "NPC / Character",
		description: "Create a new NPC or update an existing one in the campaign",
		example: "@npc create a suspicious innkeeper with a thieves' guild tattoo",
		category: "entities",
	},
	{
		command: "@encounter",
		name: "Combat encounter",
		description: "Generate or balance a combat encounter for the party level",
		example: "@encounter generate an encounter for four level 3 players against cultists",
		category: "combat",
	},
	{
		command: "@bestiary",
		name: "Bestiary",
		description: "Create a custom monster following 5e rules or find an analog",
		example: "@bestiary create a venomous shadow wolf CR 2",
		category: "combat",
	},
	{
		command: "@location",
		name: "Location",
		description: "Describe a location, dungeon, or points of interest",
		example: "@location describe the ruins of an old cliffside lighthouse",
		category: "entities",
	},
	{
		command: "@image",
		name: "Image / Prompt",
		description: "Create a detailed prompt to generate an entity, scene, or monster image",
		example: "@image portrait of [NPC] in a dark tavern lit by candles",
		category: "entities",
	},
	{
		command: "@notes",
		name: "Notes",
		description: "Structure raw GM notes or extract quest hooks",
		example: "@notes turn the last paragraphs into a list of hooks for the party",
		category: "scene",
	},
	{
		command: "@rules",
		name: "D&D 5e rules",
		description: "Quick reference for rules, spells, or conditions",
		example: "@rules how do the Stunned condition and concentration checks work?",
		category: "system",
	},
	{
		command: "@dice",
		name: "Dice rolls",
		description: "Make secret or narrative skill checks and saving throws",
		example: "@dice roll 3d6+2 for a random encounter in a night forest",
		category: "system",
	},
];
