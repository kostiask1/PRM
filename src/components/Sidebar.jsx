import React, { useRef, useState, useEffect } from 'react';
import { api } from '../api';
import Icon from './Icon';

export default function Sidebar({ campaigns, activeCampaignId, onSelectCampaign, onCreateCampaign, onToggleCampaignStatus, modal }) {
  const fileInputRef = useRef(null);
  
  // Локальний стан для миттєвого відображення змін черги
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);
  const [draggingSlug, setDraggingSlug] = useState(null);

  // Синхронізація локального списку з пропсами
  useEffect(() => {
    setLocalCampaigns(campaigns);
  }, [campaigns]);

  const importMode = useRef('campaign'); // 'campaign' or 'all'

  const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (importMode.current === 'all') {
          await api.importAll(data);
        } else {
          await api.importCampaign(data);
        }
        window.location.reload();
      } catch (error) {
        modal.alert('Помилка імпорту', error.message);
      }
    };
    reader.readAsText(file);
  };

  const handleDragStart = (e, slug) => {
    setDraggingSlug(slug);
    
    // Покращуємо візуальний "привид" елемента
    e.currentTarget.classList.add('dragging');
    
    // Налаштування drag-image (можна додати кастомний елемент, якщо потрібно)
    e.dataTransfer.effectAllowed = 'move';
    
    e.dataTransfer.setData('text/plain', slug);
  };

  const handleDragEnd = () => {
    setDraggingSlug(null);
    // Зберігаємо фінальний порядок на сервері
    const orders = {};
    localCampaigns.forEach((item, idx) => { orders[item.slug] = idx; });
    api.reorderCampaigns(orders);
  };

  const handleDragEnter = (targetSlug) => {
    if (draggingSlug === targetSlug || !draggingSlug) return;

    const items = [...localCampaigns];
    const draggedIdx = items.findIndex(i => i.slug === draggingSlug);
    const targetIdx = items.findIndex(i => i.slug === targetSlug);
    
    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [removed] = items.splice(draggedIdx, 1);
      items.splice(targetIdx, 0, removed);
      setLocalCampaigns(items);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
  };

  return (
    <aside className="sidebar app__sidebar">
      <div className="sidebar__header">
        <h1>D&D Session Manager</h1>
        <p>Кампанії, сесії та планування в одному локальному проєкті.</p>
      </div>

      <div className="sidebar__section">
        <div className="sidebar__header-section">
          <h2 style={{ marginBottom: '12px' }}>Кампанії</h2>
        </div>
        <button className="btn btn--primary" onClick={onCreateCampaign}>
          <Icon name="plus" strokeWidth={2.5} />
          <span>Нова кампанія</span>
        </button>
        
        <div className="sidebar__list">
          {localCampaigns.map(campaign => (
            <article 
              key={campaign.slug} 
              className={`list-card ${activeCampaignId === campaign.slug ? 'list-card--active' : ''} ${draggingSlug === campaign.slug ? 'list-card--dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, campaign.slug)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={() => handleDragEnter(campaign.slug)}
              onDrop={handleDrop}
            >
              <button 
                className="list-card__main" 
                onClick={() => onSelectCampaign(campaign.slug)}
              >
                <div className="list-card__title">{campaign.name}</div>
                <div className="list-card__meta">{campaign.sessionCount || 0} сесій</div>
              </button>
              <span 
                className={`status-badge ${campaign.completed ? 'status-badge--done' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCampaignStatus(campaign);
                }}
              >
                {campaign.completed ? (
                  `Завершена ${campaign.completedAt ? new Date(campaign.completedAt).toLocaleDateString() : ''}`
                ) : (
                  'Активна'
                )}
              </span>
            </article>
          ))}
        </div>
      </div>

      <div className="sidebar__footer">
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept=".json" 
          onChange={handleFileChange} 
        />
        <button className="btn btn--footer" onClick={() => {
          importMode.current = 'campaign';
          fileInputRef.current.click();
        }}>
          <Icon name="import" />
          <span>Імпорт JSON</span>
        </button>
        <div className="footer-grid">
          <button className="btn btn--footer btn--small" onClick={async () => {
            try {
              const data = await api.exportAll();
              downloadJson(data, `prm-full-backup-${new Date().toISOString().slice(0, 10)}.json`);
            } catch (err) {
              modal.alert("Помилка бекапу", err.message || "Невідома помилка");
            }
          }}>
            <Icon name="database" size={16} />
            <span>Бекап</span>
          </button>
          <button className="btn btn--footer btn--small" onClick={async () => {
            if (await modal.confirm('Відновлення бази', 'Імпортувати всі дані? Це додасть кампанії з файлу до вашого списку.')) {
              importMode.current = 'all';
              fileInputRef.current.click();
            }
          }}>
            <Icon name="restore" size={16} />
            <span>Restore</span>
          </button>
        </div>
      </div>
    </aside>
  );
}