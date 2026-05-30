import { useEffect, useRef, useState } from "react";

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
	const rootRef = useRef(null);
	const questionRefs = useRef({});
	const [activeQuestionId, setActiveQuestionId] = useState(null);

	useEffect(() => {
		const resultId = rolledResult?.resultId;
		if (!resultId || processedResultIdRef.current === resultId) return;
		processedResultIdRef.current = resultId;

		if (rolledResult.context?.type !== QUESTION_ROLL_CONTEXT) return;

		const questionId = Number(rolledResult.result?.total);
		if (!Number.isInteger(questionId) || questionId < 1 || questionId > 300) {
			return;
		}

		setActiveQuestionId(questionId);
		window.setTimeout(() => {
			scrollToQuestion(rootRef.current, questionRefs.current[questionId]);
		}, 0);
	}, [rolledResult]);

	const rollQuestion = () => {
		dispatch(
			requestDiceRollAction({
				formula: "1d300",
				context: { type: QUESTION_ROLL_CONTEXT },
			}),
		);
	};

	return (
		<div ref={rootRef} className="PlayerQuestionsModalContent">
			<div className="PlayerQuestionsModalContent__toolbar">
				<Button variant="primary" icon="dice" onClick={rollQuestion}>
					Кинути 1d300
				</Button>
				{activeQuestionId && (
					<span className="PlayerQuestionsModalContent__rollResult">
						Питання #{activeQuestionId}
					</span>
				)}
			</div>

			<ol className="PlayerQuestionsModalContent__list">
				{questions.map((question, index) => {
					const questionId = index + 1;

					return (
						<li
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
						>
							<span className="PlayerQuestionsModalContent__number">
								{questionId}
							</span>
							<span className="PlayerQuestionsModalContent__question">
								{question}
							</span>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
