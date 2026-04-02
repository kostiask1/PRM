const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const systemInstructions = {
	campaign: `Ти досвідчений майстер підземель (Dungeon Master) для Dungeons & Dragons. 
        Твоя мета - допомагати в плануванні сесій. Відповідай виключно українською мовою. 
        Твої відповіді мають бути структурованими, читабельними та корисними для гри. 
        Використовувати Markdown-розмітку (наприклад, жирний текст **текст**, марковані списки, розбиття рядку) для структурування тексту всередині значень JSON.
        Завжди відповідай у форматі JSON. Не включай жодного тексту до або після JSON. 
        JSON повинен містити лише згенеровані дані, без додаткових пояснень. 
        Використовуй структуру { "description": "...", "notes": ["Заголовок\\nДеталі замітки...", ...], "characters": [{name: "...", "description": "..."}, ...] }. Кожна замітка в масиві notes повинна бути цілісним логічним блоком: перший рядок — це короткий заголовок, а наступні рядки — основний зміст. Не генеруй поле "scenes" для кампанії.
        `,
	scene: `Ти досвідчений майстер підземель (Dungeon Master) для Dungeons & Dragons. 
        Твоя мета - допомагати в плануванні сесій. Відповідай виключно українською мовою. 
        Твої відповіді мають бути структурованими, читабельними та корисними для гри. 
        Використовувати Markdown-розмітку (наприклад, жирний текст **текст**, марковані списки, розбиття рядку) для структурування тексту всередині значень JSON.
        Завжди відповідай у форматі JSON. Не включай жодного тексту до або після JSON. 
        JSON повинен містити лише згенеровані дані, без додаткових пояснень. 
        Коли генеруєш сцени, враховуй дані в ключі encounters, використовуй структуру { "scenes": [{ "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "...", "clues": "..." }, "npcs": [{"name": "...", "description": "..."}, ...] }, ...] }.
        `,
	prompt: `Ти досвідчений майстер підземель (Dungeon Master) для Dungeons & Dragons. 
        Твоя мета - допомагати в плануванні іншому майстру. Відповідай виключно українською мовою. 
        Ти отримуєш дані та інструкцію користувача.
        Проаналізуй дані самостійно, повністю виконай інструкцію, навіть якщо дані неповні або неоднозначні.
        У таких випадках зроби найбільш логічні припущення.

        НЕ СТАВ ЖОДНИХ УТОЧНЮЮЧИХ ЗАПИТАНЬ. НЕ ДАВАЙ ПОРАД ЯКЩО НЕ ПРОСИВ.
        НЕ ЗВЕРТАЙ УВАГУ НА ПОРОЖНІ ДАНІ, ОПЕРУЙ ТИМ ЩО Є.

        Сформуй відповідь виключно як звичайний текст для людини.
        КАТЕГОРИЧНО ЗАБОРОНЕНО:
        - повертати JSON
        - використовувати ключі, дужки {}, []
        - показувати структуру даних

        Виводь фінальний результат у вигляді зв’язного, природного людьского тексту, ніби це звичайна розповідь або відповідь.
        У відповіді необхідно використовувати Markdown розмітку.
`,
	image: `Ти — генератор детальних промптів для створення зображень сцен.
                    Користувач надсилає дані у форматі JSON з такими ключами:

                    Ключі сцени (вищий пріоритет)
                    summary — короткий опис того, що відбувається в сцені
                    goal — мета персонажа(ів) у сцені
                    stakes — що поставлено на кону, небезпека, ризик
                    location — місце подій
                    npcs — NPC або персонажі у сцені
                    clues — підказки, важливі предмети, деталі
                    Загальні ключі (нижчий пріоритет)
                    notes — додаткові нотатки
                    description — загальний опис світу, сюжету, атмосфери.

                    На основі отриманих даних згенерувати детальний промпт для створення зображення сцени.
                    Промпт має бути англійською мовою.
                    Не описуй JSON — пиши лише фінальний промпт для генерації зображення.
                    Виводь тільки готовий промпт, без пояснень, без JSON, без списків.

                    При генерації промпта описуй сцену в такому порядку:

                    Загальний план сцени
                    Локація та оточення
                    Персонажі та їх дії
                    Важливі предмети / clues
                    Освітлення
                    Атмосфера
                    Стиль (cinematic, photorealistic, concept art, etc.)

                    Стиль за замовчуванням (додавати в кінець промпта) - cinematic, photorealistic, ultra realistic, high detail, 8k, dramatic lighting, volumetric light, sharp focus, depth of field, film still, concept art
                    Ось вхідні дані у вигляді JSON: 
                    `,
};

async function generateContent({
	type,
	session,
	campaign,
	userInstructions,
	sceneId,
	parseAIResponse,
	results,
	useContext,
}) {
	let model;
	let userPrompt = "";

	const useKey = type
		? type
		: !parseAIResponse
			? "prompt"
			: session
				? "scene"
				: "campaign";

	model = genAI.getGenerativeModel({
		model: "gemini-2.5-flash",
		generationConfig: {
			responseMimeType: "application/json",
		},
		systemInstruction: systemInstructions[useKey],
	});

	if (useContext) {
		const campaignData = {
			name: campaign.name,
			description: campaign.description || "",
			notes: campaign.notes?.map((n) => n.text) || [],
			characters: campaign.characters || [],
			results,
		};

		let dataSummary = campaignData;

		if (session) {
			dataSummary.name = session.name;
			dataSummary.scenes = session.data.scenes || [];
			dataSummary.encounters =
				session.data.encounters?.map((e) => ({
					id: e.id,
					name: e.name,
					participants: e.monsters?.map((p) => p.name) || [],
				})) || [];
		}

		dataSummary = JSON.stringify(dataSummary);

		if (useKey === "image") {
			userPrompt = dataSummary;

			userPrompt += `\nНадай головний пріорітет до scene.id ${sceneId}. Промпт повинен стосуватись саме її, проте інші дані можуть краще її доповнити (інформація чи опис NPC і персонажів, локація)`;
		} else if (useKey === "prompt") {
			userPrompt = `\nКампанія "${campaign.name}" ${campaign.description ? "- " + campaign.description : ""}:
        Замітки - ${(campaign.notes?.map((n) => n.text) || []).join("\n") || "відсутні"},
        Персонажі - ${
					campaign.characters
						?.map(
							(character) =>
								`\n
            Ім'я - ${character.name},
             Опис - ${character.description || "відсутній"}`,
						)
						.join(", ") || "відсутні"
				}.`;

			if (session) {
				userPrompt += `\nПоточна сесія "${session.name}".
            Сцени: ${
							session.data?.scenes
								?.map(
									(scene, index) =>
										`\n
                    Сцена №${index + 1}:
                        - Суть сцени: ${scene.texts.summary}
                        - Мета гравців: ${scene.texts.goal}
                        - Ставки: ${scene.texts.stakes}
                        - Локація: ${scene.texts.location}
                        - Підказки: ${scene.texts.clues}
                        - Бій проти ворогів: ${
													session.data?.encounters
														?.find(
															(encounter) => encounter.id === scene.encounterId,
														)
														?.monsters?.map((monster) => monster.name)
														.join(", ") || "відсутні"
												}
                `,
								)
								.join(", ") || "відсутні"
						}`;
			}
		} else {
			if (session) {
				userPrompt = `На основі цієї сесії "${session.name}" та даних: <${dataSummary}>, запропонуй ідеї для нових (або доповни існуючі, залежно від подальших вказівок) цікавих сцен (соціальних, бойових або дослідницьких).`;
			} else {
				userPrompt = `На основі назви кампанії "${campaign.name}" та поточного сюжету: <${campaign.description || "відсутній"}>, допоможи розвинути основну лінію та структурувати замітки. Враховуй існуючі замітки: notes <${JSON.stringify(campaign.notes?.map((n) => n.text) || [])}>, а також опису персонажів гравців: characters <${JSON.stringify(campaign.characters || [])}>. Твоє завдання - оновити опис сюжету (поле description) та надати список цілісних логічних заміток (поле notes) у вигляді масиву рядків. У кожній замітці перший рядок — це короткий заголовок, а далі — розгорнутий запис. Не генеруй жодних сцен.`;
			}
		}

		if (useKey !== "image" && results && results.length > 0) {
			userPrompt += `\nТакож врахуй результати усіх сесій кампанії: ${results
				?.filter((session) => !!session.result)
				.map((session) => `Сесія "${session.session}" - ${session.result}`)
				.join("\n")}`;
		}
	}

	if (userInstructions) {
		userPrompt += `\nДодаткові побажання та контекст від користувача. Надай наступному тексту більше уваги: ${userInstructions}`;
	}

	const result = await model.generateContent(userPrompt);
	const response = await result.response;
	let text = response.text();

	if (!parseAIResponse) {
		return text;
	}

	try {
		// Очищення від можливих markdown-тегів, якщо вони проскочили
		const cleanJson = text
			.replace(/```json/g, "")
			.replace(/```/g, "")
			.trim();

		return JSON.parse(cleanJson);
	} catch (e) {
		if (!parseAIResponse && e.message.includes("JSON.parse")) {
			return text;
		}

		console.error("Failed to parse AI response as JSON:", text, e);
		// Якщо парсинг не вдався, повертаємо структуровану помилку
		return {
			error: "AI повернув некоректний JSON. Спробуйте ще раз.",
			raw_response: text,
		};
	}
}

module.exports = { generateContent };
