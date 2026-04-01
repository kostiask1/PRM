import { useEffect, useState } from 'react';
import { api } from './api';
import DiceCalculator from './components/DiceCalculator/DiceCalculator';
import MainContent from './components/MainContent';
import Modal from './components/Modal/Modal';
import Sidebar from './components/Sidebar/Sidebar';

/**
 * Main Application Component
 * Orchestrates the sidebar navigation and the main content area.
 */
export default function App() {
  // Функція для отримання стану з URL
  const parseUrl = () => {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    let campaign = null;
    let session = null;
    let encounter = null;

    if (parts[0] === 'campaign' && parts[1]) {
      campaign = decodeURIComponent(parts[1]);
      if (parts[2] === 'session' && parts[3]) {
        session = decodeURIComponent(parts[3]);
        if (parts[4] === 'encounter' && parts[5]) {
          encounter = decodeURIComponent(parts[5]);
        }
      }
    } else if (parts[0] === 'bestiary') {
      campaign = 'bestiary';
    } else if (parts[0] === 'spells') {
      campaign = 'spells';
    }
    return { campaign, session, encounter };
  };

  const initialRoute = parseUrl();
  const [campaigns, setCampaigns] = useState([]);
  const [isCTRLPressed, setCTRLPressed] = useState(false);
  const [activeCampaignSlug, setActiveCampaignSlug] = useState(initialRoute.campaign);
  const [activeSessionFileName, setActiveSessionFileName] = useState(initialRoute.session);
  const [activeEncounterId, setActiveEncounterId] = useState(initialRoute.encounter);

  // Modal State
  const [modalConfig, setModalConfig] = useState(null);

  const showModal = (config) => {
    return new Promise((resolve) => {
      setModalConfig({
        ...config,
        onConfirm: (value) => {
          setModalConfig(null);
          resolve(value);
        },
        onCancel: config.isAlert ? null : () => {
          setModalConfig(null);
          resolve(null);
        }
      });
    });
  };

  const alert = (title, message, status = null) => {
    const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
    return showModal({ title, message: fullMessage, type: status >= 500 ? 'error' : 'error', isAlert: true });
  };
  const confirm = (title, message, status = null) => {
    const fullMessage = status ? `[Статус: ${status}] ${message}` : message;
    return showModal({ title, message: fullMessage, type: 'confirm' });
  };
  const prompt = (title, message, defaultValue = '') => showModal({ title, message, type: 'confirm', showInput: true, defaultValue });

  const loadCampaigns = async () => {
    try {
      const data = await api.listCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error("Failed to load campaigns", err);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        setCTRLPressed(true);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (!e.ctrlKey && !e.metaKey) {
        setCTRLPressed(false);
      }
    });
  }, [])

  useEffect(() => {
    loadCampaigns();

    // Слухаємо кнопки Назад/Вперед у браузері
    const handlePopState = () => {
      const route = parseUrl();
      setActiveCampaignSlug(route.campaign);
      setActiveSessionFileName(route.session);
      setActiveEncounterId(route.encounter);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Універсальна функція навігації
  const navigate = (slug, fileName = null, replace = false, encounterId = null) => {

    let url = '/';
    if (slug && slug !== 'bestiary' && slug !== 'spells') {
      url = `/campaign/${encodeURIComponent(slug)}`;
      if (fileName) {
        url += `/session/${encodeURIComponent(fileName)}`;
        if (encounterId) {
          url += `/encounter/${encodeURIComponent(encounterId)}`;
        }
      }
    } else if (slug === 'bestiary') {
      url = '/bestiary';
    } else if (slug === 'spells') {
      url = '/spells';
    }

    if (isCTRLPressed) {
      window.open(url, '_blank')
    } else {
      setActiveCampaignSlug(slug);
      setActiveSessionFileName(fileName);
      setActiveEncounterId(encounterId);

      if (replace) window.history.replaceState({}, '', url);
      else window.history.pushState({}, '', url);
    }
  };

  const handleToggleCampaignStatus = async (campaign) => {
    const isCompleting = !campaign.completed;
    let completedAt = campaign.completedAt;

    if (isCompleting) {
      const now = new Date().toISOString();
      const todayLabel = new Date().toLocaleDateString();
      const prevLabel = completedAt ? new Date(completedAt).toLocaleDateString() : null;

      if (completedAt && todayLabel !== prevLabel) {
        const confirmUpdate = await confirm(
          "Оновлення дати",
          `Кампанія вже була завершена ${prevLabel}. Оновити дату завершення на сьогодні?`
        );
        if (confirmUpdate) completedAt = now;
      } else {
        completedAt = now;
      }
    }

    try {
      await api.updateCampaign(campaign.slug, {
        completed: isCompleting,
        completedAt: completedAt
      });
      await loadCampaigns();
    } catch (err) {
      console.error("Failed to toggle campaign status", err);
    }
  };

  const activeCampaign = campaigns.find(c => c.slug === activeCampaignSlug);

  return (
    <div className="App">
      <Sidebar
        className="App__sidebar"
        campaigns={campaigns}
        activeCampaignId={activeCampaignSlug}
        onSelectCampaign={(slug) => navigate(slug)}
        onCreateCampaign={async () => {
          const name = await prompt("Нова кампанія", "Введіть назву для вашої пригоди:");
          if (name) {
            const newCampaign = await api.createCampaign(name);
            await loadCampaigns();
            navigate(newCampaign.slug);
          }
        }}
        onToggleCampaignStatus={handleToggleCampaignStatus}
        modal={{ alert, confirm, prompt }}
      />
      <MainContent
        className="App__main"
        campaign={activeCampaign}
        activeSessionId={activeSessionFileName}
        activeEncounterId={activeEncounterId}
        onSelectSession={(fileName) => navigate(activeCampaignSlug, fileName)}
        onRefreshCampaigns={loadCampaigns}
        onNavigate={navigate}
        modal={{ alert, confirm, prompt }}
      />

      {modalConfig && <Modal {...modalConfig} />}
      {/* Передаємо команду для кидка та функцію для її скидання */}
      <DiceCalculator />
    </div>
  );
}