import CampaignView from "./CampaignView";
import SessionView from "./SessionView";
import Bestiary from "./Bestiary";
import EncounterView from "./EncounterView";
import Spells from "./Spells";

export default function MainContent({
	campaign,
	activeSessionId,
	activeEncounterId,
	onSelectSession,
	onRefreshCampaigns,
	onNavigate,
	onRollDice,
}) {
	if (window.location.pathname === "/bestiary") {
		return (
			<main className="MainContent">
				<Bestiary />
			</main>
		);
	}
	if (window.location.pathname === "/spells") {
		return (
			<main className="MainContent">
				<Spells />
			</main>
		);
	}

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
			{activeEncounterId ? (
				<EncounterView
					campaign={campaign}
					sessionId={activeSessionId}
					encounterId={activeEncounterId}
					onBack={() => onNavigate(campaign.slug, activeSessionId)}
					onRefreshCampaigns={onRefreshCampaigns}
					onRollDice={onRollDice}
				/>
			) : activeSessionId ? (
				<SessionView
					campaign={campaign}
					sessionId={activeSessionId}
					onBack={() => onSelectSession(null)}
					onNavigate={onNavigate}
					onRefreshCampaigns={onRefreshCampaigns}
					onRollDice={onRollDice}
				/>
			) : (
				<CampaignView
					campaign={campaign}
					onSelectSession={onSelectSession}
					onNavigate={onNavigate}
					onRefreshCampaigns={onRefreshCampaigns}
					onRollDice={onRollDice}
				/>
			)}
		</main>
	);
}
