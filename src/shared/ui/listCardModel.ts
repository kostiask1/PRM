export interface ListCardModifierEvent {
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
}

export interface ListCardClickPlan {
	preventDefault: boolean;
	invokeOnClick: boolean;
}

function hasNavigationModifier(event: ListCardModifierEvent): boolean {
	return event.ctrlKey || event.metaKey || event.shiftKey;
}

function shouldHandleLink(
	href: string | undefined,
	event: ListCardModifierEvent,
): boolean {
	if (!href) return false;
	return !hasNavigationModifier(event);
}

export function getListCardClickPlan(
	href: string | undefined,
	hasOnClick: boolean,
	event: ListCardModifierEvent,
): ListCardClickPlan {
	const handleLink = shouldHandleLink(href, event);
	return {
		preventDefault: handleLink,
		invokeOnClick: hasOnClick ? !href || handleLink : false,
	};
}
