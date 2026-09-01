import { useMemo } from "react";

import {
	PlayerQuestionsModalContent,
	type PlayerQuestionsRuntime,
} from "../../../features/player-questions/index.js";
import { useSidebarRuntime } from "./SidebarRuntime.tsx";

function useSidebarPlayerQuestionsRuntime(): PlayerQuestionsRuntime {
	const { rolledResult, requestDiceRoll, useSearchDebounce } =
		useSidebarRuntime();

	return useMemo<PlayerQuestionsRuntime>(
		() => ({
			rolledResult,
			useSearchDebounce: useSearchDebounce !== false,
			requestDiceRoll,
		}),
		[requestDiceRoll, rolledResult, useSearchDebounce],
	);
}

export function SidebarPlayerQuestionsModalContent() {
	const runtime = useSidebarPlayerQuestionsRuntime();
	return <PlayerQuestionsModalContent runtime={runtime} />;
}
