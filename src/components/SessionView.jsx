import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

const SCENE_SCHEMA = [
  { key: 'summary', title: 'Суть сцени', type: 'textarea', placeholder: 'Коротко опиши сцену...' },
  { key: 'goal', title: 'Мета гравців', type: 'textarea', placeholder: 'Чого персонажі хочуть досягти...' },
  { key: 'stakes', title: 'Ставки', type: 'textarea', placeholder: 'Що буде при успіху/провалі...' },
  { key: 'location', title: 'Локація', type: 'text', placeholder: 'Де це відбувається...' },
  { key: 'npcs', title: 'NPC / фракції', type: 'textarea', placeholder: 'Хто бере участь...' },
  { key: 'clues', title: 'Підказки', type: 'textarea', placeholder: 'Інформація, яку отримають гравці...' },
];

export default function SessionView({ campaignSlug, sessionId, onBack, onNavigate, onRefreshCampaigns }) {
  const [session, setSession] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeout = useRef(null);

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const data = await api.getSession(campaignSlug, sessionId);
        setSession(data);
      } catch (err) {
        console.error("Failed to load session", err);
      }
    };
    loadSession();
  }, [campaignSlug, sessionId]);

  const saveToServer = useCallback(async (updatedSession) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setIsSaving(true);
    try {
      const result = await api.updateSession(campaignSlug, sessionId, updatedSession);
      // Якщо після збереження змінився fileName (через ренейм), оновлюємо URL
      if (result && result.fileName !== sessionId) {
        onNavigate(campaignSlug, result.fileName, true);
        onRefreshCampaigns();
      }
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setIsSaving(false);
    }
  }, [campaignSlug, sessionId, onNavigate, onRefreshCampaigns]);

  const triggerSave = useCallback((updatedSession, instant = false) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    
    if (instant) {
      saveToServer(updatedSession);
    } else {
      setIsSaving(true);
      saveTimeout.current = setTimeout(() => saveToServer(updatedSession), 1000);
    }
  }, [saveToServer]);

  const updateSession = (updates, instant = false) => {
    setSession(prev => {
      const next = { ...prev, ...updates };
      triggerSave(next, instant);
      return next;
    });
  };

  const updateData = (key, value, instant = false) => {
    const nextData = { ...session.data, [key]: value };
    updateSession({ data: nextData }, instant);
  };

  const addScene = () => {
    const scenes = session.data.scenes || [];
    updateData('scenes', [...scenes, { id: Date.now(), texts: {}, collapsed: false }], true);
  };

  const updateScene = (sceneId, field, value) => {
    const scenes = session.data.scenes.map(s => 
      s.id === sceneId ? { ...s, texts: { ...s.texts, [field]: value } } : s
    );
    updateData('scenes', scenes);
  };

  const removeScene = (sceneId) => {
    if (!window.confirm("Видалити цю сцену?")) return;
    updateData('scenes', session.data.scenes.filter(s => s.id !== sceneId), true);
  };

  if (!session) return <div className="panel empty-state"><h2>Завантаження...</h2></div>;

  const checklistItems = [
    { id: 'goal', label: 'Визначити головну мету сесії', hasText: true },
    { id: 'conflict', label: 'Сформулювати основний конфлікт', hasText: true },
    { id: 'social', label: 'Підготувати соціальну сцену', note: 'Переговори, допит, суперечка.' },
    { id: 'exploration', label: 'Підготувати сцену дослідження', note: 'Локація, загадка, пастка.' },
    { id: 'combat', label: 'Підготувати бій / сцену напруги', note: 'Ризик і тиск.' },
  ];

  const totalChecks = checklistItems.length;
  const completedChecks = checklistItems.filter(item => session.data[`${item.id}_check`]).length;
  const progress = Math.round((completedChecks / totalChecks) * 100);

  const handleRename = async () => {
    const name = window.prompt("Нова назва сесії:", session.name);
    if (name && name !== session.name) updateSession({ name }, true);
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <button className="btn btn--ghost" onClick={onBack} style={{ marginBottom: '12px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Назад до кампанії</span>
          </button>
          <h2 className="editable-title" onClick={handleRename}>{session.name}</h2>
          <p className="muted">{isSaving ? 'Зберігання...' : 'Всі зміни збережено'}</p>
        </div>
        <div className="header-actions">
          <button 
            className={`btn ${session.completed ? 'btn--primary' : ''}`} 
            onClick={() => updateSession({ completed: !session.completed }, true)}
          >
            {session.completed ? 'Відновити' : 'Завершити'}
          </button>
          <button className="icon-btn icon-btn--danger" onClick={async () => {
            if (window.confirm(`Видалити сесію "${session.name}"?`)) {
              await api.deleteSession(campaignSlug, sessionId);
              onBack();
              onRefreshCampaigns();
            }
          }}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>

      <div className="progress-toolbar">
        <div className="progress-wrap">
          <div className="progress-label">
            <span>Прогрес підготовки</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      <div className="panel__body">
        <div className="todo-card">
          <section className="todo-section">
            <div className="todo-section__header"><h3>1. Чекліст підготовки</h3></div>
            <div className="todo-section__body checklist">
              {checklistItems.map(item => (
                <label key={item.id} className={`todo-item ${session.data[`${item.id}_check`] ? 'is-done' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={!!session.data[`${item.id}_check`]} 
                    onChange={(e) => updateData(`${item.id}_check`, e.target.checked, true)}
                  />
                  <div className="todo-item__content">
                    <div className="todo-item__title">{item.label}</div>
                    {item.note && <div className="todo-item__note">{item.note}</div>}
                    {item.hasText && (
                      <textarea 
                        className="field field--textarea" 
                        rows="1"
                        onInput={autoResize}
                        value={session.data[`${item.id}_text`] || ''}
                        onChange={(e) => updateData(`${item.id}_text`, e.target.value)}
                      />
                    )}
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="todo-section">
            <div className="todo-section__header">
              <h3>2. Сцени</h3>
              <button className="btn btn--primary btn--small" style={{marginLeft: 'auto'}} onClick={addScene}>+ Додати</button>
            </div>
            <div className="todo-section__body scene-list">
              {(session.data.scenes || []).map((scene, idx) => (
                <div key={scene.id} className="scene-card">
                  <div className="scene-card__header">
                    <div className="scene-card__title">Сцена {idx + 1}</div>
                    <button className="icon-btn icon-btn--danger" onClick={() => removeScene(scene.id)}>×</button>
                  </div>
                  <div className="scene-grid">
                    {SCENE_SCHEMA.map(field => (
                      <div key={field.key} className="todo-item__content">
                        <div className="todo-item__title" style={{fontSize: '0.85rem'}}>{field.title}</div>
                        {field.type === 'textarea' ? (
                          <textarea 
                            className="field field--textarea" 
                            rows="1"
                            onInput={autoResize}
                            value={scene.texts[field.key] || ''}
                            onChange={(e) => updateScene(scene.id, field.key, e.target.value)}
                          />
                        ) : (
                          <input 
                            className="field" 
                            value={scene.texts[field.key] || ''}
                            onChange={(e) => updateScene(scene.id, field.key, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="todo-section">
             <div className="todo-section__header"><h3>3. Результат сесії</h3></div>
             <div className="todo-section__body">
                <div className="todo-item__note" style={{marginBottom: '8px'}}>Запиши короткий підсумок того, що реально відбулося.</div>
                <textarea 
                  className="field field--textarea field--result" 
                  placeholder="Підсумок того, що реально відбулося..."
                  onInput={autoResize}
                  value={session.data.result_text || ''}
                  onChange={(e) => updateData('result_text', e.target.value)}
                ></textarea>
             </div>
          </section>
        </div>
      </div>
    </section>
  );
}