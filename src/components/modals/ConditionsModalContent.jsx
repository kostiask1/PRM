import { useEffect, useMemo, useState } from "react";

import { alert } from "../../actions/app";
import { api } from "../../api";
import "../../assets/components/ConditionsModal.css";
import Input from "../form/Input";
import { lang } from "../../services/localization";
import { useAppDispatch } from "../../store/appStore";
import { renderRecursiveContent } from "../../renderers/contentRenderer.jsx";
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

			return [item.name]
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
							{renderRecursiveContent(selectedCondition.entries)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
