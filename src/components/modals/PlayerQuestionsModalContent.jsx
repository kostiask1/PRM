import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactList from "react-list";

import { requestDiceRollAction } from "../../actions/app";
import questions from "../../../database/questions.json";
import "../../assets/components/PlayerQuestionsModalContent.css";
import Button from "../form/Button";
import Input from "../form/Input";
import { lang } from "../../services/localization";
import { useAppDispatch, useAppSelector } from "../../store/appStore";

const QUESTION_ROLL_CONTEXT = "playerQuestions";
const SCROLL_DURATION_MS = 260;
const QUESTIONS_COUNT = questions.length;

function easeOutCubic(value) {
	return 1 - Math.pow(1 - value, 3);
}

function scrollToQuestion(container, target) {
	if (!container || !target) return;

	const containerRect = container.getBoundingClientRect();
	const targetRect = target.getBoundingClientRect();
	const startTop = container.scrollTop;
	const targetTop =
		startTop +
		targetRect.top -
		containerRect.top -
		container.clientHeight / 2 +
		target.clientHeight / 2;
	const maxTop = container.scrollHeight - container.clientHeight;
	const endTop = Math.max(0, Math.min(targetTop, maxTop));
	const distance = endTop - startTop;
	const startedAt = performance.now();

	function step(now) {
		const progress = Math.min((now - startedAt) / SCROLL_DURATION_MS, 1);
		container.scrollTop = startTop + distance * easeOutCubic(progress);
		if (progress < 1) requestAnimationFrame(step);
	}

	requestAnimationFrame(step);
}

export default function PlayerQuestionsModalContent() {
	const dispatch = useAppDispatch();
	const rolledResult = useAppSelector((state) => state.dice.rolledResult);
	const currentLanguage = useAppSelector(
		(state) => state.localization.language || "en",
	);
	const processedResultIdRef = useRef(rolledResult?.resultId ?? null);
	const listRef = useRef(null);
	const rootRef = useRef(null);
	const questionRefs = useRef({});
	const [activeQuestionId, setActiveQuestionId] = useState(null);
	const [questionSearch, setQuestionSearch] = useState("");
	const [isListReady, setIsListReady] = useState(false);

	useLayoutEffect(() => {
		setIsListReady(Boolean(rootRef.current));
	}, []);

	const scrollToQuestionId = useCallback((questionId) => {
		setActiveQuestionId(questionId);
		listRef.current?.scrollTo(questionId - 1);
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				scrollToQuestion(rootRef.current, questionRefs.current[questionId]);
			});
		});
	}, []);

	useEffect(() => {
		const resultId = rolledResult?.resultId;
		if (!resultId || processedResultIdRef.current === resultId) return;
		processedResultIdRef.current = resultId;

		if (rolledResult.context?.type !== QUESTION_ROLL_CONTEXT) return;

		const questionId = Number(rolledResult.result?.total);
		if (
			!Number.isInteger(questionId) ||
			questionId < 1 ||
			questionId > QUESTIONS_COUNT
		) {
			return;
		}

		setQuestionSearch(String(questionId));
		scrollToQuestionId(questionId);
	}, [rolledResult, scrollToQuestionId]);

	const rollQuestion = () => {
		dispatch(
			requestDiceRollAction({
				formula: `1d${QUESTIONS_COUNT}`,
				context: { type: QUESTION_ROLL_CONTEXT },
			}),
		);
	};

	const handleQuestionSearchChange = (event) => {
		const digits = event.target.value.replace(/\D+/g, "");
		if (!digits) {
			setQuestionSearch("");
			return;
		}

		const questionId = Math.max(1, Math.min(Number(digits), QUESTIONS_COUNT));
		setQuestionSearch(String(questionId));
		scrollToQuestionId(questionId);
	};

	const handleQuestionClick = (event, questionId) => {
		setActiveQuestionId(questionId);
		if (currentLanguage === "en") return;

		const questionNode = event.currentTarget.querySelector(
			".PlayerQuestionsModalContent__question",
		);
		if (!questionNode) return;

		const selection = window.getSelection?.();
		if (!selection) return;

		const range = document.createRange();
		range.selectNodeContents(questionNode);
		selection.removeAllRanges();
		selection.addRange(range);
	};

	const renderQuestion = (index) => {
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
				onClick={(event) => handleQuestionClick(event, questionId)}
				role="listitem"
			>
				<span className="PlayerQuestionsModalContent__number">{questionId}</span>
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
					<Input
						value={questionSearch}
						onChange={handleQuestionSearchChange}
						inputMode="numeric"
						placeholder={lang.t("Question number")}
					/>
				</div>
				<div className="PlayerQuestionsModalContent__hint">
					{lang.t(
						"Instead of rolling 1d{count}, you can roll (1d6 - 1) + 1d100 + 1d10.",
						{ count: QUESTIONS_COUNT },
					)}
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
