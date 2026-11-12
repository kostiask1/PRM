import { useCallback, useState } from "react";

export function useDicePanelRequest() {
	const [request, setRequest] = useState(0);
	const openDicePanel = useCallback(() => setRequest((value) => value + 1), []);
	return { request, openDicePanel };
}
