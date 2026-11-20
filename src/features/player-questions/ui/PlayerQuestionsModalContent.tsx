import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
	type MutableRefObject,
} from "react";

import questionsCatalog from "../../../../database/questions.json";
import "../../../assets/components/PlayerQuestionsModalContent.css";
import { lang, useDebounce } from "../../../shared/lib/index.js";
import { Button, TextInput } from "../../../shared/ui/index.js";
import {
	QUESTION_ROLL_CONTEXT,
	getDiceResultId,
	getLocalizedQuestions,
	getQuestionDiceRoll,
	getQuestionRollFormula,
	getQuestionSearchTarget,
	normalizeQuestionSearch,
} from "../model.ts";
import type { PlayerQuestionsModalContentProps } from "./playerQuestionsComposition.ts";

const SCROLL_DURATION_MS = 260;
const SEARCH_DEBOUNCE_MS = 250;

function easeOutCubic(value: number): number {
	return 1 - Math.pow(1 - value, 3);
}

function cancelScheduledScroll(
	animationFrameRef: MutableRefObject<number | null>,
): void {
	if (animationFrameRef.current === null) return;
	cancelAnimationFrame(animationFrameRef.current);
	animationFrameRef.current = null;
}

function scrollToQuestion(
	container: HTMLDivElement | null,
	target: HTMLDivElement | undefined,
	animationFrameRef: MutableRefObject<number | null>,
): void {
	cancelScheduledScroll(animationFrameRef);
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
	const maxTop = Math.max(
		0,
		scrollContainer.scrollHeight - scrollContainer.clientHeight,
	);
	const endTop = Math.max(0, Math.min(targetTop, maxTop));
	const distance = endTop - startTop;
	if (Math.abs(distance) < 0.5) return;

	const startedAt = performance.now();

	function step(now: number): void {
		const progress = Math.min((now - startedAt) / SCROLL_DURATION_MS, 1);
		scrollContainer.scrollTop = startTop + distance * easeOutCubic(progress);
		if (progress < 1) {
			animationFrameRef.current = requestAnimationFrame(step);
			return;
		}
		animationFrameRef.current = null;
	}

	animationFrameRef.current = requestAnimationFrame(step);
}

export default function PlayerQuestionsModalContent({
	runtime,
}: PlayerQuestionsModalContentProps) {
	const { rolledResult, useSearchDebounce } = runtime;
	const currentLanguage = lang.getLanguage();
	const questions = getLocalizedQuestions(questionsCatalog, currentLanguage);
	const QUESTIONS_COUNT = questions.length;
	const processedResultIdRef = useRef<unknown>(getDiceResultId(rolledResult));
	const skippedSearchScrollValueRef = useRef<string | null>(null);
	const scrollAnimationFrameRef = useRef<number | null>(null);
	const listContainerRef = useRef<HTMLDivElement>(null);
	const questionRefs = useRef<Partial<Record<number, HTMLDivElement>>>({});
	const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
	const [questionSearch, setQuestionSearch] = useState("");
	const debouncedQuestionSearch = useDebounce(
		questionSearch,
		useSearchDebounce ? SEARCH_DEBOUNCE_MS : 0,
	);
	const questionRollFormula = getQuestionRollFormula(QUESTIONS_COUNT);

	const cancelScrollAnimation = useCallback(() => {
		cancelScheduledScroll(scrollAnimationFrameRef);
	}, []);

	useEffect(() => cancelScrollAnimation, [cancelScrollAnimation]);

	const scrollToQuestionId = useCallback((questionId: number) => {
		setActiveQuestionId(questionId);
		scrollToQuestion(
			listContainerRef.current,
			questionRefs.current[questionId],
			scrollAnimationFrameRef,
		);
	}, []);

	useEffect(() => {
		const roll = getQuestionDiceRoll(rolledResult, QUESTIONS_COUNT);
		if (!roll || processedResultIdRef.current === roll.resultId) return;
		processedResultIdRef.current = roll.resultId;
		if (roll.questionId === null) return;

		const nextSearch = String(roll.questionId);
		skippedSearchScrollValueRef.current = nextSearch;
		setQuestionSearch(nextSearch);
		scrollToQuestionId(roll.questionId);
	}, [QUESTIONS_COUNT, rolledResult, scrollToQuestionId]);

	useEffect(() => {
		if (
			skippedSearchScrollValueRef.current !== null &&
			debouncedQuestionSearch === skippedSearchScrollValueRef.current
		) {
			skippedSearchScrollValueRef.current = null;
			return;
		}

		const questionId = getQuestionSearchTarget(
			debouncedQuestionSearch,
			QUESTIONS_COUNT,
		);
		if (questionId === null) return;
		scrollToQuestionId(questionId);
	}, [QUESTIONS_COUNT, debouncedQuestionSearch, scrollToQuestionId]);

	const rollQuestion = () => {
		runtime.requestDiceRoll({
			formula: questionRollFormula,
			context: { type: QUESTION_ROLL_CONTEXT },
		});
	};

	const handleQuestionSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
		skippedSearchScrollValueRef.current = null;
		setQuestionSearch(
			normalizeQuestionSearch(event.target.value, QUESTIONS_COUNT),
		);
	};

	return (
		<div className="PlayerQuestionsModalContent">
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

			<div
				ref={listContainerRef}
				className="PlayerQuestionsModalContent__list"
				role="list"
				onWheel={cancelScrollAnimation}
				onTouchStart={cancelScrollAnimation}
				onPointerDown={cancelScrollAnimation}
			>
				{questions.map((question, index) => {
					const questionId = index + 1;
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
				})}
			</div>
		</div>
	);
}
