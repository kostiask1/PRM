import { useEffect } from "react";

import { lang } from "../../services/localization";
import { openModalRequest } from "../../store/appStore";
import RulesReferenceModalContent from "./RulesReferenceModalContent";
import {
	OPEN_RULES_REFERENCE_MODAL_EVENT,
	setRulesReferenceModalOpener,
} from "./openRulesReferenceModal";

function openRulesReferenceModalContent({
	initialTab = "conditions",
	initialName = "",
} = {}) {
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

export default function RulesReferenceModalHost() {
	useEffect(() => {
		const handleOpen = (event) => {
			openRulesReferenceModalContent(event.detail);
		};

		setRulesReferenceModalOpener(openRulesReferenceModalContent);
		window.addEventListener(OPEN_RULES_REFERENCE_MODAL_EVENT, handleOpen);
		return () => {
			setRulesReferenceModalOpener(null);
			window.removeEventListener(OPEN_RULES_REFERENCE_MODAL_EVENT, handleOpen);
		};
	}, []);

	return null;
}
