import RulesReferenceModalContent from "./RulesReferenceModalContent";
import { openModalRequest } from "../../store/appStore";
import { lang } from "../../services/localization";

export function openRulesReferenceModal(initialTab = "conditions", initialName = "") {
	openModalRequest({
		title: lang.t("Rules Reference"),
		type: "custom",
		showFooter: false,
		children: (
			<RulesReferenceModalContent
				initialTab={initialTab}
				initialName={initialName}
			/>
		),
	});
}
