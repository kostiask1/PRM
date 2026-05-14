import { useEffect, useMemo, useState } from "react";

import { alert } from "../../actions/app";
import { api } from "../../api";
import "../../assets/components/ConditionsModal.css";
import Input from "../form/Input";
import { lang } from "../../services/localization";
import { useAppDispatch } from "../../store/appStore";
import { renderRecursiveContent } from "../../renderers/contentRenderer.jsx";
import ListCard from "../common/ListCard.jsx";

export default function DiseasesModalContent({ initialDiseaseName = "" }) {
	const dispatch = useAppDispatch();
	const [query, setQuery] = useState("");
	const [diseases, setDiseases] = useState([]);
	const [selectedDiseaseName, setSelectedDiseaseName] = useState("");
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let isMounted = true;

		const loadDiseases = async () => {
			setIsLoading(true);
			try {
				const list = await api.getDiseases();
				if (!isMounted) return;

				const normalizedList = Array.isArray(list) ? list : [];
				setDiseases(normalizedList);

				const preferredDisease = normalizedList.find(
					(item) => item.name === initialDiseaseName,
				);
				setSelectedDiseaseName(
					preferredDisease?.name || normalizedList?.[0]?.name || "",
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

		loadDiseases();

		return () => {
			isMounted = false;
		};
	}, [dispatch, initialDiseaseName]);

	useEffect(() => {
		if (!initialDiseaseName || !diseases.length) return;

		const preferredDisease = diseases.find(
			(item) => item.name === initialDiseaseName,
		);
		if (preferredDisease) {
			setSelectedDiseaseName(preferredDisease.name);
		}
	}, [diseases, initialDiseaseName]);

	const filteredDiseases = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();

		return diseases.filter((item) => {
			if (!normalizedQuery) return true;

			return [item.name, item.type]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(normalizedQuery));
		});
	}, [diseases, query]);

	useEffect(() => {
		if (!filteredDiseases.length) {
			setSelectedDiseaseName("");
			return;
		}

		const hasSelection = filteredDiseases.some(
			(item) => item.name === selectedDiseaseName,
		);
		if (!hasSelection) {
			setSelectedDiseaseName(filteredDiseases[0].name);
		}
	}, [filteredDiseases, selectedDiseaseName]);

	const selectedDisease =
		filteredDiseases.find((item) => item.name === selectedDiseaseName) ||
		diseases.find((item) => item.name === selectedDiseaseName) ||
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
					) : filteredDiseases.length ? (
						filteredDiseases.map((item) => (
							<ListCard
								key={item.name}
								onClick={() => setSelectedDiseaseName(item.name)}
								active={selectedDiseaseName === item.name}
							>
								<div className="ListCard__title">{item.name}</div>
								{item.type && <div className="ListCard__meta">{item.type}</div>}
							</ListCard>
						))
					) : (
						<p className="muted">{lang.t("No diseases found.")}</p>
					)}
				</div>
			</div>

			<div className="ConditionsModal__content">
				{selectedDisease && (
					<>
						<div className="ConditionsModal__contentHeader">
							<h3 className="ConditionsModal__title">{selectedDisease.name}</h3>
							{selectedDisease.type && (
								<div className="muted">{selectedDisease.type}</div>
							)}
						</div>

						<div className="ConditionsModal__entryContent">
							{renderRecursiveContent(selectedDisease.entries)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
