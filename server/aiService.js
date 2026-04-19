const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const systemInstructions = {
	campaign: `Ти досвідчений майстер підземель (Dungeon Master) для Dungeons & Dragons. 
        Твоя мета - допомагати в плануванні сесій. Відповідай виключно українською мовою. 
        Твої відповіді мають бути структурованими, читабельними та корисними для гри. 
        Використовувати Markdown-розмітку (наприклад, жирний текст **текст**, марковані списки, розбиття рядку) для структурування тексту всередині значень JSON.
        Завжди відповідай у форматі JSON. Не включай жодного тексту до або після JSON. 
        JSON повинен містити лише згенеровані дані, без додаткових пояснень. 
        Використовуй структуру { "description": "...", "notes": ["Заголовок\nДеталі замітки...", ...], "characters": [{name: "...", "description": "..."}, ...] }. Кожна замітка в масиві notes повинна бути цілісним логічним блоком: перший рядок — це короткий заголовок, а наступні рядки — основний зміст. Не генеруй поле "scenes" для кампанії.
        `,
	scene: `Ти досвідчений майстер підземель (Dungeon Master) для Dungeons & Dragons. 
        Твоя мета - допомагати в плануванні сесій. Відповідай виключно українською мовою. 
        Твої відповіді мають бути структурованими, читабельними та корисними для гри. 
        Використовувати Markdown-розмітку (наприклад, жирний текст **текст**, марковані списки, розбиття рядку) для структурування тексту всередині значень JSON.
        Завжди відповідай у форматі JSON. Не включай жодного тексту до або після JSON. 
        JSON повинен містити лише згенеровані дані, без додаткових пояснень. 
        Коли генеруєш сцени, враховуй дані в ключі encounters, використовуй структуру { "scenes": [{ "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." }, "npcs": [{"name": "...", "description": "..."}, ...] }, ...] }.
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
	contextData,
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

	// Формуємо основний блок даних у форматі JSON
	const contextJson = {
		campaign: {
			name: campaign.name,
			description: campaign.description,
			notes: contextData?.campaign?.notes,
			characters: contextData?.campaign?.characters,
		},
		currentSession: session ? {
			name: session.name,
			scenes: session.data?.scenes,
			result_text: session.data?.result_text
		} : null,
		selectedContext: contextData?.sessions
	};

	userPrompt = `ВХІДНІ ДАНІ (JSON):\n${JSON.stringify(contextJson, null, 2)}\n\n`;

	// Додаємо специфічні інструкції залежно від типу задачі
	if (useKey === "image") {
		userPrompt += `ЗАДАЧА: Згенерувати промпт для сцени з ID: ${sceneId}\n`;
	} else if (useKey === "scene") {
		userPrompt += `ЗАДАЧА: На основі поточної сесії та контексту, запропонуй ідеї для нових або доповни існуючі сцени.\n`;
	} else if (useKey === "campaign") {
		userPrompt += `ЗАДАЧА: Онови опис сюжету та структуруй замітки кампанії.\n`;
	}

	if (userInstructions) {
		userPrompt += `ІНСТРУКЦІЯ КОРИСТУВАЧА (ПРІОРІТЕТ): ${userInstructions}\n`;
	}

	const result = await model.generateContent(userPrompt);
	const response = await result.response;
	let text = response.text();

	// Допоміжна функція для рекурсивного виправлення екранованих символів переносу (\\n -> \n)
	const fixNewLines = (val) => {
		if (typeof val === "string") return val.replace(/\\n/g, "\n");
		if (Array.isArray(val)) return val.map(fixNewLines);
		if (val && typeof val === "object") {
			const next = {};
			for (const key in val) next[key] = fixNewLines(val[key]);
			return next;
		}
		return val;
	};

	if (!parseAIResponse) {
		return text.replace(/\\n/g, "\n");
	}

	try {
		// Очищення від можливих markdown-тегів, якщо вони проскочили
		const cleanJson = text
			.replace(/```json/g, "")
			.replace(/```/g, "")
			.trim();

		return fixNewLines(JSON.parse(cleanJson));
	} catch (e) {
		console.error("Failed to parse AI response as JSON:", text, e);
		// Якщо парсинг не вдався, повертаємо структуровану помилку
		return {
			error: "AI повернув некоректний JSON. Спробуйте ще раз.",
			raw_response: text.replace(/\\n/g, "\n"),
		};
	}
}

module.exports = { generateContent };
