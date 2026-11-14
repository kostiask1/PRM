import { useAppSelector } from "../model/index.js";
import { lang } from "../../shared/lib/index.js";

export default function WorkspaceHeader() {
	const campaignName = useAppSelector((state) => {
		const campaign = state.active.campaign;
		return campaign && typeof campaign === "object" && "name" in campaign
			? String(campaign.name || "") : "";
	});
	return (
		<header className="WorkspaceHeader">
			<span className="WorkspaceHeader__brand">{lang.t("Session notebook")}</span>
			<nav aria-label={lang.t("Campaigns")} className="WorkspaceHeader__breadcrumbs">
				<span>{lang.t("Campaigns")}</span>
				<span aria-hidden="true">/</span>
				<span className="WorkspaceHeader__current">{campaignName || lang.t("Campaigns")}</span>
			</nav>
		</header>
	);
}
