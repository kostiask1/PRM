import React from 'react';
import CampaignView from './CampaignView/CampaignView';
import SessionView from './SessionView/SessionView';

export default function MainContent({ campaign, activeSessionId, onSelectSession, onRefreshCampaigns, onNavigate, modal, onRollDice }) {
  if (!campaign) {
    return (
      <main className="MainContent">
        <section className="MainContent__emptyState Panel">
          <h2>Обери кампанію або створи нову</h2>
          <p>Зліва знаходиться меню кампаній.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="MainContent">
      {activeSessionId ? (
        <SessionView
          campaignSlug={campaign.slug}
          sessionId={activeSessionId}
          onBack={() => onSelectSession(null)}
          onNavigate={onNavigate}
          onRefreshCampaigns={onRefreshCampaigns}
          modal={modal}
          onRollDice={onRollDice}
        />
      ) : (
        <CampaignView
          campaign={campaign}
          onSelectSession={onSelectSession}
          onNavigate={onNavigate}
          onRefreshCampaigns={onRefreshCampaigns}
          modal={modal}
          onRollDice={onRollDice}
        />
      )}
    </main>
  );
}