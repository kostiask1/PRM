import { classNames, lang } from "../../../shared/lib/index.js";
import {
	getEncounterParticipantEntries,
	getEncounterParticipants,
	snapshotsEqual,
	type SnapshotRecord,
} from "../model/aiResponseModal.ts";

type EncounterSide = "before" | "after";

interface AiResponseEncounterParticipantListProps {
	counterpartSnapshot: unknown;
	getEncounterParticipantMeta: (participant: SnapshotRecord) => string;
	getEncounterParticipantName: (participant: SnapshotRecord) => string;
	side: EncounterSide;
	snapshot: unknown;
}

function getBeforeEncounterParticipantClassName(
	side: EncounterSide,
	isMissing: boolean,
): string | false {
	return side === "before" && isMissing && "is_removed";
}

function getAfterEncounterParticipantClassName(
	side: EncounterSide,
	isMissing: boolean,
): string | false {
	return side === "after" && isMissing && "is_added";
}

function getModifiedEncounterParticipantClassName(
	isChanged: boolean | undefined,
): string | false | undefined {
	return isChanged && "is_modified";
}

function getEncounterParticipantClassName(
	side: EncounterSide,
	isMissing: boolean,
	isChanged: boolean | undefined,
): string {
	return classNames(
		"AiAssistant__encounter_item",
		getBeforeEncounterParticipantClassName(side, isMissing),
		getAfterEncounterParticipantClassName(side, isMissing),
		getModifiedEncounterParticipantClassName(isChanged),
	);
}

export default function AiResponseEncounterParticipantList({
	counterpartSnapshot,
	getEncounterParticipantMeta,
	getEncounterParticipantName,
	side,
	snapshot,
}: AiResponseEncounterParticipantListProps) {
	const entries = getEncounterParticipantEntries(
		getEncounterParticipants(snapshot),
	);
	const counterpartEntries = getEncounterParticipantEntries(
		getEncounterParticipants(counterpartSnapshot),
	);
	const counterpartByKey = new Map(
		counterpartEntries.map((entry) => [entry.key, entry.participant]),
	);

	if (entries.length === 0) {
		return (
			<div className="AiAssistant__encounter_empty">
				{lang.t("No creatures in encounter.")}
			</div>
		);
	}

	return (
		<ol className="AiAssistant__encounter_list">
			{entries.map(({ key, participant, index }) => {
				const counterpart = counterpartByKey.get(key);
				const isMissing = !counterpart;
				const isChanged =
					counterpart && !snapshotsEqual(participant, counterpart);
				return (
					<li
						key={`${side}-${key}-${index}`}
						className={getEncounterParticipantClassName(
							side,
							isMissing,
							isChanged,
						)}
					>
						<span className="AiAssistant__encounter_item_name">
							{getEncounterParticipantName(participant)}
						</span>
						{getEncounterParticipantMeta(participant) && (
							<span className="AiAssistant__encounter_item_meta">
								{getEncounterParticipantMeta(participant)}
							</span>
						)}
					</li>
				);
			})}
		</ol>
	);
}
