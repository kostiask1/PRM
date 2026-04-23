import { renderRecursiveContent } from "../utils/parser.jsx";
import { resolveConditionInput } from "../utils/referenceResolvers.js";
import { openConditionsModal } from "../components/modals/openConditionsModal.jsx";

export default function useConditionReference({
	externalOnConditionClick = null,
	onSpellClick: _onSpellClick,
	getSpellHoverHandler: _getSpellHoverHandler = null,
	modalContentClassName: _modalContentClassName,
}) {
	const handleConditionHover = async (conditionName) => {
		const condition = await resolveConditionInput(conditionName);
		if (!condition) return null;
		return (
			<div>
				<div className="Tooltip__title">{condition.name}</div>
				{condition.source && (
					<div className="Tooltip__meta">{condition.source}</div>
				)}
				<div className="Tooltip__text">
					{renderRecursiveContent(condition.entries, null, null, null, null)}
				</div>
			</div>
		);
	};

	const handleConditionClick = async (nameOrCondition) => {
		if (externalOnConditionClick) {
			externalOnConditionClick(nameOrCondition);
			return;
		}

		const condition = await resolveConditionInput(nameOrCondition);
		if (!condition) return;

		openConditionsModal(condition.name);
	};

	return { handleConditionClick, handleConditionHover };
}
