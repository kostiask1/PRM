export type DemoCampaignLanguage = "en" | "uk";

export interface DemoCampaignNote {
	title: string;
	text: string;
}

export interface DemoCampaignPerson {
	firstName: string;
	lastName: string;
	race: string;
	class: string;
	level: number;
	motivation: string;
	trait: string;
	notes: DemoCampaignNote[];
}

export interface DemoCampaignLocation {
	name: string;
	description: string;
	notes: DemoCampaignNote[];
}

export interface DemoCampaignScene {
	summary: string;
	goal: string;
	stakes: string;
	location: string;
	notes: DemoCampaignNote[];
	hasEncounter: boolean;
}

export interface DemoCampaignContent {
	campaignName: string;
	description: string;
	notes: DemoCampaignNote[];
	characters: DemoCampaignPerson[];
	npc: DemoCampaignPerson[];
	locations: DemoCampaignLocation[];
	session: {
		name: string;
		scenes: DemoCampaignScene[];
		notes: DemoCampaignNote[];
	};
	encounter: {
		name: string;
		goblinName: string;
		goblinBossName: string;
		heroNames: [string, string];
	};
}

const mention = (name: string) => `[${name}]`;

const EN_NAMES = {
	hero1: "Durin Ironbrow",
	hero2: "Lyra Dawnwhisper",
	employer: "Orsa Brindlewick",
	captive: "Aldric Vane",
	boss: "Grisk Redtooth",
	village: "Harrowford",
	cave: "Ashfang Cave",
	faction: "Ashfang Raiders",
};

const UK_NAMES = {
	hero1: "Дурін Залізобрий",
	hero2: "Ліра Шепіт Зорі",
	employer: "Орса Бріндлвік",
	captive: "Алдрік Вейн",
	boss: "Гріск Червоний Зуб",
	village: "Гарровфорд",
	cave: "Печера Попелястого Ікла",
	faction: "Рейдери Попелястого Ікла",
};

function buildEnglishContent(): DemoCampaignContent {
	const n = EN_NAMES;
	return {
		campaignName: "Ambush on the Amber Road",
		description: `A short starter adventure for two level 1 heroes. The halfling merchant ${mention(n.employer)} hired ${mention(n.hero1)} and ${mention(n.hero2)} to escort a wagon of supplies to the frontier village of ${mention(n.village)}.\n\nOn the road, the wagon was ambushed by the ${mention(n.faction)}, and ${mention(n.captive)}, the caravan guard, was dragged away to ${mention(n.cave)}.\n\n*Click any name in square brackets to open its card. Type the same square brackets in your own notes to link them.*`,
		notes: [
			{
				title: "How to use this demo",
				text: `- Open the **Characters**, **NPC**, and **Locations** sections to see ready-made cards.\n- Open the session below to see scenes with a goal, stakes, and a combat encounter.\n- Press **Ctrl+K** in a text field to link a character, NPC, or location.\n- Press **Ctrl+B** for the bestiary, **Ctrl+S** for spells, and **Ctrl+D** for dice.\n- You can delete this campaign at any time.`,
			},
			{
				title: "Rumors",
				text: `- The ${mention(n.faction)} used to be tame, but now someone gives them orders.\n- ${mention(n.employer)} refuses to say what is inside the third crate.`,
			},
		],
		characters: [
			{
				firstName: "Durin",
				lastName: "Ironbrow",
				race: "Dwarf",
				class: "Fighter",
				level: 1,
				motivation: "Earn enough gold to rebuild the family forge.",
				trait: "Stubborn and loyal. Never leaves a companion behind.",
				notes: [],
			},
			{
				firstName: "Lyra",
				lastName: "Dawnwhisper",
				race: "Elf",
				class: "Wizard",
				level: 1,
				motivation: `Find the ancient library rumored to lie beyond ${mention(n.village)}.`,
				trait: "Curious and quick-witted. Talks to her spellbook when nervous.",
				notes: [],
			},
		],
		npc: [
			{
				firstName: "Orsa",
				lastName: "Brindlewick",
				race: "Halfling",
				class: "Merchant",
				level: 1,
				motivation: "Deliver the cargo to the village before the first snow.",
				trait: `Cheerful but evasive about the cargo. She will pay well if ${mention(n.captive)} is rescued.`,
				notes: [],
			},
			{
				firstName: "Aldric",
				lastName: "Vane",
				race: "Human",
				class: "Knight",
				level: 3,
				motivation: "Survive captivity and warn the village.",
				trait: `A veteran guard held prisoner in ${mention(n.cave)}. He knows who commands the raiders.`,
				notes: [],
			},
			{
				firstName: "Grisk",
				lastName: "Redtooth",
				race: "Goblin",
				class: "Boss",
				level: 1,
				motivation: "Impress the new master of the raiders.",
				trait: `Boastful bully who leads the ${mention(n.faction)}. Flees when the fight turns against him.`,
				notes: [],
			},
		],
		locations: [
			{
				name: "Harrowford",
				description: `A small frontier village of miners and farmers at the end of the road. ${mention(n.employer)} expects her cargo here.`,
				notes: [
					{
						title: "",
						text: "- The inn is called the Copper Kettle.\n- The mayor is nervous about the missing caravans.",
					},
				],
			},
			{
				name: "Ashfang Cave",
				description: `A damp cave in the hills, home of the ${mention(n.faction)}. ${mention(n.captive)} is held in the deepest chamber.`,
				notes: [
					{
						title: "",
						text: "- Two sentries watch the entrance.\n- A narrow stream leads to the back chamber.",
					},
				],
			},
			{
				name: "Ashfang Raiders",
				description: `A goblin raiding band led by ${mention(n.boss)}. It is a faction card, so it lives with the locations.`,
				notes: [],
			},
		],
		session: {
			name: "Session 1 - Tracks on the Road",
			notes: [
				{
					title: "Preparation",
					text: "Read the scenes in order. The combat in scene 2 is already prepared in the encounter tracker.",
				},
			],
			scenes: [
				{
					summary: `The wagon stands abandoned on the Amber Road. The horses are gone, and drag marks lead into the trees. ${mention(n.employer)} insists on searching the crates.`,
					goal: "Investigate the wagon and find the trail.",
					stakes: `If the heroes linger, the raiders reach ${mention(n.cave)} with their captive.`,
					location: "The Amber Road",
					notes: [
						{
							title: "Checks",
							text: "- Survival DC 12: follow the tracks.\n- Investigation DC 10: the crates were opened from the inside.",
						},
					],
					hasEncounter: false,
				},
				{
					summary: `Goblins leap from the bushes. ${mention(n.boss)} shouts orders from behind a fallen log while his archers fire from above.`,
					goal: "Survive the ambush and defeat or drive off the goblins.",
					stakes: "A lost fight means losing the cargo and the trail.",
					location: "A wooded bend of the road",
					notes: [
						{
							title: "Tactics",
							text: "The archers retreat if the boss falls. Open the encounter to run initiative and track HP.",
						},
					],
					hasEncounter: true,
				},
				{
					summary: `A wounded goblin points toward ${mention(n.cave)}. Beyond the next hill, smoke rises from the cave mouth.`,
					goal: `Learn who commands the ${mention(n.faction)} and decide how to reach ${mention(n.captive)}.`,
					stakes: "Rushing in alerts the sentries, while waiting gives the captors time.",
					location: "The foot of the hills",
					notes: [],
					hasEncounter: false,
				},
			],
		},
		encounter: {
			name: "Goblin ambush",
			goblinName: "Goblin",
			goblinBossName: "Goblin Boss",
			heroNames: [`${n.hero1}`, `${n.hero2}`],
		},
	};
}

function buildUkrainianContent(): DemoCampaignContent {
	const n = UK_NAMES;
	return {
		campaignName: "Засідка на Бурштиновому шляху",
		description: `Коротка стартова пригода для двох героїв 1 рівня. Торговка-гобіт ${mention(n.employer)} найняла ${mention(n.hero1)} та ${mention(n.hero2)}, щоб ті супроводили віз із припасами до прикордонного села ${mention(n.village)}.\n\nПо дорозі на віз напали ${mention(n.faction)}, а охоронця каравану ${mention(n.captive)} потягли до ${mention(n.cave)}.\n\n*Натисніть на будь-яке ім'я в квадратних дужках, щоб відкрити його картку. Пишіть такі самі квадратні дужки у власних нотатках, щоб створювати посилання.*`,
		notes: [
			{
				title: "Як користуватися демо",
				text: `- Відкрийте розділи **Персонажі**, **NPC** та **Локації**, щоб побачити готові картки.\n- Відкрийте сесію нижче: там сцени з метою, ставками та бойовим енкаунтером.\n- Натисніть **Ctrl+K** у текстовому полі, щоб додати посилання на персонажа, NPC чи локацію.\n- **Ctrl+B** відкриває бестіарій, **Ctrl+S** заклинання, **Ctrl+D** кубики.\n- Цю кампанію можна видалити будь-коли.`,
			},
			{
				title: "Чутки",
				text: `- ${mention(n.faction)} раніше були безпечними, а тепер хтось ними керує.\n- ${mention(n.employer)} відмовляється казати, що лежить у третьому ящику.`,
			},
		],
		characters: [
			{
				firstName: "Дурін",
				lastName: "Залізобрий",
				race: "Дворф",
				class: "Воїн",
				level: 1,
				motivation: "Заробити достатньо золота, щоб відновити родинну кузню.",
				trait: "Впертий і вірний. Ніколи не залишає товаришів.",
				notes: [],
			},
			{
				firstName: "Ліра",
				lastName: "Шепіт Зорі",
				race: "Ельф",
				class: "Чарівник",
				level: 1,
				motivation: `Знайти давню бібліотеку, що, за чутками, лежить за ${mention(n.village)}.`,
				trait: "Допитлива й кмітлива. Коли нервує, розмовляє зі своєю книгою заклять.",
				notes: [],
			},
		],
		npc: [
			{
				firstName: "Орса",
				lastName: "Бріндлвік",
				race: "Гобіт",
				class: "Торговка",
				level: 1,
				motivation: "Доставити вантаж у село до першого снігу.",
				trait: `Життєрадісна, але ухильна щодо вантажу. Добре заплатить, якщо ${mention(n.captive)} буде врятований.`,
				notes: [],
			},
			{
				firstName: "Алдрік",
				lastName: "Вейн",
				race: "Людина",
				class: "Лицар",
				level: 3,
				motivation: "Пережити полон і попередити село.",
				trait: `Ветеран-охоронець, ув'язнений у ${mention(n.cave)}. Знає, хто командує рейдерами.`,
				notes: [],
			},
			{
				firstName: "Гріск",
				lastName: "Червоний Зуб",
				race: "Гоблін",
				class: "Ватажок",
				level: 1,
				motivation: "Справити враження на нового господаря рейдерів.",
				trait: `Хвальковитий хуліган, що очолює ${mention(n.faction)}. Тікає, коли бій іде не на його користь.`,
				notes: [],
			},
		],
		locations: [
			{
				name: "Гарровфорд",
				description: `Невелике прикордонне село шахтарів і фермерів наприкінці дороги. Тут на вантаж чекає ${mention(n.employer)}.`,
				notes: [
					{
						title: "",
						text: "- Корчма називається «Мідний чайник».\n- Староста нервує через зниклі каравани.",
					},
				],
			},
			{
				name: "Печера Попелястого Ікла",
				description: `Волога печера в пагорбах, лігво рейдерів із ${mention(n.faction)}. ${mention(n.captive)} утримують у найглибшій залі.`,
				notes: [
					{
						title: "",
						text: "- Вхід охороняють двоє вартових.\n- Вузький струмок веде до задньої зали.",
					},
				],
			},
			{
				name: "Рейдери Попелястого Ікла",
				description: `Банда гоблінів-розбійників на чолі з ${mention(n.boss)}. Це картка фракції, тому вона лежить разом із локаціями.`,
				notes: [],
			},
		],
		session: {
			name: "Сесія 1 - Сліди на дорозі",
			notes: [
				{
					title: "Підготовка",
					text: "Читайте сцени по порядку. Бій у сцені 2 уже підготовлено в трекері енкаунтера.",
				},
			],
			scenes: [
				{
					summary: `Віз покинуто на Бурштиновому шляху. Коней немає, а сліди волочіння ведуть у ліс. ${mention(n.employer)} наполягає, щоб обшукали ящики.`,
					goal: "Дослідити віз і знайти слід.",
					stakes: `Якщо герої забарються, рейдери дістануть бранця до ${mention(n.cave)}.`,
					location: "Бурштиновий шлях",
					notes: [
						{
							title: "Перевірки",
							text: "- Виживання КС 12: піти за слідами.\n- Розслідування КС 10: ящики відкривали зсередини.",
						},
					],
					hasEncounter: false,
				},
				{
					summary: `Гобліни вистрибують із кущів. ${mention(n.boss)} віддає накази з-за повалених колод, а лучники стріляють згори.`,
					goal: "Пережити засідку та перемогти або відігнати гоблінів.",
					stakes: "Програш у бою означає втрату вантажу та сліду.",
					location: "Лісовий поворот дороги",
					notes: [
						{
							title: "Тактика",
							text: "Лучники відступають, якщо ватажок падає. Відкрийте енкаунтер, щоб вести ініціативу та HP.",
						},
					],
					hasEncounter: true,
				},
				{
					summary: `Поранений гоблін показує в бік ${mention(n.cave)}. За наступним пагорбом із входу в печеру здіймається дим.`,
					goal: `Дізнатися, хто командує ${mention(n.faction)}, і вирішити, як дістатися до ${mention(n.captive)}.`,
					stakes: "Поспіх насторожить вартових, а зволікання дасть час викрадачам.",
					location: "Підніжжя пагорбів",
					notes: [],
					hasEncounter: false,
				},
			],
		},
		encounter: {
			name: "Гоблінська засідка",
			goblinName: "Гоблін",
			goblinBossName: "Ватажок гоблінів",
			heroNames: [`${n.hero1}`, `${n.hero2}`],
		},
	};
}

export function resolveDemoCampaignLanguage(
	language: string | null | undefined,
): DemoCampaignLanguage {
	return String(language || "").toLowerCase() === "uk" ? "uk" : "en";
}

export function getDemoCampaignContent(
	language: string | null | undefined,
): DemoCampaignContent {
	return resolveDemoCampaignLanguage(language) === "uk"
		? buildUkrainianContent()
		: buildEnglishContent();
}
