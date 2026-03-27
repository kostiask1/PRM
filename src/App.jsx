import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import Modal from './components/Modal';
import { api } from './api';

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

    if (parts[0] === 'campaign' && parts[1]) {
      campaign = decodeURIComponent(parts[1]);
      if (parts[2] === 'session' && parts[3]) {
        session = decodeURIComponent(parts[3]);
      }
    }
    return { campaign, session };
  };

  const initialRoute = parseUrl();
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignSlug, setActiveCampaignSlug] = useState(initialRoute.campaign);
  const [activeSessionFileName, setActiveSessionFileName] = useState(initialRoute.session);

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

  const alert = (title, message) => showModal({ title, message, type: 'error', isAlert: true });
  const confirm = (title, message) => showModal({ title, message, type: 'error' });
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
    loadCampaigns();

    // Слухаємо кнопки Назад/Вперед у браузері
    const handlePopState = () => {
      const route = parseUrl();
      setActiveCampaignSlug(route.campaign);
      setActiveSessionFileName(route.session);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Універсальна функція навігації
  const navigate = (slug, fileName = null, replace = false) => {
    setActiveCampaignSlug(slug);
    setActiveSessionFileName(fileName);
    
    let url = '/';
    if (slug) {
      url = `/campaign/${encodeURIComponent(slug)}`;
      if (fileName) {
        url += `/session/${encodeURIComponent(fileName)}`;
      }
    }
    
    if (replace) window.history.replaceState({}, '', url);
    else window.history.pushState({}, '', url);
  };

  const handleToggleCampaignStatus = async (campaign) => {
    try {
      await api.updateCampaign(campaign.slug, { completed: !campaign.completed });
      await loadCampaigns();
    } catch (err) {
      console.error("Failed to toggle campaign status", err);
    }
  };

  const activeCampaign = campaigns.find(c => c.slug === activeCampaignSlug);

  return (
    <div className="app-shell">
      <Sidebar 
        campaigns={campaigns}
        activeCampaignId={activeCampaignSlug}
        onSelectCampaign={(slug) => navigate(slug)}
        onCreateCampaign={async () => {
            const name = await prompt("Нова кампанія", "Введіть назву для вашої пригоди:");
            if (name) {
              await api.createCampaign(name);
              await loadCampaigns();
            }
        }}
        onToggleCampaignStatus={handleToggleCampaignStatus}
        modal={{ alert, confirm, prompt }}
      />
      <MainContent 
        campaign={activeCampaign}
        activeSessionId={activeSessionFileName}
        onSelectSession={(fileName) => navigate(activeCampaignSlug, fileName)}
        onRefreshCampaigns={loadCampaigns}
        onNavigate={navigate}
        modal={{ alert, confirm, prompt }}
      />

      {modalConfig && <Modal {...modalConfig} />}
    </div>
  );
}