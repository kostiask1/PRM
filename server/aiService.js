const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function noteToPromptText(note) {
	if (!note) return "";
	if (typeof note === "string") return note.trim();
	const title = String(note.title || "").trim();
	const text = String(note.text || "").trim();
	return [title, text].filter(Boolean).join("\n");
}

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
        Коли генеруєш сцени, використовуй структуру { "scenes": [{ "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "..." }, "notes": ["Коротка замітка 1", "Коротка замітка 2"], "npcs": [{"name": "...", "description": "..."}, ...], "encounterIndex": 0 }, ...], "encounters": [{ "name": "Назва бою", "monsters": [{ "monsterName": "Official D&D Monster Name", "name": "Опціональне ім'я" }] }] }.
        Поле encounterIndex у сцені повинно вказувати на індекс у масиві encounters, якщо для цієї сцени потрібен бій. 
        Якщо бій не потрібен, не додавай encounterIndex.
        Підбирай монстрів згідно з рівнем та кількістю персонажів гравців у контексті, щоб складність була доречною.
        Якщо в інструкціях користувача вказано рівень складності (легкий, смертельний тощо), суворо дотримуйся його.
`,
	encounter: `Ти досвідчений майстер підземель (Dungeon Master) для Dungeons & Dragons 5e. 
        Твоя мета - допомагати в наповненні конкретного бойового зіткнення. Відповідай виключно українською мовою. 
        Твої відповіді мають бути структурованими та корисними для гри. 
        Використовувати Markdown-розмітку (наприклад, жирний текст **текст**, марковані списки, розбиття рядку) для структурування тексту всередині значень JSON.
        Завжди відповідай у форматі JSON. Не включай жодного тексту до або після JSON. 
        JSON повинен містити структуру: { "name": "Назва бою", "monsters": [{ "monsterName": "Official D&D Monster Name", "name": "Опціональне ім'я" }] }.
        
        ПРАВИЛА БАЛАНСУ ТА СКЛАДНОСТІ:
        1. Проаналізуй масив characters: їхню кількість та рівні.
        2. Визнач складність на основі ІНСТРУКЦІЇ КОРИСТУВАЧА. Якщо складності не вказано, роби "середній" бій.
        3. Складність за шкалою D&D 5e:
           - Легка: Група майже не витратить ресурсів.
           - Середня: Гравці витратять кілька заклинань або отримають невелику шкоду.
           - Важка: Є реальний ризик, що хтось із героїв впаде без свідомості.
           - Смертельна: Високий ризик загибелі одного або кількох персонажів.
        4. Враховуй "Економіку дій": один сильний монстр (Boss) проти 4-5 гравців часто слабший за групу слабших монстрів.
        5. Якщо надано currentEncounter, ти можеш додати до нього монстрів або повністю замінити склад, якщо того вимагає інструкція.
        6. Назви монстрів у monsterName ПОВИННІ бути англійською (як в офіційному бестіарії).
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
	encounterId,
	sceneId,
	parseAIResponse,
	contextData,
	generateEncounters,
}) {
	let model;
	let userPrompt = "";

	const useKey = type
		? type
		: !parseAIResponse
			? "prompt"
			: encounterId
				? "encounter"
				: session
					? "scene"
					: "campaign";

	model = genAI.getGenerativeModel({
		// model: "gemini-2.5-flash",
		model: "gemini-3.1-flash-lite-preview",
		generationConfig: {
			responseMimeType: "application/json",
		},
		systemInstruction: systemInstructions[useKey],
	});

	// 1. Гнучка фільтрація сесій згідно з налаштованим контекстом
	const filteredSessions = (contextData?.sessions || []).map(s => {
		const sessionContext = { name: s.name };
		const conf = s.conf || {};
		const data = s.data || {};

		// Додаємо нотатки, якщо обрано
		if (conf.included && conf.notes && data.notes) {
			sessionContext.notes = data.notes
				.map(noteToPromptText)
				.filter(t => t && t.trim() !== "");
		}
		
		// Додаємо результат сесії, якщо обрано
		if (conf.included && conf.result_text && data.result_text) {
			sessionContext.result = data.result_text;
		}

		// Додаємо лише вибрані сцени та їх конкретні поля
		if (conf.included && conf.scenes && data.scenes) {
			const sceneFields = ["summary", "goal", "stakes", "location", "encounter", "notes"];
			const filteredScenes = data.scenes.filter(scene => {
				return conf.scenes[scene.id]?.included;
			}).map(scene => {
				const sceneConf = conf.scenes[scene.id];
				const resultScene = {};
				
				// Якщо обрано енкаунтер, шукаємо імена монстрів
				if (sceneConf.encounter && scene.encounterId) {
					const encounter = (data.encounters || []).find(e => e.id.toString() === scene.encounterId.toString());
					if (encounter && encounter.monsters) {
						resultScene.monsters = encounter.monsters.map(m => m.name || m.monsterName);
					}
				}

				sceneFields.forEach(field => {
					if (field === "encounter") return; // Вже оброблено вище
					if (field === "notes") {
						if (sceneConf[field]) resultScene[field] = (scene.notes || []).map(noteToPromptText).filter(Boolean);
						return;
					}
					if (sceneConf[field]) resultScene[field] = scene.texts?.[field];
				});
				return resultScene;
			});

			if (filteredScenes.length > 0) {
				sessionContext.scenes = filteredScenes;
			}
		}

		return sessionContext;
	}).filter(s => s.notes || s.result || s.scenes); // Прибираємо сесії без контенту

	// 2. Формуємо фінальний JSON контексту для Gemini
	const contextJson = {
		campaign: {
			name: campaign.name,
			description: campaign.description,
			notes: contextData?.campaign?.notes?.map(noteToPromptText).filter(Boolean),
				characters: contextData?.campaign?.characters?.map(c => ({
					name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name,
					race: c.race,
					class: c.class,
					level: c.level,
					motivation: c.motivation,
					trait: c.trait,
					notes: (c.notes || []).map(noteToPromptText).filter(Boolean),
				})).filter(c => c.name || c.motivation),
			}
		};

	if (filteredSessions.length > 0) {
		contextJson.selectedSessions = filteredSessions;
	}

	// Додаємо дані про поточний бій, якщо ми в режимі Encounter
	if (encounterId && session) {
		const currentEnc = (session.data.encounters || []).find(e => e.id.toString() === encounterId.toString());
		if (currentEnc) {
			contextJson.currentEncounter = {
				name: currentEnc.name,
				monsters: (currentEnc.monsters || []).map(m => ({
					name: m.name,
					monsterName: m.originalBestiaryName || m.name,
					cr: m.cr || m.challenge_rating
				}))
			};
		}
	}

	userPrompt = `ВХІДНІ ДАНІ (JSON):\n${JSON.stringify(contextJson, null, 2)}\n\n`;

	// Додаємо специфічні інструкції залежно від типу задачі
	if (useKey === "image") {
		userPrompt += `ЗАДАЧА: Згенерувати промпт для сцени з ID: ${sceneId}\n`;
	} else if (useKey === "encounter") {
		userPrompt += `ЗАДАЧА: Оновити поточне бойове зіткнення (ID: ${encounterId}). Враховуй рівні персонажів та бажану складність (легка, середня, важка, смертельна). Підбери монстрів, які відповідають ситуації.\n`;
	} else if (useKey === "scene") {
		userPrompt += `ЗАДАЧА: На основі поточної сесії та контексту, запропонуй ідеї для нових або доповни існуючі сцени.\n`;
		if (generateEncounters) {
			userPrompt += `ВАЖЛИВО: Для кожної сцени, де можливий конфлікт, обов'язково згенеруй об'єкт зіткнення (encounter) у масиві encounters. 
            Підбирай монстрів (назви англійською), враховуючи рівні та класи персонажів для балансу.\n`;
		}
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

