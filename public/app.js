const api = {
    async request(path, options = {}) {
        const response = await fetch(path, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            ...options,
        });

        if (response.status === 204) return null;

        const data = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(data?.error || 'Помилка запиту');
        }
        return data;
    },

    listCampaigns() {
        return this.request('/api/campaigns');
    },

    createCampaign(name) {
        return this.request('/api/campaigns', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    },

    updateCampaign(slug, payload) {
        return this.request(`/api/campaigns/${encodeURIComponent(slug)}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    deleteCampaign(slug) {
        return this.request(`/api/campaigns/${encodeURIComponent(slug)}`, {
            method: 'DELETE',
        });
    },

    listSessions(slug) {
        return this.request(`/api/campaigns/${encodeURIComponent(slug)}/sessions`);
    },

    createSession(slug, name) {
        return this.request(`/api/campaigns/${encodeURIComponent(slug)}/sessions`, {
            method: 'POST',
            body: JSON.stringify(name ? { name } : {}),
        });
    },

    getSession(slug, fileName) {
        return this.request(
            `/api/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`
        );
    },

    updateSession(slug, fileName, payload) {
        return this.request(
            `/api/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`,
            {
                method: 'PATCH',
                body: JSON.stringify(payload),
            }
        );
    },

    deleteSession(slug, fileName) {
        return this.request(
            `/api/campaigns/${encodeURIComponent(slug)}/sessions/${encodeURIComponent(fileName)}`,
            {
                method: 'DELETE',
            }
        );
    },
};

const state = {
    campaigns: [],
    activeCampaign: null,
    sessions: [],
    activeSession: null,
    activeSessionFileName: null,
    sessionDirty: false,
    isSaving: false,
    saveQueued: false,
};

const sceneFieldSchema = [
    {
        key: 'summary',
        title: 'Суть сцени',
        note: 'Що відбувається, у чому напруга, чому це важливо.',
        type: 'textarea',
        placeholder: 'Коротко опиши сцену в кілька рядків.',
    },
    {
        key: 'goal',
        title: 'Мета гравців',
        note: 'Чого персонажі хочуть досягти в цій сцені.',
        type: 'text',
        placeholder: 'Наприклад: дістати ключ, переконати барона, вижити в засідці',
    },
    {
        key: 'stakes',
        title: 'Ставки',
        note: 'Що буде, якщо герої виграють або програють.',
        type: 'textarea',
        placeholder: 'Опиши, що станеться при успіху і при провалі.',
    },
    {
        key: 'location',
        title: 'Локація',
        note: 'Де це відбувається.',
        type: 'text',
        placeholder: 'Наприклад: стара вежа, ринок, катакомби',
    },
    {
        key: 'npcs',
        title: 'NPC / фракції',
        note: 'Хто бере участь у сцені.',
        type: 'textarea',
        placeholder:
            'Наприклад:\nБарон Едмонд — хоче приховати правду.\nШпигун гільдії — стежить за героями.',
    },
    {
        key: 'trigger',
        title: 'Тригер входу',
        note: 'Що запускає цю сцену або як герої в неї потрапляють.',
        type: 'text',
        placeholder: 'Наприклад: лист, засідка, прохання NPC, знайдений слід',
    },
    {
        key: 'obstacles',
        title: 'Перешкоди',
        note: 'Що ускладнює проходження сцени.',
        type: 'textarea',
        placeholder: 'Опиши ворогів, пастки, таймер, соціальний тиск або інші проблеми.',
    },
    {
        key: 'fail-forward',
        title: 'Наслідки провалу',
        note: 'Що буде, якщо все піде не так.',
        type: 'text',
        placeholder: 'Наприклад: ворог втече, але залишить підказку',
    },
    {
        key: 'choices',
        title: 'Неочевидні рішення гравців',
        note: 'Які альтернативні ходи вони можуть обрати.',
        type: 'text',
        placeholder: 'Наприклад: підкуп, союз, обхідний шлях',
    },
    {
        key: 'clues',
        title: 'Підказки',
        note: 'Яку інформацію тут можуть отримати гравці.',
        type: 'textarea',
        placeholder: 'Запиши підказки, сліди, натяки або докази.',
    },
    {
        key: 'reward',
        title: 'Нагорода / результат',
        note: 'Що гравці отримають, якщо успішно впораються.',
        type: 'text',
        placeholder: 'Наприклад: союзник, карта, магічний предмет, нова інформація',
    },
    {
        key: 'twist',
        title: 'Секрет / твіст',
        note: 'Що може різко ускладнити або змінити сцену.',
        type: 'text',
        placeholder: 'Наприклад: союзник уже працює на ворога',
    },
];

const el = {
    campaignList: document.getElementById('campaignList'),
    sessionList: document.getElementById('sessionList'),
    sceneList: document.getElementById('sceneList'),
    campaignView: document.getElementById('campaignView'),
    sessionView: document.getElementById('sessionView'),
    emptyView: document.getElementById('emptyView'),
    campaignTitle: document.getElementById('campaignTitle'),
    campaignMeta: document.getElementById('campaignMeta'),
    sessionTitle: document.getElementById('sessionTitle'),
    sessionMeta: document.getElementById('sessionMeta'),
    progressText: document.getElementById('progressText'),
    progressFill: document.getElementById('progressFill'),
    campaignItemTemplate: document.getElementById('campaignItemTemplate'),
    sessionItemTemplate: document.getElementById('sessionItemTemplate'),
    sceneTemplate: document.getElementById('sceneTemplate'),
    createCampaignBtn: document.getElementById('createCampaignBtn'),
    renameCampaignBtn: document.getElementById('renameCampaignBtn'),
    toggleCampaignCompleteBtn: document.getElementById('toggleCampaignCompleteBtn'),
    deleteCampaignBtn: document.getElementById('deleteCampaignBtn'),
    createSessionBtn: document.getElementById('createSessionBtn'),
    backToCampaignBtn: document.getElementById('backToCampaignBtn'),
    renameSessionBtn: document.getElementById('renameSessionBtn'),
    toggleSessionCompleteBtn: document.getElementById('toggleSessionCompleteBtn'),
    deleteSessionBtn: document.getElementById('deleteSessionBtn'),
    checkAllBtn: document.getElementById('checkAllBtn'),
    clearChecksBtn: document.getElementById('clearChecksBtn'),
    addSceneBtn: document.getElementById('addSceneBtn'),
    clearSessionBtn: document.getElementById('clearSessionBtn'),
};

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('uk-UA');
}

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function promptRequired(message, initialValue = '') {
    const result = window.prompt(message, initialValue);
    if (result === null) return null;
    const trimmed = result.trim();
    return trimmed || null;
}

function showEmptyView() {
    el.emptyView.classList.remove('hidden');
    el.campaignView.classList.add('hidden');
    el.sessionView.classList.add('hidden');
}

function showCampaignView() {
    el.emptyView.classList.add('hidden');
    el.campaignView.classList.remove('hidden');
    el.sessionView.classList.add('hidden');
}

function showSessionView() {
    el.emptyView.classList.add('hidden');
    el.campaignView.classList.add('hidden');
    el.sessionView.classList.remove('hidden');
}

function renderCampaigns() {
    el.campaignList.innerHTML = '';

    state.campaigns.forEach((campaign) => {
        const fragment = el.campaignItemTemplate.content.cloneNode(true);
        const card = fragment.querySelector('.campaign-card');
        const main = fragment.querySelector('[data-action="open-campaign"]');
        const name = fragment.querySelector('[data-role="campaign-name"]');
        const meta = fragment.querySelector('[data-role="campaign-meta"]');
        const status = fragment.querySelector('[data-role="campaign-status"]');

        name.textContent = campaign.name;
        meta.textContent = `${campaign.sessionCount} сесій · оновлено ${formatDate(campaign.updatedAt)}`;
        status.textContent = campaign.completed ? 'Завершена' : 'Активна';
        status.classList.toggle('status-badge--done', Boolean(campaign.completed));

        if (state.activeCampaign?.slug === campaign.slug) {
            card.style.borderColor = 'rgba(56, 189, 248, 0.45)';
        }

        main.addEventListener('click', () => openCampaign(campaign.slug));
        el.campaignList.appendChild(fragment);
    });
}

function renderCampaignHeader() {
    if (!state.activeCampaign) return;
    el.campaignTitle.textContent = state.activeCampaign.name;
    el.campaignMeta.textContent = `Створено ${formatDate(state.activeCampaign.createdAt)} · Оновлено ${formatDate(state.activeCampaign.updatedAt)}`;
    el.toggleCampaignCompleteBtn.textContent = state.activeCampaign.completed
        ? 'Позначити активною'
        : 'Позначити завершеною';
}

function renderSessions() {
    el.sessionList.innerHTML = '';

    state.sessions.forEach((session) => {
        const fragment = el.sessionItemTemplate.content.cloneNode(true);
        const main = fragment.querySelector('[data-action="open-session"]');
        const name = fragment.querySelector('[data-role="session-name"]');
        const meta = fragment.querySelector('[data-role="session-meta"]');
        const statusBtn = fragment.querySelector('[data-action="toggle-session-status"]');
        const deleteBtn = fragment.querySelector('[data-action="delete-session"]');

        name.textContent = session.name;
        meta.textContent = `Створено ${formatDate(session.createdAt)} · Оновлено ${formatDate(session.updatedAt)}`;

        statusBtn.textContent = session.completed ? 'Завершена' : 'Активна';
        statusBtn.classList.toggle('status-badge--done', Boolean(session.completed));
        statusBtn.title = session.completed ? 'Позначити як активну' : 'Позначити як завершену';

        main.addEventListener('click', () => openSession(state.activeCampaign.slug, session.fileName));

        statusBtn.addEventListener('click', async (event) => {
            event.stopPropagation();

            try {
                await api.updateSession(state.activeCampaign.slug, session.fileName, {
                    name: session.name,
                    completed: !session.completed,
                });

                await openCampaign(state.activeCampaign.slug);
            } catch (error) {
                console.error(error);
                window.alert(error.message || 'Не вдалося змінити статус сесії.');
            }
        });

        deleteBtn.addEventListener('click', async (event) => {
            event.stopPropagation();

            if (!window.confirm(`Видалити сесію "${session.name}"?`)) return;

            try {
                await api.deleteSession(state.activeCampaign.slug, session.fileName);
                await openCampaign(state.activeCampaign.slug);
            } catch (error) {
                console.error(error);
                window.alert(error.message || 'Не вдалося видалити сесію.');
            }
        });

        el.sessionList.appendChild(fragment);
    });
}

function getCheckboxElements() {
    return Array.from(document.querySelectorAll('[data-checkbox]'));
}

function getUiState() {
    const sections = {};
    document.querySelectorAll('.todo-section').forEach((section) => {
        sections[section.dataset.sectionKey] = section.classList.contains('is-collapsed');
    });

    return { sections };
}

function gatherSceneState(card) {
    const texts = {};
    card.querySelectorAll('[data-scene-text]').forEach((field) => {
        texts[field.dataset.sceneText] = field.value;
    });

    return {
        texts,
        collapsed: card.classList.contains('is-collapsed'),
    };
}

function buildSessionPayload() {
    const data = {
        checks: {},
        texts: {},
        scenes: [],
        ui: getUiState(),
    };

    document.querySelectorAll('[data-checkbox]').forEach((checkbox) => {
        data.checks[checkbox.dataset.checkbox] = checkbox.checked;
    });

    document.querySelectorAll('[data-text]').forEach((field) => {
        data.texts[field.dataset.text] = field.value;
    });

    el.sceneList.querySelectorAll('.scene-card').forEach((card) => {
        data.scenes.push(gatherSceneState(card));
    });

    return data;
}

function applyUiState(ui = {}) {
    const sections = ui.sections || {};

    document.querySelectorAll('.todo-section').forEach((section) => {
        section.classList.toggle('is-collapsed', Boolean(sections[section.dataset.sectionKey]));
        const toggle = section.querySelector('[data-toggle-section]');
        if (toggle) toggle.textContent = section.classList.contains('is-collapsed') ? '+' : '−';
    });
}

async function persistSessionNow() {
    if (!state.activeCampaign || !state.activeSession || !state.activeSessionFileName) return;
    if (state.isSaving) {
        state.saveQueued = true;
        return;
    }

    state.isSaving = true;

    try {
        const updated = await api.updateSession(state.activeCampaign.slug, state.activeSessionFileName, {
            name: state.activeSession.name,
            completed: state.activeSession.completed,
            data: buildSessionPayload(),
        });

        state.activeSession = updated;
        state.activeSessionFileName = updated.fileName;
        state.sessionDirty = false;
        el.sessionMeta.textContent = `Створено ${formatDate(updated.createdAt)} · Оновлено ${formatDate(updated.updatedAt)}`;

        const previousCampaignSlug = state.activeCampaign.slug;
        await openCampaign(previousCampaignSlug);
        showSessionView();
    } catch (error) {
        console.error(error);
        window.alert(error.message || 'Не вдалося зберегти сесію.');
    } finally {
        state.isSaving = false;
        if (state.saveQueued) {
            state.saveQueued = false;
            await persistSessionNow();
        }
    }
}

async function commitSessionChange() {
    state.sessionDirty = true;
    updateProgress();
    updateDoneStates();
    await persistSessionNow();
}

function bindItemControls(scope = document) {
    scope.querySelectorAll('[data-checkbox], [data-text], [data-scene-text]').forEach((field) => {
        if (field.dataset.boundInput) return;
        field.dataset.boundInput = '1';

        const eventName = field.matches('input[type="checkbox"]') ? 'change' : 'input';
        field.addEventListener(eventName, async () => {
            await commitSessionChange();
        });
    });
}

function bindSectionControls() {
    document.querySelectorAll('[data-toggle-section]').forEach((button) => {
        if (button.dataset.bound) return;
        button.dataset.bound = '1';

        button.addEventListener('click', async () => {
            const section = button.closest('.todo-section');
            section.classList.toggle('is-collapsed');
            button.textContent = section.classList.contains('is-collapsed') ? '+' : '−';
            await commitSessionChange();
        });
    });
}

function createSceneCard(sceneData = {}) {
    const fragment = el.sceneTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.scene-card');
    const grid = fragment.querySelector('.scene-grid');
    const texts = sceneData.texts || {};
    const toggleBtn = fragment.querySelector('[data-toggle-scene]');

    sceneFieldSchema.forEach((field, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'todo-item';
        wrapper.dataset.itemKey = `scene-temp-${Date.now()}-${Math.random()}-${index}`;

        const content = document.createElement('div');
        content.className = 'todo-item__content';

        const titleRow = document.createElement('div');
        titleRow.className = 'todo-item__title-row';

        const textBlock = document.createElement('div');
        textBlock.innerHTML = `
      <div class="todo-item__title">${field.title}</div>
      <div class="todo-item__note">${field.note}</div>
    `;

        titleRow.append(textBlock);

        let input;
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.className = 'field field--textarea';
        } else {
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'field';
        }

        input.dataset.sceneText = field.key;
        input.placeholder = field.placeholder;
        input.value = typeof texts[field.key] === 'string' ? texts[field.key] : '';

        content.append(titleRow, input);
        wrapper.append(content);
        grid.appendChild(wrapper);
    });

    if (sceneData.collapsed) {
        card.classList.add('is-collapsed');
        toggleBtn.textContent = '+';
    }

    toggleBtn.addEventListener('click', async () => {
        card.classList.toggle('is-collapsed');
        toggleBtn.textContent = card.classList.contains('is-collapsed') ? '+' : '−';
        await commitSessionChange();
    });

    fragment.querySelector('[data-remove-scene]').addEventListener('click', async () => {
        card.remove();
        renumberScenes();
        await commitSessionChange();
    });

    el.sceneList.appendChild(fragment);
    renumberScenes();
    bindItemControls(el.sceneList);
    updateProgress();
}

function renumberScenes() {
    Array.from(el.sceneList.querySelectorAll('.scene-card')).forEach((card, index) => {
        const label = card.querySelector('[data-scene-number]');
        if (label) label.textContent = index + 1;

        card.querySelectorAll('.todo-item').forEach((item, itemIndex) => {
            item.dataset.itemKey = `scene-${index}-${itemIndex}`;
        });
    });
}

function applySessionData(session) {
    state.activeSession = session;
    state.activeSessionFileName = session.fileName || state.activeSessionFileName;
    state.sessionDirty = false;

    el.sessionTitle.textContent = session.name;
    el.sessionMeta.textContent = `Створено ${formatDate(session.createdAt)} · Оновлено ${formatDate(session.updatedAt)}`;
    el.toggleSessionCompleteBtn.textContent = session.completed
        ? 'Позначити активною'
        : 'Позначити завершеною';

    const data = session.data || {};
    const checks = data.checks || {};
    const texts = data.texts || {};

    document.querySelectorAll('[data-checkbox]').forEach((checkbox) => {
        checkbox.checked = Boolean(checks[checkbox.dataset.checkbox]);
    });

    document.querySelectorAll('[data-text]').forEach((field) => {
        field.value = typeof texts[field.dataset.text] === 'string' ? texts[field.dataset.text] : '';
    });

    el.sceneList.innerHTML = '';
    const scenes = Array.isArray(data.scenes) ? data.scenes : [];
    scenes.forEach((scene) => createSceneCard(scene));

    applyUiState(data.ui || {});
    updateDoneStates();
    updateProgress();
}

function updateDoneStates() {
    document.querySelectorAll('.todo-item').forEach((item) => item.classList.remove('is-done'));

    getCheckboxElements().forEach((checkbox) => {
        const item = checkbox.closest('.todo-item');
        if (item && checkbox.checked) item.classList.add('is-done');
    });
}

function updateProgress() {
    const checkboxes = getCheckboxElements();
    const total = checkboxes.length;
    const completed = checkboxes.filter((checkbox) => checkbox.checked).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    el.progressText.textContent = `${completed} / ${total}`;
    el.progressFill.style.width = `${percent}%`;
    updateDoneStates();
}

async function loadCampaigns() {
    state.campaigns = await api.listCampaigns();
    renderCampaigns();
}

async function openCampaign(slug) {
    const campaign = state.campaigns.find((item) => item.slug === slug);
    if (!campaign) return;

    state.activeCampaign = campaign;
    state.sessions = await api.listSessions(slug);

    renderCampaigns();
    renderCampaignHeader();
    renderSessions();
    showCampaignView();
}

async function openSession(slug, fileName) {
    const session = await api.getSession(slug, fileName);
    session.fileName = fileName;
    applySessionData(session);
    showSessionView();
}

function clearCurrentSession() {
    document.querySelectorAll('[data-checkbox]').forEach((checkbox) => {
        checkbox.checked = false;
    });

    document.querySelectorAll('[data-text], [data-scene-text]').forEach((field) => {
        field.value = '';
    });

    document.querySelectorAll('.todo-item, .todo-section').forEach((node) => {
        node.classList.remove('is-collapsed');
    });

    document.querySelectorAll('[data-toggle-item], [data-toggle-section]').forEach((button) => {
        button.textContent = '−';
    });

    el.sceneList.innerHTML = '';
    updateProgress();
}

async function init() {
    bindSectionControls();
    bindItemControls(document);

    await loadCampaigns();
    showEmptyView();

    el.createCampaignBtn.addEventListener('click', async () => {
        const name = promptRequired('Назва нової кампанії');
        if (!name) return;

        try {
            await api.createCampaign(name);
            await loadCampaigns();
        } catch (error) {
            console.error(error);
            window.alert(error.message || 'Не вдалося створити кампанію.');
        }
    });

    el.renameCampaignBtn.addEventListener('click', async () => {
        if (!state.activeCampaign) return;

        const name = promptRequired('Нова назва кампанії', state.activeCampaign.name);
        if (!name) return;

        try {
            const updated = await api.updateCampaign(state.activeCampaign.slug, { name });
            await loadCampaigns();
            await openCampaign(updated.slug);
        } catch (error) {
            console.error(error);
            window.alert(error.message || 'Не вдалося перейменувати кампанію.');
        }
    });

    el.toggleCampaignCompleteBtn.addEventListener('click', async () => {
        if (!state.activeCampaign) return;

        try {
            const currentSlug = state.activeCampaign.slug;
            await api.updateCampaign(currentSlug, {
                completed: !state.activeCampaign.completed,
            });
            await loadCampaigns();
            await openCampaign(currentSlug);
        } catch (error) {
            console.error(error);
            window.alert(error.message || 'Не вдалося змінити статус кампанії.');
        }
    });

    el.deleteCampaignBtn.addEventListener('click', async () => {
        if (!state.activeCampaign) return;

        if (!window.confirm(`Видалити кампанію "${state.activeCampaign.name}" разом із усіма сесіями?`)) {
            return;
        }

        try {
            await api.deleteCampaign(state.activeCampaign.slug);
            state.activeCampaign = null;
            state.activeSession = null;
            state.activeSessionFileName = null;
            await loadCampaigns();
            showEmptyView();
        } catch (error) {
            console.error(error);
            window.alert(error.message || 'Не вдалося видалити кампанію.');
        }
    });

    el.createSessionBtn.addEventListener('click', async () => {
        if (!state.activeCampaign) return;

        const input = window.prompt(
            'Назва нової сесії (залиш порожнім для дати YYYY-MM-DD)',
            ''
        );
        if (input === null) return;

        const name = input.trim();

        try {
            await api.createSession(state.activeCampaign.slug, name || undefined);
            await openCampaign(state.activeCampaign.slug);
        } catch (error) {
            console.error(error);
            window.alert(error.message || 'Не вдалося створити сесію.');
        }
    });

    el.backToCampaignBtn.addEventListener('click', async () => {
        showCampaignView();
    });

    el.renameSessionBtn.addEventListener('click', async () => {
        if (!state.activeCampaign || !state.activeSession) return;

        const name = promptRequired('Нова назва сесії', state.activeSession.name);
        if (!name) return;

        try {
            const updated = await api.updateSession(state.activeCampaign.slug, state.activeSessionFileName, {
                name,
                completed: state.activeSession.completed,
                data: buildSessionPayload(),
            });

            applySessionData(updated);
            await openCampaign(state.activeCampaign.slug);
            showSessionView();
        } catch (error) {
            console.error(error);
            window.alert(error.message || 'Не вдалося перейменувати сесію.');
        }
    });

    el.toggleSessionCompleteBtn.addEventListener('click', async () => {
        if (!state.activeCampaign || !state.activeSession) return;

        try {
            const updated = await api.updateSession(state.activeCampaign.slug, state.activeSessionFileName, {
                name: state.activeSession.name,
                completed: !state.activeSession.completed,
                data: buildSessionPayload(),
            });

            applySessionData(updated);
            await openCampaign(state.activeCampaign.slug);
            showSessionView();
        } catch (error) {
            console.error(error);
            window.alert(error.message || 'Не вдалося змінити статус сесії.');
        }
    });

    el.deleteSessionBtn.addEventListener('click', async () => {
        if (!state.activeCampaign || !state.activeSession) return;

        if (!window.confirm(`Видалити сесію "${state.activeSession.name}"?`)) return;

        try {
            await api.deleteSession(state.activeCampaign.slug, state.activeSessionFileName);
            await openCampaign(state.activeCampaign.slug);
            showCampaignView();
        } catch (error) {
            console.error(error);
            window.alert(error.message || 'Не вдалося видалити сесію.');
        }
    });

    el.checkAllBtn.addEventListener('click', async () => {
        const checkboxes = getCheckboxElements();
        const allChecked = checkboxes.every((checkbox) => checkbox.checked);

        checkboxes.forEach((checkbox) => {
            checkbox.checked = !allChecked;
        });

        await commitSessionChange();
    });

    el.clearChecksBtn.addEventListener('click', async () => {
        getCheckboxElements().forEach((checkbox) => {
            checkbox.checked = false;
        });

        await commitSessionChange();
    });

    el.addSceneBtn.addEventListener('click', async () => {
        createSceneCard({});
        await commitSessionChange();
    });

    el.clearSessionBtn.addEventListener('click', async () => {
        if (!window.confirm('Очистити всі поля поточної сесії?')) return;
        clearCurrentSession();
        await commitSessionChange();
    });

    window.addEventListener('beforeunload', (event) => {
        if (!state.sessionDirty || state.isSaving) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

init().catch((error) => {
    console.error(error);
    window.alert(error.message || 'Сталася помилка під час запуску застосунку.');
});