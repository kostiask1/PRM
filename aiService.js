const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateContent(type, sessionName, sessionData, userInstructions) {
    const model = genAI.getGenerativeModel({ 
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
        Якщо ти генеруєш сцени, використовуй структуру { "scenes": [{ "texts": { "summary": "...", "goal": "...", "stakes": "...", "location": "...", "npcs": "...", "clues": "..." } }, ...] }.
        Якщо ти генеруєш NPC, використовуй структуру { "npcs": [{ "name": "...", "role": "...", "trait": "...", "secret": "..." }, ...] }.
        Якщо ти генеруєш сюжетні повороти, використовуй структуру { "plot_twists": ["...", "..."] }.
        Якщо ти генеруєш сюжет кампанії, використовуй структуру { "description": "..." }.
        Якщо ти генеруєш підсумок сесії, використовуй структуру { "result_text": "..." }.
        Якщо ти генеруєш наступні кроки, використовуй структуру { "next_steps": ["...", "..."] }.`
    });

    // Мінімізуємо дані сесії, щоб не перевантажувати контекст
    // Відправляємо лише текстові частини сцен для контексту
    const dataSummary = JSON.stringify({
        name: sessionName,
        description: sessionData.description || '',
        notes: sessionData.notes?.map(n => n.text) || [],
        scenes: sessionData.scenes?.map(s => s.texts) || [], 
        result: sessionData.result_text || '',
        encounters: sessionData.encounters?.map(e => e.name) || []
    });

    let userPrompt = "";

    switch (type) {
        case 'campaign_plot':
            userPrompt = `На основі назви кампанії "${sessionName}" та поточного сюжету: ${sessionData.description || 'відсутній'}, допоможи розвинути основну лінію. Враховуй замітки: ${JSON.stringify(sessionData.notes || [])}. Твоє завдання - доповнити або відредагувати існуючий опис відповідно до запиту користувача.`;
            break;
        case 'scene_ideas':
            userPrompt = `На основі цієї сесії "${sessionName}" та даних: ${dataSummary}, запропонуй 3 ідеї для нових цікавих сцен (соціальних, бойових або дослідницьких).`;
            break;
        case 'npc_ideas':
            userPrompt = `На основі цієї сесії "${sessionName}" та даних: ${dataSummary}, створи 2-3 нових унікальних NPC (ім'я, роль, характерна риса, таємниця).`;
            break;
        case 'plot_twists':
            userPrompt = `На основі цієї сесії "${sessionName}" та даних: ${dataSummary}, придумай 2 варіанти несподіваного сюжетного повороту.`;
            break;
        case 'session_recap':
            userPrompt = `На основі цієї сесії "${sessionName}" та даних: ${dataSummary}, напиши атмосферний підсумок подій (recap) для гравців.`;
            break;
        case 'what_next':
            userPrompt = `На основі цієї сесії "${sessionName}" та даних: ${dataSummary}, запропонуй кілька варіантів того, що може статися далі.`;
            break;
        default:
            userPrompt = `Допоможи мені з плануванням сесії "${sessionName}". Дані: ${dataSummary}`;
    }

    if (userInstructions) {
        userPrompt += `\n\nДодаткові побажання та контекст від користувача: ${userInstructions}`;
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