import { useMemo } from "react";

import {
	PlayerQuestionsModalContent,
	type PlayerQuestionsRuntime,
} from "../../../features/player-questions/index.js";
import {
	requestDiceRollAction,
	useAppDispatch,
	useAppSelector,
} from "../../../shared/model/index.js";

function useSidebarPlayerQuestionsRuntime(): PlayerQuestionsRuntime {
	const dispatch = useAppDispatch();
	const rolledResult = useAppSelector((state) => state.dice.rolledResult);
	const useSearchDebounce = useAppSelector(
		(state) => state.ui.useSearchDebounce !== false,
	);

	return useMemo<PlayerQuestionsRuntime>(
		() => ({
			rolledResult,
			useSearchDebounce,
			requestDiceRoll(request) {
				dispatch(requestDiceRollAction(request));
			},
		}),
		[dispatch, rolledResult, useSearchDebounce],
	);
}

export function SidebarPlayerQuestionsModalContent() {
	const runtime = useSidebarPlayerQuestionsRuntime();
	return <PlayerQuestionsModalContent runtime={runtime} />;
}
