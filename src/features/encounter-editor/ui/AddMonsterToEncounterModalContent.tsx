import { useEffect, useMemo, useState } from "react";

import { alert, requestCampaignsReloadAction } from "../../../shared/model/index.js";
import {
	campaignApi,
	type CampaignRecord,
} from "../../../entities/campaign/index.js";
import { sessionApi } from "../../../entities/session/index.js";
import { closeActiveModal, useAppDispatch } from "../../../shared/model/index.js";
import {
	createEncounterMonsterInstance,
	type EncounterMonster,
} from "../../../entities/encounter/index.js";
import { Button } from "../../../shared/ui/index.js";
import { lang } from "../../../shared/lib/index.js";
import "../../../assets/components/AddMonsterToEncounterModal.css";
import {
	buildEncounterTargetCampaignGroup,
	createEncounterTargetId,
	normalizeActiveEncounterCampaigns,
	normalizeEncounterSessionSummaries,
	type EncounterTarget,
	type EncounterTargetCampaign,
	type EncounterTargetCampaignGroup,
	type EncounterTargetSession,
} from "../model/addMonsterTargets.ts";

const EMPTY_CAMPAIGNS: CampaignRecord[] = [];

export interface AddMonsterToEncounterModalContentProps {
	monster: EncounterMonster;
	campaigns?: CampaignRecord[] | null;
}

export default function AddMonsterToEncounterModalContent({
	monster,
	campaigns = EMPTY_CAMPAIGNS,
}: AddMonsterToEncounterModalContentProps) {
	const dispatch = useAppDispatch();
	const [groups, setGroups] = useState<EncounterTargetCampaignGroup[]>([]);
	const [loading, setLoading] = useState(true);
	const [addingId, setAddingId] = useState<string | null>(null);

	const activeCampaigns = useMemo(
		() => normalizeActiveEncounterCampaigns(campaigns),
		[campaigns],
	);

	useEffect(() => {
		let isMounted = true;

		const loadEncounters = async () => {
			setLoading(true);
			try {
				const campaignsSource = activeCampaigns.length
					? activeCampaigns
					: normalizeActiveEncounterCampaigns(
							await campaignApi.listCampaigns(),
						);

				const campaignGroups = await Promise.all(
					campaignsSource.map(async (campaign) => {
						const sessions = normalizeEncounterSessionSummaries(
							await sessionApi.listSessions(campaign.slug),
						);
						const sessionDetails = await Promise.all(
							sessions.map((session) =>
								sessionApi
									.getSession(campaign.slug, session.fileName)
									.catch(() => null),
							),
						);

						return buildEncounterTargetCampaignGroup(
							campaign,
							sessionDetails,
						);
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

	const handleAdd = async ({
		campaign,
		session,
		encounter,
	}: {
		campaign: EncounterTargetCampaign;
		session: EncounterTargetSession;
		encounter: EncounterTarget;
	}) => {
		const targetId = createEncounterTargetId(
			campaign.slug,
			session.fileName,
			encounter.id,
		);
		setAddingId(targetId);

		try {
			await sessionApi.addEncounterMonster(
				campaign.slug,
				session.fileName,
				encounter.id,
				createEncounterMonsterInstance(monster),
			);
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
											const targetId = createEncounterTargetId(
												group.campaign.slug,
												session.fileName,
												encounter.id,
											);
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
