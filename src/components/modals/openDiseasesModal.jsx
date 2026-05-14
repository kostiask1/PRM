import DiseasesModalContent from "./DiseasesModalContent";
import { openModalRequest } from "../../store/appStore";
import { lang } from "../../services/localization";

export function openDiseasesModal(initialDiseaseName = "") {
	openModalRequest({
		title: lang.t("Diseases"),
		type: "custom",
		showFooter: false,
		children: <DiseasesModalContent initialDiseaseName={initialDiseaseName} />,
	});
}
