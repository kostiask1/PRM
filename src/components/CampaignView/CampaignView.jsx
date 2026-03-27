import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api';
import Button from '../Button/Button';
import Input from '../Input/Input';
import StatusBadge from '../StatusBadge/StatusBadge';
import './CampaignView.css';

export default function CampaignView({ campaign, onSelectSession, onNavigate, onRefreshCampaigns, modal }) {
  const [sessions, setSessions] = useState([]);
  const [draggingFileName, setDraggingFileName] = useState(null);
  const [draggingNoteId, setDraggingNoteId] = useState(null);

  // Локальний стан для сюжету та заміток
  const [description, setDescription] = useState(campaign.description || '');
  const [notes, setNotes] = useState(campaign.notes || []);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);
  const saveTimeout = useRef(null);

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  // Синхронізація при зміні кампанії
  useEffect(() => {
    setDescription(campaign.description || '');
    setNotes(campaign.notes || []);
  }, [campaign.slug, campaign.description, campaign.notes]);

  const triggerSave = useCallback((updates) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await api.updateCampaign(campaign.slug, updates);
        onRefreshCampaigns();
      } catch (err) {
        console.error("Failed to save campaign updates", err);
      }
    }, 500);
  }, [campaign.slug, onRefreshCampaigns]);

  const handleDescriptionChange = (e) => {
    const val = e.target.value;
    setDescription(val);
    triggerSave({ description: val });
  };

  const handleAddNote = () => {
    const newNotes = [...notes, { id: Date.now(), text: '', collapsed: false }];
    setNotes(newNotes);
    triggerSave({ notes: newNotes });
  };

  const handleToggleNoteCollapse = (id) => {
    const newNotes = notes.map(n => n.id === id ? { ...n, collapsed: !n.collapsed } : n);
    setNotes(newNotes);
    triggerSave({ notes: newNotes });
  };

  const handleNoteChange = (id, text) => {
    const newNotes = notes.map(n => n.id === id ? { ...n, text } : n);
    setNotes(newNotes);
    triggerSave({ notes: newNotes });
  };

  const handleDeleteNote = (id) => {
    const newNotes = notes.filter(n => n.id !== id);
    setNotes(newNotes);
    triggerSave({ notes: newNotes });
  };

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
        <div className="CampaignView__section">
          <h3>Сюжет кампанії</h3>
          <Input
            type="textarea"
            className="field--textarea"
            placeholder="Опишіть основну лінію сюжету, ключові події та цілі..."
            value={description}
            onChange={handleDescriptionChange}
            onInput={autoResize}
            rows={1}
          />
        </div>

        <div className="CampaignView__section">
          <div className="section-row">
            <div className="section-title-group" onClick={() => setIsNotesCollapsed(!isNotesCollapsed)} style={{ cursor: 'pointer' }}>
              <Button
                variant="ghost"
                size="small"
                icon="chevron"
                className={`section-collapse-toggle ${isNotesCollapsed ? 'is-rotated' : ''}`}
                onClick={(e) => { e.stopPropagation(); setIsNotesCollapsed(!isNotesCollapsed); }}
              />
              <h3>Замітки</h3>
            </div>
            {!isNotesCollapsed && (
              <Button
                variant="primary"
                size="small"
                onClick={handleAddNote}
                icon="plus"
                strokeWidth={2.5}
              >
                Нова замітка
              </Button>
            )}
          </div>
          {!isNotesCollapsed && (
            <div className="CampaignView__notes">
              {notes.map(note => (
                <div
                  key={note.id}
                  className={`note-card-simple ${note.collapsed ? 'is-collapsed' : ''} ${draggingNoteId === note.id ? 'note-card-simple--dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggingNoteId(note.id);
                    e.currentTarget.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', note.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDraggingNoteId(null);
                    triggerSave({ notes });
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragEnter={() => {
                    if (draggingNoteId === note.id || !draggingNoteId) return;

                    const items = [...notes];
                    const draggedIdx = items.findIndex(i => i.id === draggingNoteId);
                    const targetIdx = items.findIndex(i => i.id === note.id);

                    if (draggedIdx !== -1 && targetIdx !== -1) {
                      const [removed] = items.splice(draggedIdx, 1);
                      items.splice(targetIdx, 0, removed);
                      setNotes(items);
                    }
                  }}
                  onDrop={handleDrop}
                >
                  <div
                    className="note-card-simple__header"
                    onClick={() => handleToggleNoteCollapse(note.id)}
                  >
                    <Button
                      variant="ghost"
                      size="small"
                      icon="chevron"
                      className={`note-card-simple__toggle ${note.collapsed ? 'is-rotated' : ''}`}
                      onClick={() => handleToggleNoteCollapse(note.id)}
                    />
                    <div className="note-card-simple__title">
                      {note.text.split('\n')[0].slice(0, 45) || 'Нова замітка'}
                    </div>
                    <Button variant="danger" icon="trash" size={14} onClick={() => handleDeleteNote(note.id)} title="Видалити замітку" />
                  </div>
                  {!note.collapsed && (
                    <Input
                      type="textarea"
                      className="field--textarea"
                      value={note.text}
                      onChange={(e) => handleNoteChange(note.id, e.target.value)}
                      onInput={autoResize}
                      placeholder="Текст замітки..."
                      rows={1}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-row">
          <h3>Сесії</h3>
        </div>
        <div className="CampaignView__sessions">
          <Button variant="create" onClick={handleCreateSession} icon="plus" strokeWidth={2.5}>
            Нова сесія
          </Button>
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