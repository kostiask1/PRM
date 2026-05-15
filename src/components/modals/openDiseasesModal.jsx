import RulesReferenceModalContent from "./RulesReferenceModalContent";
import { openModalRequest } from "../../store/appStore";
import { lang } from "../../services/localization";

export function openDiseasesModal(initialDiseaseName = "") {
	openModalRequest({
		title: lang.t("Rules Reference"),
		type: "custom",
		showFooter: false,
		children: (
			<RulesReferenceModalContent
				initialTab="diseases"
				initialName={initialDiseaseName}
			/>
		),
	});
}
