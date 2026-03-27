import React, { useRef, useState, useEffect } from 'react';
import { api } from '../api';
import Button from './Button';
import StatusBadge from './StatusBadge';

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
    <aside className="Sidebar App__sidebar">
      <div className="Sidebar__header">
        <h1 className="Sidebar__title">D&D Session Manager</h1>
        <p className="Sidebar__description">Кампанії, сесії та планування в одному локальному проєкті.</p>
      </div>

      <div className="Sidebar__section">
        <div className="Sidebar__headerSection">
          <h2 className="Sidebar__sectionTitle">Кампанії</h2>
        </div>
        <Button variant="create" onClick={onCreateCampaign} icon="plus">
          Нова кампанія
        </Button>
        
        <div className="Sidebar__list">
          {localCampaigns.map(campaign => (
            <article 
              key={campaign.slug} 
              className={`Sidebar__card ${activeCampaignId === campaign.slug ? 'Sidebar__card--active' : ''} ${draggingSlug === campaign.slug ? 'Sidebar__card--dragging' : ''}`}
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
                className="list-card__main" // Використовуємо спільний клас для кнопок-карток
                onClick={() => onSelectCampaign(campaign.slug)}
              >
                <div className="list-card__title">{campaign.name}</div>
                <div className="list-card__meta">{campaign.sessionCount || 0} сесій</div>
              </button>
              <StatusBadge
                completed={campaign.completed}
                completedAt={campaign.completedAt}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCampaignStatus(campaign);
                }}
              />
            </article>
          ))}
        </div>
      </div>

      <div className="Sidebar__footer">
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept=".json" 
          onChange={handleFileChange} 
        />
        <Button variant="footer" icon="import" onClick={() => {
          importMode.current = 'campaign';
          fileInputRef.current.click();
        }}>
          Імпорт кампанії
        </Button>
        <div className="Sidebar__footerGrid">
          <Button variant="footer" icon="database" iconSize={16} onClick={async () => {
            try {
              const data = await api.exportAll();
              downloadJson(data, `prm-full-backup-${new Date().toISOString().slice(0, 10)}.json`);
            } catch (err) {
              modal.alert("Помилка бекапу", err.message || "Невідома помилка");
            }
          }}>
            Бекап
          </Button>
          <Button variant="footer" icon="restore" iconSize={16} onClick={async () => {
            if (await modal.confirm('Відновлення бази', 'Імпортувати всі дані? Це додасть кампанії з файлу до вашого списку.')) {
              importMode.current = 'all';
              fileInputRef.current.click();
            }
          }}>
            Імпорт БД
          </Button>
        </div>
      </div>
    </aside>
  );
}