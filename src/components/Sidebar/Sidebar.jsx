import { useRef, useState, useEffect } from 'react';
import { api } from '../../api';
import Button from '../Button/Button';
import Icon from '../Icon';
import StatusBadge from '../StatusBadge/StatusBadge';
import ListCard from '../ListCard/ListCard';
import DraggableList from '../DraggableList/DraggableList';
import "./Sidebar.css"

export default function Sidebar({ campaigns, activeCampaignId, onSelectCampaign, onCreateCampaign, onToggleCampaignStatus, modal }) {
  const fileInputRef = useRef(null);

  // Локальний стан для миттєвого відображення змін черги
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);

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

  const handleDragEnd = (newList) => {
    // Зберігаємо фінальний порядок на сервері
    const orders = {};
    newList.forEach((item, idx) => { orders[item.slug] = idx; });
    api.reorderCampaigns(orders);
  };

  return (
    <aside className="Sidebar App__sidebar">
      <div className="Sidebar__header">
        <h1 className="Sidebar__title">D&D Session Manager</h1>
        <p className="Sidebar__description">Кампанії, сесії та планування в одному локальному проєкті.</p>
      </div>
      <div className="Sidebar__links">
        <a
          href="/bestiary"
          className="Sidebar__link"
          onClick={(e) => {
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              onSelectCampaign('bestiary');
            }
          }}
        >
          <Icon name="bestiary" />
          Бестіарій
        </a>
        <a
          href="/spells"
          className="Sidebar__link"
          onClick={(e) => {
            if (!e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              onSelectCampaign('spells');
            }
          }}
        >
          <Icon name="book" />
          Заклинання
        </a>
      </div>
      <div className="Sidebar__section">
        <div className="Sidebar__headerSection">
          <h2 className="Sidebar__sectionTitle">Кампанії</h2>
        </div>
        <Button variant="create" onClick={onCreateCampaign} icon="plus">
          Нова кампанія
        </Button>

        <DraggableList
          items={localCampaigns}
          className="Sidebar__list"
          onReorder={setLocalCampaigns}
          onDrop={() => handleDragEnd(localCampaigns)}
          keyExtractor={(c) => c.slug}
          renderItem={(campaign, isDragging) => (
            <ListCard
              active={activeCampaignId === campaign.slug}
              dragging={isDragging}
              href={`/campaign/${encodeURIComponent(campaign.slug)}`}
              onClick={() => onSelectCampaign(campaign.slug)}
              actions={
                <StatusBadge completed={campaign.completed} completedAt={campaign.completedAt} onClick={(e) => { e.stopPropagation(); onToggleCampaignStatus(campaign); }} />
              }
            >
              <div className="ListCard__title">{campaign.name}</div>
              <div className="ListCard__meta">{campaign.sessionCount || 0} сесій</div>
            </ListCard>
          )}
        />
      </div>

      <div className="Sidebar__section Sidebar__section--resources">
        <div className="Sidebar__headerSection">
          <h2 className="Sidebar__sectionTitle">Ресурси</h2>
        </div>
        <div className="Sidebar__resource-list">
          <a href="https://homebrewery.naturalcrit.com/" target="_blank" rel="noopener noreferrer" className="Sidebar__resource-item">
            <Icon name="book" size={16} /> Homebrewery
          </a>
          <a href="https://crowsnest.me/tokenizer/" target="_blank" rel="noopener noreferrer" className="Sidebar__resource-item">
            <Icon name="user" size={16} /> Tokenizer
          </a>
          <a href="https://forgottenadventures.piwigo.com/index?/category/1351-fa_topdown_tokens" target="_blank" rel="noopener noreferrer" className="Sidebar__resource-item">
            <Icon name="layers" size={16} /> FA Tokens
          </a>
          <a href="https://www.owlbear.rodeo/" target="_blank" rel="noopener noreferrer" className="Sidebar__resource-item">
            <Icon name="monitor" size={16} /> Owlbear Rodeo
          </a>
          <a href="https://kemono.cr/patreon/user/16010661" target="_blank" rel="noopener noreferrer" className="Sidebar__resource-item">
            <Icon name="map" size={16} /> Мапи Szepeku
          </a>
          <a href="https://chatgpt.com/g/g-69c24d157a348191b640bf111b486080-ttrpg-map-architect" target="_blank" rel="noopener noreferrer" className="Sidebar__resource-item">
            <Icon name="wand" size={16} /> Map Architect (AI)
          </a>
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