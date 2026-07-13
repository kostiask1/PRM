import { useEffect, useMemo, useState } from "react";

import { alert, requestCampaignsReloadAction } from "../../../shared/model/index.js";
import { campaignApi } from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";

const api = { ...campaignApi, ...sessionApi };
import { closeActiveModal, useAppDispatch } from "../../../shared/model/index.js";
import { createEncounterMonsterInstance } from "../../../entities/encounter/index.js";
import { Button } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import "../../../assets/components/AddMonsterToEncounterModal.css";

const EMPTY_CAMPAIGNS = [];

function idsEqual(a, b) {
	return String(a) === String(b);
}

export default function AddMonsterToEncounterModalContent({
	monster,
	campaigns = EMPTY_CAMPAIGNS,
}) {
	const dispatch = useAppDispatch();
	const [groups, setGroups] = useState([]);
	const [loading, setLoading] = useState(true);
	const [addingId, setAddingId] = useState(null);

	const activeCampaigns = useMemo(
		() => (campaigns || []).filter((campaign) => !campaign.completed),
		[campaigns],
	);

	useEffect(() => {
		let isMounted = true;

		const loadEncounters = async () => {
			setLoading(true);
			try {
				const campaignsSource =
					activeCampaigns.length > 0
						? activeCampaigns
						: (await api.listCampaigns()).filter(
								(campaign) => !campaign.completed,
							);

				const campaignGroups = await Promise.all(
					campaignsSource.map(async (campaign) => {
						const sessions = await api.listSessions(campaign.slug);
						const sessionDetails = await Promise.all(
							sessions.map((session) =>
								api
									.getSession(campaign.slug, session.fileName)
									.catch(() => null),
							),
						);

						return {
							campaign,
							sessions: sessionDetails
								.filter(Boolean)
								.map((session) => ({
									session,
									encounters: session.data?.encounters || [],
								}))
								.filter((sessionGroup) => sessionGroup.encounters.length > 0),
						};
					}),
				);

				if (!isMounted) return;
				setGroups(campaignGroups.filter((group) => group.sessions.length > 0));
			} catch (error) {
				console.error("Failed to load encounters", error);
				if (isMounted) {
					dispatch(
						alert({
							title: lang.t("Error"),
							message: lang.t("Failed to load encounters"),
						}),
					);
				}
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadEncounters();

		return () => {
			isMounted = false;
		};
	}, [activeCampaigns, dispatch]);

	const handleAdd = async ({ campaign, session, encounter }) => {
		const targetId = `${campaign.slug}:${session.fileName}:${encounter.id}`;
		setAddingId(targetId);

		try {
			const currentSession = await api.getSession(
				campaign.slug,
				session.fileName,
			);
			let isTargetFound = false;
			const updatedEncounters = (currentSession.data?.encounters || []).map(
				(currentEncounter) => {
					if (!idsEqual(currentEncounter.id, encounter.id)) {
						return currentEncounter;
					}

					isTargetFound = true;
					return {
						...currentEncounter,
						monsters: [
							...(currentEncounter.monsters || []),
							createEncounterMonsterInstance(monster),
						],
					};
				},
			);

			if (!isTargetFound) {
				throw new Error("Encounter not found");
			}

			await api.updateSession(campaign.slug, session.fileName, {
				...currentSession,
				data: {
					...currentSession.data,
					encounters: updatedEncounters,
				},
			});
			dispatch(requestCampaignsReloadAction());
			closeActiveModal(true);
		} catch (error) {
			console.error("Failed to add monster to encounter", error);
			dispatch(
				alert({
					title: lang.t("Error"),
					message: lang.t("Failed to add monster to encounter"),
				}),
			);
			setAddingId(null);
		}
	};

	if (loading) {
		return (
			<div className="AddMonsterToEncounterModal">
				<div className="muted">{lang.t("Loading...")}</div>
			</div>
		);
	}

	return (
		<div className="AddMonsterToEncounterModal">
			{groups.length === 0 ? (
				<div className="muted">{lang.t("No active encounters found.")}</div>
			) : (
				groups.map((group) => (
					<section
						key={group.campaign.slug}
						className="AddMonsterToEncounterModal__campaign"
					>
						<h4>{group.campaign.name}</h4>
						<div className="AddMonsterToEncounterModal__sessions">
							{group.sessions.map(({ session, encounters }) => (
								<div
									key={session.fileName}
									className="AddMonsterToEncounterModal__session"
								>
									<div className="AddMonsterToEncounterModal__sessionName">
										{session.name}
									</div>
									<div className="AddMonsterToEncounterModal__encounters">
										{encounters.map((encounter) => {
											const targetId = `${group.campaign.slug}:${session.fileName}:${encounter.id}`;
											return (
												<Button
													key={encounter.id}
													variant="ghost"
													icon="plus"
													disabled={Boolean(addingId)}
													onClick={() =>
														handleAdd({
															campaign: group.campaign,
															session,
															encounter,
														})
													}
												>
													{addingId === targetId
														? lang.t("Adding...")
														: encounter.name || lang.t("Untitled")}
												</Button>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</section>
				))
			)}
		</div>
	);
}
