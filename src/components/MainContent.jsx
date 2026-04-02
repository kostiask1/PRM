import CampaignView from "./CampaignView/CampaignView";
import SessionView from "./SessionView/SessionView";
import Bestiary from "./Bestiary/Bestiary";
import EncounterView from "./EncounterView/EncounterView";
import Spells from "./Spells/Spells";

export default function MainContent({
	campaign,
	activeSessionId,
	activeEncounterId,
	onSelectSession,
	onRefreshCampaigns,
	onNavigate,
	modal,
	onRollDice,
}) {
	if (window.location.pathname === "/bestiary") {
		return (
			<main className="MainContent">
				<Bestiary modal={modal} />
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
					modal={modal}
					onRollDice={onRollDice}
				/>
			) : activeSessionId ? (
				<SessionView
					campaign={campaign}
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
