import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { alert } from "../../actions/app";
import { api } from "../../api";
import "../../assets/components/ConditionsModal.css";
import Input from "../form/Input";
import { lang } from "../../services/localization";
import { openModalRequest, useAppDispatch } from "../../store/appStore";
import { renderRecursiveContent } from "../../renderers/contentRenderer.jsx";
import { getSpellByName } from "../../services/referencePreview.js";
import {
	resolveConditionInput,
	resolveSpellInput,
} from "../../services/referenceResolvers.js";
import ListCard from "../common/ListCard.jsx";
import { openConditionsModal } from "./openConditionsModal.jsx";

const SpellCard = lazy(() => import("../SpellCard"));

function normalizeName(name) {
	return String(name || "")
		.trim()
		.toLowerCase();
}

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

	const findDisease = (nameOrDisease) => {
		if (nameOrDisease && typeof nameOrDisease === "object") {
			return nameOrDisease.name ? nameOrDisease : null;
		}

		const key = normalizeName(nameOrDisease);
		if (!key) return null;
		return diseases.find((item) => normalizeName(item.name) === key) || null;
	};

	async function handleSpellClick(spellOrName) {
		const spell = await resolveSpellInput(spellOrName);
		if (!spell) return;

		openModalRequest({
			title: spell.name.split("|")[0],
			type: "confirm",
			showFooter: false,
			children: (
				<Suspense fallback={null}>
					<SpellCard
						spell={spell}
						onSpellClick={handleSpellClick}
						onConditionClick={handleConditionClick}
					/>
				</Suspense>
			),
		});
	}

	async function handleSpellHover(spellName) {
		const spell = await getSpellByName(spellName);
		if (!spell) return null;

		return (
			<div className="Tooltip__spell-card">
				<Suspense fallback={null}>
					<SpellCard
						spell={spell}
						onSpellClick={handleSpellClick}
						onConditionClick={handleConditionClick}
					/>
				</Suspense>
			</div>
		);
	}

	async function handleConditionClick(nameOrCondition) {
		const condition = await resolveConditionInput(nameOrCondition);
		if (!condition) return;
		openConditionsModal(condition.name);
	}

	async function handleConditionHover(nameOrCondition) {
		const condition = await resolveConditionInput(nameOrCondition);
		if (!condition) return null;

		return (
			<div>
				<div className="Tooltip__title">{condition.name}</div>
				<div className="Tooltip__text">
					{renderRecursiveContent(condition.entries, null, null, null, null)}
				</div>
			</div>
		);
	}

	function handleDiseaseClick(nameOrDisease) {
		const disease = findDisease(nameOrDisease);
		if (!disease) return;
		setSelectedDiseaseName(disease.name);
	}

	function handleDiseaseHover(nameOrDisease) {
		const disease = findDisease(nameOrDisease);
		if (!disease) return null;

		return (
			<div>
				<div className="Tooltip__title">{disease.name}</div>
				<div className="Tooltip__text">
					{renderRecursiveContent(disease.entries, null, null, null, null)}
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
							{renderRecursiveContent(
								selectedDisease.entries,
								handleSpellClick,
								handleConditionClick,
								handleSpellHover,
								handleConditionHover,
								handleDiseaseClick,
								handleDiseaseHover,
							)}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
