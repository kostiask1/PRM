import { useEffect, useMemo, useState } from "react";

import { alert } from "../../actions/app";
import { api } from "../../api";
import "../../assets/components/ConditionsModal.css";
import SpellCard from "../SpellCard";
import Input from "../form/Input";
import { lang } from "../../services/localization";
import { openModalRequest, useAppDispatch } from "../../store/appStore";
import { renderRecursiveContent } from "../../utils/parser.jsx";
import { getSpellByName } from "../../utils/referencePreview.js";
import {
	resolveConditionInput,
	resolveSpellInput,
} from "../../utils/referenceResolvers.js";
import ListCard from "../common/ListCard.jsx";

export default function ConditionsModalContent({ initialConditionName = "" }) {
	const dispatch = useAppDispatch();
	const [query, setQuery] = useState("");
	const [conditions, setConditions] = useState([]);
	const [selectedConditionName, setSelectedConditionName] = useState("");
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let isMounted = true;

		const loadConditions = async () => {
			setIsLoading(true);
			try {
				const list = await api.getConditions();
				if (!isMounted) return;

				const normalizedList = Array.isArray(list) ? list : [];
				setConditions(normalizedList);

				const preferredCondition = normalizedList.find(
					(item) => item.name === initialConditionName,
				);
				setSelectedConditionName(
					preferredCondition?.name || normalizedList?.[0]?.name || "",
				);
			} catch (error) {
				if (!isMounted) return;

				dispatch(
					alert({
						title: lang.t("Error"),
						message: error.message || lang.t("Unknown error"),
					}),
				);
			} finally {
				if (isMounted) setIsLoading(false);
			}
		};

		loadConditions();

		return () => {
			isMounted = false;
		};
	}, [dispatch, initialConditionName]);

	useEffect(() => {
		if (!initialConditionName || !conditions.length) return;

		const preferredCondition = conditions.find(
			(item) => item.name === initialConditionName,
		);
		if (preferredCondition) {
			setSelectedConditionName(preferredCondition.name);
		}
	}, [conditions, initialConditionName]);

	const filteredConditions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return conditions.filter((item) => {
			if (!normalizedQuery) return true;

			return [item.name, item.source]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(normalizedQuery));
		});
	}, [conditions, query]);

	useEffect(() => {
		if (!filteredConditions.length) {
			setSelectedConditionName("");
			return;
		}

		const hasSelection = filteredConditions.some(
			(item) => item.name === selectedConditionName,
		);
		if (!hasSelection) {
			setSelectedConditionName(filteredConditions[0].name);
		}
	}, [filteredConditions, selectedConditionName]);

	const selectedCondition =
		filteredConditions.find((item) => item.name === selectedConditionName) ||
		conditions.find((item) => item.name === selectedConditionName) ||
		null;

	async function handleSpellClick(spellOrName) {
		const spell = await resolveSpellInput(spellOrName);
		if (!spell) return;

		openModalRequest({
			title: spell.name.split("|")[0],
			type: "confirm",
			showFooter: false,
			children: (
				<SpellCard
					spell={spell}
					onSpellClick={handleSpellClick}
					onConditionClick={handleConditionClick}
				/>
			),
		});
	}

	async function handleSpellHover(spellName) {
		const spell = await getSpellByName(spellName);
		if (!spell) return null;

		return (
			<div className="Tooltip__spell-card">
				<SpellCard
					spell={spell}
					onSpellClick={handleSpellClick}
					onConditionClick={handleConditionClick}
				/>
			</div>
		);
	}

	async function handleConditionClick(nameOrCondition) {
		const condition = await resolveConditionInput(nameOrCondition);
		if (!condition) return;
		setSelectedConditionName(condition.name);
	}

	async function handleConditionHover(nameOrCondition) {
		const condition = await resolveConditionInput(nameOrCondition);
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
	}

	return (
		<div className="ConditionsModal">
			<div className="ConditionsModal__sidebar">
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={lang.t("Search")}
					autoFocus
				/>

				<div className="ConditionsModal__list">
					{isLoading ? (
						<p className="muted">{lang.t("Loading...")}</p>
					) : filteredConditions.length ? (
						filteredConditions.map((item) => (
							<ListCard
								key={item.name}
								onClick={() => setSelectedConditionName(item.name)}
								active={selectedConditionName === item.name}
							>
								<div className="ListCard__title">{item.name}</div>
							</ListCard>
						))
					) : (
						<p className="muted">
							{lang.t("No conditions or statuses found.")}
						</p>
					)}
				</div>
			</div>

			<div className="ConditionsModal__content">
				{selectedCondition && (
					<>
						<div className="ConditionsModal__contentHeader">
							<h3 className="ConditionsModal__title">
								{selectedCondition.name}
							</h3>
						</div>

						<div className="ConditionsModal__entryContent">
							{renderRecursiveContent(
								selectedCondition.entries,
								handleSpellClick,
								handleConditionClick,
								handleSpellHover,
								handleConditionHover,
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
