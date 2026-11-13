import { useEffect, useMemo, useState } from "react";
import { campaignApi, type CampaignRecord } from "../../../entities/campaign/index.js";
import { sessionApi, type SessionRecord } from "../../../entities/session/index.js";
import { lang } from "../../../shared/lib/index.js";
import { Button, Modal, Select } from "../../../shared/ui/index.js";
import "../../../assets/components/EntityMoveDialog.css";

export interface EntityMoveDestination {
	campaignSlug: string;
	scope: "campaign" | "session";
	fileName?: string;
}

export interface EntityMoveDialogProps {
	campaignSlug: string;
	currentSession?: string;
	entityName: string;
	onCancel: () => void;
	onMove: (destination: EntityMoveDestination) => Promise<void>;
}

function findDuplicateNames(items: Array<{ name: string }>): Set<string> {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const item of items) {
		if (seen.has(item.name)) duplicates.add(item.name);
		else seen.add(item.name);
	}
	return duplicates;
}

export default function EntityMoveDialog({ campaignSlug, currentSession, entityName, onCancel, onMove }: EntityMoveDialogProps) {
	const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
	const [loadingCampaigns, setLoadingCampaigns] = useState(true);
	const [destinationCampaign, setDestinationCampaign] = useState(campaignSlug);
	const [scope, setScope] = useState<"campaign" | "session">(currentSession ? "campaign" : "session");
	const [sessions, setSessions] = useState<SessionRecord[]>([]);
	const [fileName, setFileName] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [sessionError, setSessionError] = useState(false);
	const duplicateCampaignNames = useMemo(() => findDuplicateNames(campaigns), [campaigns]);
	const duplicateSessionNames = useMemo(() => findDuplicateNames(sessions), [sessions]);

	useEffect(() => {
		let active = true;
		void campaignApi.listCampaigns().then((items) => { if (active) setCampaigns(items ?? []); }).catch(() => { if (active) setError(lang.t("Failed to load destinations.")); }).finally(() => { if (active) setLoadingCampaigns(false); });
		return () => { active = false; };
	}, []);
	useEffect(() => {
		let active = true;
		setLoading(true);
		setSessionError(false);
		setFileName("");
		void sessionApi.listSessions(destinationCampaign).then((items) => {
			if (!active) return;
			const available = (items ?? []).filter((item) => item.fileName && !(destinationCampaign === campaignSlug && item.fileName === currentSession));
			setSessions(available);
			setFileName(available[0]?.fileName || "");
		}).catch(() => { if (active) { setSessions([]); setSessionError(true); } }).finally(() => { if (active) setLoading(false); });
		return () => { active = false; };
	}, [campaignSlug, currentSession, destinationCampaign]);

	const sameCampaignScope = !currentSession && destinationCampaign === campaignSlug && scope === "campaign";
	const canMove = !saving && !loadingCampaigns && campaigns.length > 0 && !sameCampaignScope && (scope === "campaign" || (!loading && Boolean(fileName)));
	const submit = () => {
		if (!canMove) return;
		setSaving(true);
		setError("");
		void onMove({ campaignSlug: destinationCampaign, scope, ...(scope === "session" ? { fileName } : {}) }).then(onCancel).catch(() => setError(lang.t("Failed to move entity."))).finally(() => setSaving(false));
	};
	return <Modal title={lang.t("Move entity")} type="custom" showFooter={false} cancelDisabled={saving} onCancel={onCancel} onConfirm={submit}>
		<div className="EntityMoveDialog">
			<p>{lang.t("Choose where to move {name}.", { name: entityName })}</p>
			<label><span>{lang.t("Campaign")}</span><Select aria-label={lang.t("Campaign")} value={destinationCampaign} disabled={saving || loadingCampaigns || campaigns.length === 0} onChange={(event) => { if (event.target.value === destinationCampaign) return; setError(""); setLoading(true); setSessions([]); setFileName(""); setDestinationCampaign(event.target.value); }}>{campaigns.map((campaign) => <option key={campaign.slug} value={campaign.slug}>{duplicateCampaignNames.has(campaign.name) ? `${campaign.name} · ${campaign.slug}` : campaign.name}</option>)}</Select></label>
			<label><span>{lang.t("Destination")}</span><Select aria-label={lang.t("Destination")} value={scope} disabled={saving} onChange={(event) => { if (campaigns.length > 0) setError(""); setScope(event.target.value as "campaign" | "session"); }}><option value="campaign">{lang.t("Campaign level")}</option><option value="session">{lang.t("Session")}</option></Select></label>
			{scope === "session" && <label><span>{lang.t("Session")}</span><Select aria-label={lang.t("Session")} value={fileName} disabled={saving || loading || sessions.length === 0} onChange={(event) => { if (campaigns.length > 0) setError(""); setFileName(event.target.value); }}>{sessions.length === 0 && <option value="">{lang.t("No sessions available")}</option>}{sessions.map((session) => <option key={session.fileName} value={session.fileName || ""}>{duplicateSessionNames.has(session.name) ? `${session.name} · ${session.fileName}` : session.name}</option>)}</Select></label>}
			{sameCampaignScope && <p className="muted">{lang.t("This item is already at campaign level.")}</p>}
			{scope === "session" && sessionError && <p role="alert" className="EntityMoveDialog__error">{lang.t("Failed to load destinations.")}</p>}
			{error && <p role="alert" className="EntityMoveDialog__error">{error}</p>}
			<div className="EntityMoveDialog__actions"><Button variant="ghost" disabled={saving} onClick={onCancel}>{lang.t("Cancel")}</Button><Button variant="primary" disabled={!canMove} onClick={submit}>{lang.t("Move")}</Button></div>
		</div>
	</Modal>;
}
