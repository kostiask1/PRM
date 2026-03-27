import React from 'react';
import CampaignView from './CampaignView';
import SessionView from './SessionView';

export default function MainContent({ campaign, activeSessionId, onSelectSession, onRefreshCampaigns, onNavigate, modal }) {
  if (!campaign) {
    return (
      <main className="main-content">
        <section className="empty-state panel">
          <h2>Обери кампанію або створи нову</h2>
          <p>Зліва знаходиться меню кампаній.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="main-content">
      {activeSessionId ? (
        <SessionView 
          campaignSlug={campaign.slug} 
          sessionId={activeSessionId} 
          onBack={() => onSelectSession(null)}
          onNavigate={onNavigate}
          onRefreshCampaigns={onRefreshCampaigns}
          modal={modal}
        />
      ) : (
        <CampaignView 
          campaign={campaign} 
          onSelectSession={onSelectSession} 
          onNavigate={onNavigate}
          onRefreshCampaigns={onRefreshCampaigns}
          modal={modal}
        />
      )}
    </main>
  );
}