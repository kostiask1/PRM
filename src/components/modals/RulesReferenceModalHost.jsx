import { useEffect, useRef } from "react";

import { lang } from "../../services/localization";
import { openModalRequest, useAppSelector } from "../../store/appStore";
import RulesReferenceModalContent from "./RulesReferenceModalContent";

function openRulesReferenceModalContent({
	initialTab = "conditions",
	initialName = "",
	forceTab = false,
} = {}) {
	openModalRequest({
		title: lang.t("Rules Reference"),
		type: "custom",
		showFooter: false,
		children: (
			<RulesReferenceModalContent
				initialTab={initialTab}
				initialName={initialName}
				forceTab={forceTab}
			/>
		),
	});
}

export default function RulesReferenceModalHost() {
	const navigationRequest = useAppSelector(
		(state) => state.rulesReference.navigationRequest,
	);
	const isOpen = useAppSelector((state) => state.rulesReference.isOpen);
	const handledRequestIdRef = useRef(null);

	useEffect(() => {
		if (!navigationRequest?.requestId) return;
		if (handledRequestIdRef.current === navigationRequest.requestId) return;

		handledRequestIdRef.current = navigationRequest.requestId;
		if (isOpen) return;

		openRulesReferenceModalContent({
			initialTab: navigationRequest.tabId,
			initialName: navigationRequest.name,
			forceTab: navigationRequest.forceTab,
		});
	}, [isOpen, navigationRequest]);

	return null;
}
