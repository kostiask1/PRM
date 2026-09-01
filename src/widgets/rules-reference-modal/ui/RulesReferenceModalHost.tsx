import { useEffect, useRef } from "react";

import { lang } from "../../../shared/lib/index.js";
import RulesReferenceModalContent from "./RulesReferenceModalContent.tsx";
import type { RulesReferenceModalHostProps } from "./rulesReferenceModalComposition.ts";
import {
	useRulesReferenceModalRuntime,
	type RulesReferenceModalRuntime,
} from "./RulesReferenceModalRuntime.tsx";

import { getReferenceModalHostPlan, type ReferenceTabId } from "../model.js";

interface OpenRulesReferenceModalOptions extends RulesReferenceModalHostProps {
	initialTab?: ReferenceTabId;
	initialName?: string;
	forceTab?: boolean;
	openModal: RulesReferenceModalRuntime["openModal"];
}

function openRulesReferenceModalContent({
	initialTab = "conditions",
	initialName = "",
	forceTab = false,
	MonsterStatBlock,
	SpellsBrowser,
	openModal,
}: OpenRulesReferenceModalOptions) {
	openModal({
		title: lang.t("Rules Reference"),
		type: "custom",
		showFooter: false,
		children: (
			<RulesReferenceModalContent
				initialTab={initialTab}
				initialName={initialName}
				forceTab={forceTab}
				MonsterStatBlock={MonsterStatBlock}
				SpellsBrowser={SpellsBrowser}
			/>
		),
	});
}

export default function RulesReferenceModalHost({
	MonsterStatBlock,
	SpellsBrowser,
}: RulesReferenceModalHostProps) {
	const { navigationRequest, isOpen, openModal } =
		useRulesReferenceModalRuntime();
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
			MonsterStatBlock,
			SpellsBrowser,
			openModal,
		});
	}, [MonsterStatBlock, SpellsBrowser, isOpen, navigationRequest, openModal]);

	return null;
}
