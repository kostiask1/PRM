import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactList from "react-list";

import { requestDiceRollAction } from "../../actions/app";
import questions from "../../../database/questions.json";
import "../../assets/components/PlayerQuestionsModalContent.css";
import Button from "../form/Button";
import { useAppDispatch, useAppSelector } from "../../store/appStore";

const QUESTION_ROLL_CONTEXT = "playerQuestions";
const SCROLL_DURATION_MS = 260;

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
	const processedResultIdRef = useRef(rolledResult?.resultId ?? null);
	const listRef = useRef(null);
	const rootRef = useRef(null);
	const questionRefs = useRef({});
	const [activeQuestionId, setActiveQuestionId] = useState(null);
	const [isListReady, setIsListReady] = useState(false);

	useLayoutEffect(() => {
		setIsListReady(Boolean(rootRef.current));
	}, []);

	useEffect(() => {
		const resultId = rolledResult?.resultId;
		if (!resultId || processedResultIdRef.current === resultId) return;
		processedResultIdRef.current = resultId;

		if (rolledResult.context?.type !== QUESTION_ROLL_CONTEXT) return;

		const questionId = Number(rolledResult.result?.total);
		if (!Number.isInteger(questionId) || questionId < 1 || questionId > 500) {
			return;
		}

		setActiveQuestionId(questionId);
		listRef.current?.scrollTo(questionId - 1);
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				scrollToQuestion(rootRef.current, questionRefs.current[questionId]);
			});
		});
	}, [rolledResult]);

	const rollQuestion = () => {
		dispatch(
			requestDiceRollAction({
				formula: "1d500",
				context: { type: QUESTION_ROLL_CONTEXT },
			}),
		);
	};

	const renderQuestion = (index, key) => {
		const questionId = index + 1;
		const question = questions[index];

		return (
			<div
				key={key}
				ref={(node) => {
					if (node) questionRefs.current[questionId] = node;
					else delete questionRefs.current[questionId];
				}}
				className={
					activeQuestionId === questionId
						? "PlayerQuestionsModalContent__item PlayerQuestionsModalContent__item__active"
						: "PlayerQuestionsModalContent__item"
				}
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
					Кинути 1d500
				</Button>
				{activeQuestionId && (
					<span className="PlayerQuestionsModalContent__rollResult">
						Питання #{activeQuestionId}
					</span>
				)}
			</div>

			<div className="PlayerQuestionsModalContent__list" role="list">
				{isListReady && (
					<ReactList
						ref={listRef}
						itemRenderer={renderQuestion}
						length={questions.length}
						scrollParentGetter={() => rootRef.current}
						type="uniform"
					/>
				)}
			</div>
		</div>
	);
}
