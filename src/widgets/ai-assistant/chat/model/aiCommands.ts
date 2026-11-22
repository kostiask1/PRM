import type { AiCommandItem } from "./aiChatTypes.ts";

export const AI_COMMANDS: readonly AiCommandItem[] = [
	{
		command: "@scene",
		name: "Сцена",
		description: "Змінити опис, додати деталі, знахідки або перевірки",
		example: "@scene додай таємний хід за винною бочкою зі складною перевіркою DC 15",
		category: "scene",
	},
	{
		command: "@npc",
		name: "NPC / Персонаж",
		description: "Створити нового NPC або оновити існуючого у кампанії",
		example: "@npc створити підозрілого трактирника з татуюванням гільдії злодіїв",
		category: "entities",
	},
	{
		command: "@encounter",
		name: "Бойова сцена",
		description: "Згенерувати або збалансувати бій під рівень партії",
		example: "@encounter згенерувати бій для 4 гравців 3 рівня проти культистів",
		category: "combat",
	},
	{
		command: "@bestiary",
		name: "Бестіарій",
		description: "Створити унікального монстра за правилами 5e чи знайти аналог",
		example: "@bestiary створити отруйного тіньового вовка CR 2",
		category: "combat",
	},
	{
		command: "@location",
		name: "Локація",
		description: "Описати локацію, підземелля чи цікаві точки",
		example: "@location опиши руїни старого маяка на скелі",
		category: "entities",
	},
	{
		command: "@image",
		name: "Зображення / Промпт",
		description: "Створити детальний промпт для генерації зображення сутності, сцени або монстра",
		example: "@image портрет [NPC] у темній таверні при світлі свічок",
		category: "entities",
	},
	{
		command: "@notes",
		name: "Нотатки",
		description: "Структурувати сирі нотатки майстра або виділити квести",
		example: "@notes перетвори останні абзаци на список зачіпок для партії",
		category: "scene",
	},
	{
		command: "@rules",
		name: "Правила D&D 5e",
		description: "Швидка довідка по правилах, заклинаннях чи станах",
		example: "@rules як працює стан 'Ошелешений' (Stunned) і перевірки концентрації?",
		category: "system",
	},
	{
		command: "@dice",
		name: "Кидки дайсів",
		description: "Зробити приховані або сюжетні перевірки навичок/спаскидків",
		example: "@dice кинь 3d6+2 на випадкову зустріч у нічному лісі",
		category: "system",
	},
];
