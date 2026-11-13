import { useAppSelector } from "../model/index.js";
import { lang } from "../../shared/lib/index.js";
import { useLocation } from "react-router";

export default function WorkspaceHeader() {
	const isGallery = useLocation().pathname === "/gallery";
	const campaignName = useAppSelector((state) => {
		const campaign = state.active.campaign;
		return campaign && typeof campaign === "object" && "name" in campaign
			? String(campaign.name || "") : "";
	});
	return (
		<header className="WorkspaceHeader">
			<span className="WorkspaceHeader__brand">{lang.t("Session notebook")}</span>
			<nav aria-label={lang.t(isGallery ? "Library" : "Campaigns")} className="WorkspaceHeader__breadcrumbs">
				<span>{lang.t(isGallery ? "Library" : "Campaigns")}</span>
				<span aria-hidden="true">/</span>
				<span className="WorkspaceHeader__current">{isGallery ? lang.t("Gallery") : campaignName || lang.t("Campaigns")}</span>
			</nav>
			<span className="WorkspaceHeader__storage">{lang.t("Local workspace")}</span>
		</header>
	);
}
