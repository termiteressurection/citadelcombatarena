use crate::journal_log::JournalEvent;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HorizonType {
    Day,
    Week,
    Month,
    Season,
    Year,
}

impl HorizonType {
    fn days(self) -> i64 {
        match self {
            Self::Day => 1,
            Self::Week => 7,
            Self::Month => 30,
            Self::Season => 90,
            Self::Year => 365,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatternEvidence {
    pub event_id: String,
    pub entry_id: String,
    pub day: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatternRecord {
    pub id: String,
    pub horizon: HorizonType,
    pub entity: String,
    pub outcome: String,
    pub observed_count: usize,
    pub cohort_count: usize,
    pub supporting_event_ids: Vec<String>,
    pub counterexample_event_ids: Vec<String>,
    pub supporting_evidence: Vec<PatternEvidence>,
    pub counterexample_evidence: Vec<PatternEvidence>,
    pub statement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HorizonPatterns {
    pub horizon: HorizonType,
    pub entries_recorded: usize,
    pub still_gathering: bool,
    pub patterns: Vec<PatternRecord>,
}

#[tauri::command]
pub fn get_patterns_for_horizon(
    horizon: HorizonType,
    runtime: State<'_, crate::VaultRuntime>,
) -> Result<HorizonPatterns, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let events = journal.verified_events()?;
    Ok(analyze_events(&events, horizon, utc_today_ordinal()))
}

#[tauri::command]
pub fn get_entity_patterns(
    entity: String,
    runtime: State<'_, crate::VaultRuntime>,
) -> Result<Vec<PatternRecord>, String> {
    let _gate = crate::APP_DATA_GATE
        .read()
        .map_err(|_| "Wipe gate poisoned".to_string())?;
    let services_guard = runtime.data()?;
    let services = services_guard
        .as_ref()
        .ok_or_else(|| "Vault is locked".to_string())?;
    let journal = &services.journal;
    let events = journal.verified_events()?;
    Ok(
        analyze_events(&events, HorizonType::Year, utc_today_ordinal())
            .patterns
            .into_iter()
            .filter(|pattern| pattern.entity.eq_ignore_ascii_case(entity.trim()))
            .collect(),
    )
}

fn analyze_events(events: &[JournalEvent], horizon: HorizonType, as_of: i64) -> HorizonPatterns {
    let window_start = as_of - horizon.days() + 1;
    let selected: Vec<&JournalEvent> = events
        .iter()
        .filter(|event| {
            parse_day(&event.payload.day)
                .map(|day| day >= window_start && day <= as_of)
                .unwrap_or(false)
                && !event.payload.text.trim().is_empty()
                && !event.payload.tags.iter().any(|tag| {
                    tag.eq_ignore_ascii_case("sigma-chat")
                        || tag.eq_ignore_ascii_case("non-inscription")
                })
        })
        .collect();
    let entries_recorded = selected.len();
    if entries_recorded < 10 {
        return HorizonPatterns {
            horizon,
            entries_recorded,
            still_gathering: true,
            patterns: Vec::new(),
        };
    }

    let features: Vec<BTreeSet<String>> =
        selected.iter().map(|event| event_features(event)).collect();
    let mut cohorts: BTreeMap<String, Vec<usize>> = BTreeMap::new();
    for (index, labels) in features.iter().enumerate() {
        for label in labels {
            cohorts.entry(label.clone()).or_default().push(index);
        }
    }

    let mut patterns = Vec::new();
    for (entity, cohort) in &cohorts {
        if entity.starts_with("mood:")
            || entity.starts_with("energy:")
            || entity.starts_with("sentiment:")
        {
            continue;
        }
        for (outcome, outcome_indices) in &cohorts {
            if entity == outcome || outcome_indices.len() < 3 {
                continue;
            }
            let support_indices: Vec<usize> = cohort
                .iter()
                .copied()
                .filter(|index| features[*index].contains(outcome))
                .collect();
            let counter_indices: Vec<usize> = cohort
                .iter()
                .copied()
                .filter(|index| !features[*index].contains(outcome))
                .collect();
            if support_indices.len() < 3 || counter_indices.is_empty() {
                continue;
            }

            let observed_count = support_indices.len();
            let cohort_count = cohort.len();
            let entity_label = display_entity(entity);
            let outcome_label = display_feature(outcome);
            let statement = if entries_recorded < 20 {
                format!(
                    "{observed_count} of {cohort_count} {entity_label} also included {outcome_label}; this record is still forming."
                )
            } else {
                format!(
                    "The journal shows an association: {outcome_label} appeared in {observed_count} of {cohort_count} {entity_label}; {} such entries did not include it. These records describe co-occurrence and do not establish cause.",
                    counter_indices.len()
                )
            };
            let supporting_evidence: Vec<PatternEvidence> = support_indices
                .iter()
                .map(|index| evidence(selected[*index]))
                .collect();
            let counterexample_evidence: Vec<PatternEvidence> = counter_indices
                .iter()
                .map(|index| evidence(selected[*index]))
                .collect();
            let supporting_event_ids = supporting_evidence
                .iter()
                .map(|item| item.event_id.clone())
                .collect();
            let counterexample_event_ids = counterexample_evidence
                .iter()
                .map(|item| item.event_id.clone())
                .collect();
            patterns.push(PatternRecord {
                id: format!("{}=>{}", entity, outcome),
                horizon,
                entity: entity.clone(),
                outcome: outcome.clone(),
                observed_count,
                cohort_count,
                supporting_event_ids,
                counterexample_event_ids,
                supporting_evidence,
                counterexample_evidence,
                statement,
            });
        }
    }
    patterns.sort_by(|left, right| {
        right
            .observed_count
            .cmp(&left.observed_count)
            .then_with(|| left.entity.cmp(&right.entity))
            .then_with(|| left.outcome.cmp(&right.outcome))
    });
    patterns.truncate(80);
    HorizonPatterns {
        horizon,
        entries_recorded,
        still_gathering: entries_recorded < 20,
        patterns,
    }
}

fn display_entity(label: &str) -> String {
    if let Some(tag) = label.strip_prefix("tag:") {
        return format!("entries tagged {}", tag.replace(['_', '-'], " "));
    }
    if let Some(day) = label.strip_prefix("rhythm:weekday:") {
        let weekday = match day {
            "mon" => "Mondays",
            "tue" => "Tuesdays",
            "wed" => "Wednesdays",
            "thu" => "Thursdays",
            "fri" => "Fridays",
            "sat" => "Saturdays",
            _ => "Sundays",
        };
        return format!("entries inscribed on {weekday}");
    }
    if let Some(time) = label.strip_prefix("rhythm:time:") {
        return format!("entries inscribed in the {time}");
    }
    format!("entries marked {}", display_feature(label))
}

fn display_feature(label: &str) -> String {
    for (kind, suffix) in [
        ("energy:", "energy"),
        ("mood:", "mood"),
        ("sentiment:", "sentiment"),
        ("location:", "location"),
        ("person:", "person"),
        ("entity:", "entity"),
    ] {
        if let Some(value) = label.strip_prefix(kind) {
            return format!("{} {suffix}", value.replace(['_', '-'], " "));
        }
    }
    if let Some(day) = label.strip_prefix("rhythm:weekday:") {
        return match day {
            "mon" => "Monday entries",
            "tue" => "Tuesday entries",
            "wed" => "Wednesday entries",
            "thu" => "Thursday entries",
            "fri" => "Friday entries",
            "sat" => "Saturday entries",
            _ => "Sunday entries",
        }
        .to_string();
    }
    if let Some(time) = label.strip_prefix("rhythm:time:") {
        return format!("{}-time entries", time);
    }
    label
        .strip_prefix("tag:")
        .unwrap_or(label)
        .replace(['_', '-'], " ")
}

fn evidence(event: &JournalEvent) -> PatternEvidence {
    PatternEvidence {
        event_id: event.event_id.clone(),
        entry_id: event.payload.entry_id.clone(),
        day: event.payload.day.clone(),
        text: event.payload.text.clone(),
    }
}

fn event_features(event: &JournalEvent) -> BTreeSet<String> {
    let mut labels = BTreeSet::new();
    for tag in &event.payload.tags {
        let tag = tag.trim().to_lowercase();
        if tag.is_empty()
            || matches!(
                tag.as_str(),
                "user-inscription" | "sigma-chat" | "non-inscription"
            )
        {
            continue;
        }
        if let Some((kind, value)) = tag.split_once(':') {
            if matches!(
                kind,
                "mood" | "energy" | "sentiment" | "location" | "person" | "people" | "entity"
            ) && !value.is_empty()
            {
                let singular = if kind == "people" { "person" } else { kind };
                labels.insert(format!("{singular}:{value}"));
                continue;
            }
        }
        labels.insert(format!("tag:{tag}"));
    }
    for key in ["mood", "energy", "sentiment", "location", "person"] {
        if let Some(value) = event.payload.metadata.get(key).and_then(explicit_string) {
            labels.insert(format!("{key}:{}", value.to_lowercase()));
        }
    }
    if let Some(day) = parse_day(&event.payload.day) {
        let weekday =
            ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][(day + 3).rem_euclid(7) as usize];
        labels.insert(format!("rhythm:weekday:{weekday}"));
    }
    if let Some(hour) = parse_hour(&event.payload.created_at) {
        let local_minute = (hour as i32 * 60 + event.timezone_offset).rem_euclid(1_440) as u32;
        let period = match local_minute {
            300..=659 => "morning",
            660..=959 => "midday",
            960..=1_259 => "evening",
            _ => "night",
        };
        labels.insert(format!("rhythm:time:{period}"));
    }
    labels
}

fn explicit_string(value: &Value) -> Option<&str> {
    value.as_str().filter(|text| !text.trim().is_empty())
}

fn parse_hour(timestamp: &str) -> Option<u32> {
    let time = timestamp.split_once('T')?.1;
    let hour = time.get(0..2)?.parse::<u32>().ok()?;
    (hour < 24).then_some(hour)
}

fn parse_day(day: &str) -> Option<i64> {
    let mut parts = day.split('-');
    let year = parts.next()?.parse::<i64>().ok()?;
    let month = parts.next()?.parse::<i64>().ok()?;
    let date = parts.next()?.parse::<i64>().ok()?;
    if parts.next().is_some() || !(1..=12).contains(&month) || !(1..=31).contains(&date) {
        return None;
    }
    let adjusted_year = year - i64::from(month <= 2);
    let era = adjusted_year.div_euclid(400);
    let year_of_era = adjusted_year - era * 400;
    let adjusted_month = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * adjusted_month + 2) / 5 + date - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let ordinal = era * 146_097 + day_of_era - 719_468;
    // Reject impossible dates such as February 31 by round-tripping the conversion.
    let (round_year, round_month, round_day) = civil_from_ordinal(ordinal);
    (round_year == year && round_month == month && round_day == date).then_some(ordinal)
}

fn civil_from_ordinal(ordinal: i64) -> (i64, i64, i64) {
    let z = ordinal + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month, day)
}

fn utc_today_ordinal() -> i64 {
    let days = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
        / 86_400;
    days
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::journal_log::{JournalEntryInput, JournalState};
    use serde_json::json;
    use std::path::Path;

    fn synthetic_entries(
        count: usize,
        supporting_count: usize,
    ) -> (tempfile::TempDir, JournalState) {
        let directory = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(Path::new(directory.path())).unwrap();
        for index in 0..count {
            let support = index < supporting_count;
            let tags = if support {
                vec!["workshop".to_string(), "energy:low".to_string()]
            } else {
                vec!["workshop".to_string(), "energy:steady".to_string()]
            };
            let mut metadata = BTreeMap::new();
            metadata.insert(
                "mood".to_string(),
                json!(if support { "tired" } else { "calm" }),
            );
            journal
                .append_entry(JournalEntryInput {
                    id: format!("entry-{index}"),
                    day: "2026-10-14".into(),
                    created_at: format!("2026-10-14T{:02}:00:00Z", index % 24),
                    updated_at: "2026-10-14T23:00:00Z".into(),
                    text: format!("Entry {index}: workshop record."),
                    tags,
                    metadata,
                    timezone_offset: 0,
                    level: None,
                    period: None,
                })
                .unwrap();
        }
        (directory, journal)
    }

    #[test]
    fn sparse_sample_has_no_statistical_patterns_or_percentages() {
        let (_dir, journal) = synthetic_entries(5, 3);
        let events = journal.verified_events().unwrap();
        let result = analyze_events(&events, HorizonType::Day, parse_day("2026-10-14").unwrap());
        assert_eq!(result.entries_recorded, 5);
        assert!(result.still_gathering);
        assert!(result.patterns.is_empty());
    }

    #[test]
    fn twelve_entries_report_exact_count_while_data_is_forming() {
        let (_dir, journal) = synthetic_entries(12, 3);
        let events = journal.verified_events().unwrap();
        let result = analyze_events(&events, HorizonType::Day, parse_day("2026-10-14").unwrap());
        let pattern = result
            .patterns
            .iter()
            .find(|p| p.entity == "tag:workshop" && p.outcome == "energy:low")
            .unwrap();
        assert!(
            pattern.statement.contains("3 of 12"),
            "{}",
            pattern.statement
        );
        assert!(pattern.statement.contains("still forming"));
        assert!(!pattern.statement.contains('%'));
        assert!(!pattern.statement.to_lowercase().contains("cause"));
        assert_eq!(pattern.supporting_event_ids.len(), 3);
        assert_eq!(pattern.counterexample_event_ids.len(), 9);
    }

    #[test]
    fn established_association_includes_counterexamples_and_source_ids() {
        let (_dir, journal) = synthetic_entries(25, 7);
        let events = journal.verified_events().unwrap();
        let result = analyze_events(&events, HorizonType::Day, parse_day("2026-10-14").unwrap());
        let pattern = result
            .patterns
            .iter()
            .find(|p| p.entity == "tag:workshop" && p.outcome == "energy:low")
            .unwrap();
        assert!(pattern.statement.contains("association"));
        assert!(pattern.statement.contains("7 of 25"));
        assert!(pattern
            .statement
            .contains("18 such entries did not include it"));
        assert!(!pattern.counterexample_event_ids.is_empty());
        assert_eq!(pattern.supporting_event_ids.len(), 7);
    }

    #[test]
    fn inscription_daypart_uses_the_recorded_timezone_offset() {
        let directory = tempfile::tempdir().unwrap();
        let journal = JournalState::open_test(Path::new(directory.path())).unwrap();
        journal
            .append_entry(JournalEntryInput {
                id: "local-morning".into(),
                day: "2026-10-14".into(),
                created_at: "2026-10-14T12:00:00Z".into(),
                updated_at: "2026-10-14T12:00:00Z".into(),
                text: "An inscription made in the morning.".into(),
                tags: vec!["workshop".into()],
                metadata: BTreeMap::new(),
                timezone_offset: -240,
                level: None,
                period: None,
            })
            .unwrap();
        let events = journal.verified_events().unwrap();
        assert!(event_features(&events[0]).contains("rhythm:time:morning"));
    }
}
