import { useEffect } from "react";
import { useLocation } from "react-router";
import {
	HISTORY_FOCUS_EVENT,
	focusHistoryTargetField,
	getHistoryFocusNavigation,
	scrollToHistoryTarget,
	type HistoryFocusTarget,
} from "../../entities/history/index.js";
import { buildNavigationUrl } from "../../shared/lib/index.js";
import { navigateTo } from "../model/index.js";

import "../../assets/components/HistoryFocus.css";

const FOCUS_DELAYS = [80, 180, 420, 850, 1400, 2200] as const;

function scheduleFocus(
	hashes: string[],
	field: string | null = null,
	caretOffset: number | null = null,
	caretValueRevision: string | null = null,
): Array<number> {
	let settled = false;
	return FOCUS_DELAYS.map((delay) => window.setTimeout(() => {
		if (settled) return;
		for (const hash of hashes) {
			const located = scrollToHistoryTarget(hash);
			if (!located) continue;
			if (
				!field ||
				focusHistoryTargetField(
					hash,
					field,
					caretOffset,
					caretValueRevision,
				)
			) {
				settled = true;
			}
			return;
		}
	}, delay));
}

export default function HistoryFocusRuntimeHost() {
	const location = useLocation();

	useEffect(() => {
		if (!window.location.hash) return undefined;
		const timers = scheduleFocus([window.location.hash]);
		return () => timers.forEach((timer) => window.clearTimeout(timer));
	}, [location.pathname]);

	useEffect(() => {
		const handleFocus = (event: Event) => {
			const target = (event as CustomEvent<HistoryFocusTarget>).detail;
			if (!target) return;
			const navigation = getHistoryFocusNavigation(target);
			const url = navigation.preserveCurrentRoute
				? window.location.pathname
				: buildNavigationUrl(
					navigation.campaignSlug,
					navigation.sessionFileName,
					navigation.encounterId,
				);
			if (!navigation.preserveCurrentRoute) {
				navigateTo(
					navigation.campaignSlug,
					navigation.sessionFileName,
					false,
					navigation.encounterId,
				);
			}
			if (!navigation.hash) return;

			const encodedHash = `#${encodeURIComponent(navigation.hash)}`;
			window.history.replaceState({}, "", `${url}${encodedHash}`);
			window.dispatchEvent(new HashChangeEvent("hashchange"));
			const hashes = [
				encodedHash,
				...navigation.fallbackHashes.map(
					(hash) => `#${encodeURIComponent(hash)}`,
				),
			];
			const timers = scheduleFocus(
				hashes,
				target.field || null,
				target.caretOffset ?? null,
				target.caretValueRevision ?? null,
			);
			window.setTimeout(() => {
				timers.forEach((timer) => window.clearTimeout(timer));
				if (
					window.location.pathname === url &&
					window.location.hash === encodedHash
				) {
					window.history.replaceState({}, "", url);
				}
			}, 3400);
		};
		window.addEventListener(HISTORY_FOCUS_EVENT, handleFocus);
		return () => window.removeEventListener(HISTORY_FOCUS_EVENT, handleFocus);
	}, []);

	return null;
}
