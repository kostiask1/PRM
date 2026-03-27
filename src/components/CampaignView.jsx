import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function CampaignView({ campaign, onSelectSession, onNavigate, onRefreshCampaigns, modal }) {
  const [sessions, setSessions] = useState([]);
  const [draggingFileName, setDraggingFileName] = useState(null);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await api.listSessions(campaign.slug);
        setSessions(data);
      } catch (err) {
        console.error("Failed to load sessions", err);
      }
    };
    loadSessions();
  }, [campaign.slug]);

  const handleCreateSession = async () => {
    const name = await modal.prompt("Нова сесія", "Введіть назву або залиште порожнім для поточної дати:");
    if (name === null) return;
    try {
      const newSession = await api.createSession(campaign.slug, name);
      setSessions([...sessions, newSession]);
    } catch (err) {
      modal.alert("Помилка", "Не вдалося створити сесію");
    }
  };

  const handleDeleteCampaign = async () => {
    if (!(await modal.confirm("Видалення кампанії", "Усі сесії цієї кампанії будуть втрачені назавжди. Продовжити?"))) return;
    try {
      await api.deleteCampaign(campaign.slug);
      onNavigate(null); // Повертаємось на головну
      onRefreshCampaigns();
    } catch (err) {
      modal.alert("Помилка", "Не вдалося видалити кампанію");
    }
  };

  const handleRename = async () => {
    const name = await modal.prompt("Перейменування", "Вкажіть нову назву кампанії:", campaign.name);
    if (name && name !== campaign.name) {
      try {
        const updated = await api.updateCampaign(campaign.slug, { name });
        await onRefreshCampaigns(); // Спочатку оновлюємо список кампаній
        onNavigate(updated.slug, null, true); // Потім переходимо за новим посиланням
      } catch (err) {
        modal.alert("Помилка", "Не вдалося перейменувати кампанію");
      }
    }
  };

  const handleDeleteSession = async (session) => {
    if (!(await modal.confirm("Видалення сесії", `Ви дійсно хочете видалити сесію "${session.name}"?`))) return;
    try {
      await api.deleteSession(campaign.slug, session.fileName);
      const data = await api.listSessions(campaign.slug);
      setSessions(data);
    } catch (err) {
      modal.alert("Помилка", "Не вдалося видалити сесію");
    }
  };

  const handleToggleSessionStatus = async (session) => {
    try {
      await api.updateSession(campaign.slug, session.fileName, { completed: !session.completed });
      const data = await api.listSessions(campaign.slug);
      setSessions(data);
    } catch (err) {
      console.error("Failed to toggle session status", err);
    }
  };

  const handleExport = async () => {
    try {
      const bundle = await api.exportCampaign(campaign.slug);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-${campaign.slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      modal.alert("Помилка експорту", err.message);
    }
  };

  const handleDragStart = (e, fileName) => {
    setDraggingFileName(fileName);
    e.currentTarget.classList.add('dragging');
    
    e.dataTransfer.setData('text/plain', fileName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingFileName(null);
    // Зберігаємо порядок
    const orders = {};
    sessions.forEach((item, idx) => { orders[item.fileName] = idx; });
    api.reorderSessions(campaign.slug, orders);
  };

  const handleDragEnter = (targetFileName) => {
    if (draggingFileName === targetFileName || !draggingFileName) return;

    const items = [...sessions];
    const draggedIdx = items.findIndex(i => i.fileName === draggingFileName);
    const targetIdx = items.findIndex(i => i.fileName === targetFileName);
    
    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [removed] = items.splice(draggedIdx, 1);
      items.splice(targetIdx, 0, removed);
      setSessions(items);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2 className="editable-title" onClick={handleRename} title="Натисни, щоб перейменувати">{campaign.name}</h2>
          <p className="muted">Створено: {new Date(campaign.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="header-actions">
          <button className="btn" type="button" onClick={handleExport}>
            <span>Експорт</span>
          </button>
          <button className="icon-btn icon-btn--danger" onClick={handleDeleteCampaign} title="Видалити кампанію">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="panel__body">
        <div className="section-row">
          <h3>Сесії</h3>
          <button className="btn btn--primary" onClick={handleCreateSession}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Нова сесія</span>
          </button>
        </div>
        
        <div className="session-list">
          {sessions.map(session => (
            <article 
              key={session.fileName} 
              className={`list-card session-card ${draggingFileName === session.fileName ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, session.fileName)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={() => handleDragEnter(session.fileName)}
              onDrop={handleDrop}
            >
              <button 
                className="session-card__main" 
                onClick={() => onSelectSession(session.fileName)}
              >
                <div className="list-card__title">{session.name}</div>
                <div className="list-card__meta">Оновлено: {new Date(session.updatedAt).toLocaleDateString()}</div>
              </button>
              <div className="session-card__actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span 
                  className={`status-badge ${session.completed ? 'status-badge--done' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleToggleSessionStatus(session)}
                >
                  {session.completed ? 'Завершена' : 'В підготовці'}
                </span>
                <button 
                  className="icon-btn icon-btn--danger" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session);
                  }} 
                  title="Видалити сесію"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}