import { useEffect, useRef } from "react";

import { lang } from "../../../shared/lib/index.js";
import { openModalRequest, useAppSelector } from "../../../shared/model/index.js";
import RulesReferenceModalContent from "./RulesReferenceModalContent.tsx";

import type { ReferenceTabId } from "../model.js";

interface OpenRulesReferenceModalOptions {
	initialTab?: ReferenceTabId;
	initialName?: string;
	forceTab?: boolean;
}

function openRulesReferenceModalContent({
	initialTab = "conditions",
	initialName = "",
	forceTab = false,
}: OpenRulesReferenceModalOptions = {}) {
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
	const handledRequestIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (!navigationRequest?.requestId) return;
		if (handledRequestIdRef.current === navigationRequest.requestId) return;

		handledRequestIdRef.current = navigationRequest.requestId;
		if (isOpen) return;

		openRulesReferenceModalContent({
			initialTab: navigationRequest.tabId as ReferenceTabId,
			initialName: navigationRequest.name,
			forceTab: navigationRequest.forceTab,
		});
	}, [isOpen, navigationRequest]);

	return null;
}
