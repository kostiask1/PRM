import { useEffect, useRef } from "react";

import { lang } from "../../../shared/lib/index.js";
import { openModalRequest, useAppSelector } from "../../../shared/model/index.js";
import RulesReferenceModalContent from "./RulesReferenceModalContent.tsx";

import { getReferenceModalHostPlan, type ReferenceTabId } from "../model.js";

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
		const plan = getReferenceModalHostPlan(
			navigationRequest,
			handledRequestIdRef.current,
			isOpen,
		);
		if (!plan) return;
		handledRequestIdRef.current = plan.requestId;
		if (!plan.shouldOpen) return;

		openRulesReferenceModalContent({
			initialTab: plan.initialTab as ReferenceTabId,
			initialName: plan.initialName,
			forceTab: plan.forceTab,
		});
	}, [isOpen, navigationRequest]);

	return null;
}
