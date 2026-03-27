import React, { useState, useEffect } from 'react';
import { api } from '../api';
import Icon from './Icon';
import Button from './Button';
import StatusBadge from './StatusBadge';

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
    const isCompleting = !session.completed;
    let completedAt = session.completedAt;

    if (isCompleting) {
      const now = new Date().toISOString();
      const todayLabel = new Date().toLocaleDateString();
      const prevLabel = completedAt ? new Date(completedAt).toLocaleDateString() : null;

      if (completedAt && todayLabel !== prevLabel) {
        const confirmUpdate = await modal.confirm(
          "Оновлення дати",
          `Сесія вже була завершена ${prevLabel}. Оновити дату завершення на сьогодні?`
        );
        if (confirmUpdate) completedAt = now;
      } else {
        completedAt = now;
      }
    }

    try {
      await api.updateSession(campaign.slug, session.fileName, { completed: isCompleting, completedAt });
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
    <section className="CampaignView Panel">
      <div className="Panel__header">
        <div>
          <h2 className="editable-title" onClick={handleRename} title="Натисни, щоб перейменувати">
            {campaign.name}
          </h2>
          <p className="muted">Створено: {new Date(campaign.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="CampaignView__headerActions">
          <Button onClick={handleExport} icon="export">
            Експорт
          </Button>
          <Button variant="danger" icon="trash" onClick={handleDeleteCampaign} title="Видалити кампанію" />
        </div>
      </div>

      <div className="Panel__body">
        <div className="section-row">
          <h3>Сесії</h3>
          <Button variant="primary" onClick={handleCreateSession} icon="plus" strokeWidth={2.5}>
            Нова сесія
          </Button>
        </div>
        <div className="CampaignView__sessions">
          {sessions.map(session => (
            <article 
              key={session.fileName} 
              className={`list-card ${draggingFileName === session.fileName ? 'list-card--dragging' : ''}`}
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
                className="list-card__main" 
                onClick={() => onSelectSession(session.fileName)}
              >
                <div className="list-card__title">{session.name}</div>
                <div className="list-card__meta">Оновлено: {new Date(session.updatedAt).toLocaleDateString()}</div>
              </button>
              <div className="session-card__actions">
                <StatusBadge
                  completed={session.completed}
                  completedAt={session.completedAt}
                  onClick={() => handleToggleSessionStatus(session)}
                  type="session"
                />
                <Button
                  variant="danger"
                  icon="trash"
                  size={16}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session);
                  }} 
                  title="Видалити сесію"
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}