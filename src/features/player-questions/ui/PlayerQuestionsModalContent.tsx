import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ChangeEvent,
} from "react";
import ReactList from "react-list";

import questions from "../../../../database/questions.json";
import "../../../assets/components/PlayerQuestionsModalContent.css";
import { lang, useDebounce } from "../../../shared/lib/index.js";
import { Button, TextInput } from "../../../shared/ui/index.js";
import {
	QUESTION_ROLL_CONTEXT,
	getDiceResultId,
	getQuestionDiceRoll,
	getQuestionRollFormula,
	getQuestionSearchTarget,
	normalizeQuestionSearch,
} from "../model.ts";
import type { PlayerQuestionsModalContentProps } from "./playerQuestionsComposition.ts";

const SCROLL_DURATION_MS = 260;
const SEARCH_DEBOUNCE_MS = 250;
const QUESTIONS_COUNT = questions.length;

function easeOutCubic(value: number): number {
	return 1 - Math.pow(1 - value, 3);
}

function scrollToQuestion(
	container: HTMLDivElement | null,
	target: HTMLDivElement | undefined,
): void {
	if (!container || !target) return;
	const scrollContainer = container;

	const containerRect = scrollContainer.getBoundingClientRect();
	const targetRect = target.getBoundingClientRect();
	const startTop = scrollContainer.scrollTop;
	const targetTop =
		startTop +
		targetRect.top -
		containerRect.top -
		scrollContainer.clientHeight / 2 +
		target.clientHeight / 2;
	const maxTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
	const endTop = Math.max(0, Math.min(targetTop, maxTop));
	const distance = endTop - startTop;
	const startedAt = performance.now();

	function step(now: number): void {
		const progress = Math.min((now - startedAt) / SCROLL_DURATION_MS, 1);
		scrollContainer.scrollTop = startTop + distance * easeOutCubic(progress);
		if (progress < 1) requestAnimationFrame(step);
	}

	requestAnimationFrame(step);
}

export default function PlayerQuestionsModalContent({
	runtime,
}: PlayerQuestionsModalContentProps) {
	const { rolledResult, useSearchDebounce } = runtime;
	const processedResultIdRef = useRef<unknown>(getDiceResultId(rolledResult));
	const listRef = useRef<ReactList>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const questionRefs = useRef<Partial<Record<number, HTMLDivElement>>>({});
	const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
	const [questionSearch, setQuestionSearch] = useState("");
	const [isListReady, setIsListReady] = useState(false);
	const debouncedQuestionSearch = useDebounce(
		questionSearch,
		useSearchDebounce ? SEARCH_DEBOUNCE_MS : 0,
	);
	const questionRollFormula = getQuestionRollFormula(QUESTIONS_COUNT);

	useLayoutEffect(() => {
		setIsListReady(Boolean(rootRef.current));
	}, []);

	const scrollToQuestionId = useCallback((questionId: number) => {
		setActiveQuestionId(questionId);
		listRef.current?.scrollTo(questionId - 1);
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				scrollToQuestion(rootRef.current, questionRefs.current[questionId]);
			});
		});
	}, []);

	useEffect(() => {
		const roll = getQuestionDiceRoll(rolledResult, QUESTIONS_COUNT);
		if (!roll || processedResultIdRef.current === roll.resultId) return;
		processedResultIdRef.current = roll.resultId;
		if (roll.questionId === null) return;

		setQuestionSearch(String(roll.questionId));
		scrollToQuestionId(roll.questionId);
	}, [rolledResult, scrollToQuestionId]);

	useEffect(() => {
		const questionId = getQuestionSearchTarget(
			debouncedQuestionSearch,
			QUESTIONS_COUNT,
		);
		if (questionId === null) return;
		scrollToQuestionId(questionId);
	}, [debouncedQuestionSearch, scrollToQuestionId]);

	const rollQuestion = () => {
		runtime.requestDiceRoll({
			formula: questionRollFormula,
			context: { type: QUESTION_ROLL_CONTEXT },
		});
	};

	const handleQuestionSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
		setQuestionSearch(
			normalizeQuestionSearch(event.target.value, QUESTIONS_COUNT),
		);
	};

	const renderQuestion = (index: number) => {
		const questionId = index + 1;
		const question = questions[index];

		return (
			<div
				key={questionId}
				ref={(node) => {
					if (node) questionRefs.current[questionId] = node;
					else delete questionRefs.current[questionId];
				}}
				className={
					activeQuestionId === questionId
						? "PlayerQuestionsModalContent__item PlayerQuestionsModalContent__item__active"
						: "PlayerQuestionsModalContent__item"
				}
				onClick={() => setActiveQuestionId(questionId)}
				role="listitem"
			>
				<span className="PlayerQuestionsModalContent__number">
					{questionId}
				</span>
				<span className="PlayerQuestionsModalContent__question">
					{question}
				</span>
			</div>
		);
	};

	return (
		<div ref={rootRef} className="PlayerQuestionsModalContent">
			<div className="PlayerQuestionsModalContent__toolbar">
				<Button variant="primary" icon="dice" onClick={rollQuestion}>
					{lang.t("Roll 1d{count}", { count: QUESTIONS_COUNT })}
				</Button>
				<div className="PlayerQuestionsModalContent__search">
					<TextInput
						value={questionSearch}
						onChange={handleQuestionSearchChange}
						inputMode="numeric"
						placeholder={lang.t("Question number")}
					/>
				</div>
				<div className="PlayerQuestionsModalContent__hint">
					{lang.t("Standard dice formula for {count} questions: {formula}", {
						count: QUESTIONS_COUNT,
						formula: questionRollFormula,
					})}
				</div>
			</div>

			<div className="PlayerQuestionsModalContent__list" role="list">
				{isListReady && (
					<ReactList
						ref={listRef}
						itemRenderer={renderQuestion}
						length={QUESTIONS_COUNT}
						scrollParentGetter={() => rootRef.current}
						type="uniform"
					/>
				)}
			</div>
		</div>
	);
}
