import ConditionsModalContent from "./ConditionsModalContent";
import { openModalRequest } from "../../store/appStore";
import { lang } from "../../services/localization";

export function openConditionsModal(initialConditionName = "") {
	openModalRequest({
		title: lang.t("Conditions"),
		type: "custom",
		showFooter: false,
		children: (
			<ConditionsModalContent initialConditionName={initialConditionName} />
		),
	});
}
