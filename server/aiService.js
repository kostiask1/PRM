const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log('process.env.GEMINI_API_KEY:', process.env.GEMINI_API_KEY)

async function generateContent(type, sessionName, sessionData, userInstructions, generateWithReplace) {
    let model;
    let userPrompt = "";

    if (type === "image_prompt") {
        model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            },
            systemInstruction: `Ти — генератор детальних промптів для створення зображень сцен.
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
                    `
        });

        const dataSummary = JSON.stringify({
            name: sessionName,
            description: sessionData.description || '',
            notes: sessionData.notes?.map(n => n.text) || [],
            scenes: sessionData.scenes?.map(s => s.texts) || [],
            encounters: sessionData.encounters?.map(e => ({
                name: e.name,
                participants: e.monsters?.map(p => p.name) || [],
            })) || []
        });

        userPrompt = dataSummary;
    } else {
        model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            },
            systemInstruction: `Ти досвідчений майстер підземель (Dungeon Master) для Dungeons & Dragons. 
        Твоя мета - допомагати в плануванні сесій. Відповідай виключно українською мовою. 
        Твої відповіді мають бути структурованими, читабельними та корисними для гри. 
        Ти можеш використовувати стандартну Markdown-розмітку (наприклад, жирний текст **текст**, марковані списки) для структурування тексту всередині значень JSON.
        Завжди відповідай у форматі JSON. Не включай жодного тексту до або після JSON. 
        JSON повинен містити лише згенеровані дані, без додаткових пояснень. 
        Якщо ти враховуєш encounters (бойові сцени), НЕ редагуй дані encounters
        Якщо ти генеруєш сцени, використовуй структуру { "scenes": [{ "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "...", "npcs": "...", "clues": "..." } }, ...] }.
        Якщо ти генеруєш NPC, використовуй структуру { "npcs": [{ "name": "...", "role": "...", "trait": "...", "secret": "..." }, ...] }.
        Якщо ти генеруєш сюжетні повороти, використовуй структуру { "plot_twists": ["...", "..."] }.
        Якщо ти генеруєш сюжет кампанії, використовуй структуру { "description": "...", "notes": ["Заголовок\\nДеталі замітки...", ...] }. Кожна замітка в масиві notes повинна бути цілісним логічним блоком: перший рядок — це короткий заголовок, а наступні рядки — основний зміст. Не генеруй поле "scenes" для кампанії.`
        });

        // Мінімізуємо дані сесії, щоб не перевантажувати контекст
        // Відправляємо лише текстові частини сцен для контексту
        const dataSummary = JSON.stringify({
            name: sessionName,
            description: sessionData.description || '',
            notes: sessionData.notes?.map(n => n.text) || [],
            scenes: sessionData.scenes?.map(s => s.texts) || [],
            encounters: sessionData.encounters?.map(e => ({
                name: e.name,
                participants: e.monsters?.map(p => p.name) || [],
            })) || []
        });


        switch (type) {
            case 'campaign_plot':
                userPrompt = `На основі назви кампанії "${sessionName}" та поточного сюжету: ${sessionData.description || 'відсутній'}, допоможи розвинути основну лінію та структурувати замітки. Враховуй існуючі замітки: ${JSON.stringify(sessionData.notes?.map(n => n.text) || [])}. Твоє завдання - оновити опис сюжету (поле description) та надати список цілісних логічних заміток (поле notes) у вигляді масиву рядків. У кожній замітці перший рядок — це короткий заголовок, а далі — розгорнутий запис. Не генеруй жодних сцен.`;
                break;
            case 'scene_ideas':
                userPrompt = `На основі цієї сесії "${sessionName}" та даних: ${dataSummary}, запропонуй ідеї для нових (або доповни існуючі, залежно від подальших вказівок) цікавих сцен (соціальних, бойових або дослідницьких).`;
                break;
            case 'npc_ideas':
                userPrompt = `На основі цієї сесії "${sessionName}" та даних: ${dataSummary}, створи (або допрацюй, залежно від подальших вказівок) NPC (ім'я, роль, характерна риса, таємниця).`;
                break;
            case 'plot_twists':
                userPrompt = `На основі цієї сесії "${sessionName}" та даних: ${dataSummary}, придумай варіанти несподіваного сюжетного повороту.`;
                break;
            default:
                userPrompt = `Допоможи мені з плануванням сесії "${sessionName}". Дані: ${dataSummary}`;
        }

        if (generateWithReplace) {
            userPrompt += `\n\nГенеруй нові дані, із заміною (або доповненням) існуючих.
        Якщо це сцени, створи нові сцени або заміни існуючі.
        Якщо це NPC, створи нових NPC або заміни існуючих.
        Якщо це сюжетні повороти, створи нові повороти або заміни існуючі.
        Не залишай старі дані без змін, якщо вони не відповідають новому генерованому контенту.`;
        }

        if (userInstructions) {
            userPrompt += `\n\nДодаткові побажання та контекст від користувача. Надай наступному тексту більше уваги: ${userInstructions}`;
        }
    }

    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    let text = response.text();

    try {
        // Очищення від можливих markdown-тегів, якщо вони проскочили
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("Failed to parse AI response as JSON:", text, e);
        // Якщо парсинг не вдався, повертаємо структуровану помилку
        return { error: "AI повернув некоректний JSON. Спробуйте ще раз.", raw_response: text };
    }
}

module.exports = { generateContent };