import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import type { ProjectRow } from "@monitoring/shared-types";

import { submitDailyLog } from "../api/client";
import { validateDateYMD } from "./validation";
import { fetchSiteWeather, type SiteWeatherData } from "./weather";
import { colors, radius, spacing, typography } from "../theme/theme";
import { Button, Field, Muted } from "../ui/components";

// Dropdown vocabularies — structured capture over free text (design principle).
const WEATHER = ["Sunny", "Cloudy", "Overcast", "Light rain", "Heavy rain", "Windy", "Hot", "Dusty"];
const MATERIAL_TYPES = ["Cement", "Sand", "Ballast", "Steel / Rebar", "Timber", "Blocks", "Aggregate", "Other"];
const PLANT_TYPES = ["Excavator", "Mixer", "Crane", "Generator", "Vibrator", "Truck", "Pump", "Other"];
const INFO_SOURCES = ["Architect", "Engineer", "QS", "Client", "Contractor", "Consultant", "Other"];
const INFO_NATURE = ["Drawing", "Instruction", "Clarification"];
const ADEQUACY = ["Adequate", "Inadequate"];
const QUICK_NOTES = [
  "Basement excavation ongoing",
  "Rebar fixing in progress",
  "Formwork erection ongoing",
  "Concrete pour completed",
  "Site inspection conducted",
  "Work delayed by heavy rain",
  "Awaiting engineer inspection",
];

/** Single-choice chip row (a touch-friendly dropdown). */
function ChipSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[typography.muted, { marginBottom: spacing.xs }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable key={o} onPress={() => onChange(on ? "" : o)} accessibilityRole="radio"
              accessibilityState={{ checked: on }} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Yes/No toggle. */
function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.ynRow}>
      <Text style={[typography.body, { flex: 1 }]}>{label}</Text>
      {[["No", false], ["Yes", true]].map(([t, v]) => {
        const on = value === v;
        return (
          <Pressable key={t as string} onPress={() => onChange(v as boolean)} accessibilityRole="radio"
            accessibilityState={{ checked: on }} style={[styles.yn, on && styles.ynOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{t as string}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SubHead({ children }: { children: string }) {
  return <Text style={[typography.heading, { marginTop: spacing.md, marginBottom: spacing.xs }]}>{children}</Text>;
}

/**
 * URS Mobile App, Module 1 — Daily Log (General Site Condition). Captures
 * factual site conditions independent of contractor progress: weather,
 * materials, labour, plant & equipment, visitors and information received.
 * Dropdown-driven; submitted online; GPS/timestamp added server-side.
 */
export function SiteConditionForm({ project, onDone }: { project: ProjectRow; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(today);

  // 1.1 Weather
  const [wxAm, setWxAm] = useState("");
  const [wxPm, setWxPm] = useState("");
  const [rain, setRain] = useState(false);
  const [hoursLost, setHoursLost] = useState("");
  const [wxLoading, setWxLoading] = useState(false);
  const [wxData, setWxData] = useState<SiteWeatherData | null>(null);

  async function handleAutoWeather() {
    const lat = project.site_latitude ?? -1.332;
    const lon = project.site_longitude ?? 36.758;
    setWxLoading(true);
    try {
      const data = await fetchSiteWeather(lat, lon);
      setWxData(data);
      const currentHour = new Date().getHours();
      if (currentHour < 12) {
        setWxAm(data.condition);
        if (!wxPm) setWxPm(data.condition);
      } else {
        setWxPm(data.condition);
        if (!wxAm) setWxAm(data.condition);
      }
      if (data.hasRain) {
        setRain(true);
      }
    } catch (err) {
      Alert.alert("Weather Service", "Could not fetch automated weather. Please select conditions manually.");
    } finally {
      setWxLoading(false);
    }
  }
  // 1.2 Materials
  const [matDelivered, setMatDelivered] = useState(false);
  const [matType, setMatType] = useState("");
  const [matQty, setMatQty] = useState("");
  const [conform, setConform] = useState(true);
  const [damaged, setDamaged] = useState(false);
  // 1.3 Labour
  const [labour, setLabour] = useState("");
  const [adequacy, setAdequacy] = useState("");
  // 1.4 Plant & Equipment
  const [plantPresent, setPlantPresent] = useState(false);
  const [plantType, setPlantType] = useState("");
  const [plantOperational, setPlantOperational] = useState(false);
  const [plantIdle, setPlantIdle] = useState(false);
  // 1.5 Visitors
  const [vName, setVName] = useState("");
  const [vCompany, setVCompany] = useState("");
  const [vPurpose, setVPurpose] = useState("");
  // 1.6 Information received
  const [infoReceived, setInfoReceived] = useState(false);
  const [infoSource, setInfoSource] = useState("");
  const [infoNature, setInfoNature] = useState("");
  const [infoRef, setInfoRef] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    const d = validateDateYMD(date);
    if (!d.ok) return Alert.alert("Check the date", d.reason);
    if (damaged && matDelivered) {
      Alert.alert("Damaged materials", "Capture a photo of the damaged materials on the Delivery tab as proof.");
    }
    const details = {
      weather: {
        morning: wxAm,
        afternoon: wxPm,
        rainfall: rain,
        hours_lost: rain ? Number(hoursLost) || 0 : 0,
        temp_c: wxData?.tempC ?? null,
        precipitation_mm: wxData?.precipitationMm ?? null,
        wind_speed_kmh: wxData?.windSpeedKmH ?? null,
      },
      materials: matDelivered
        ? { delivered: true, type: matType, quantity: Number(matQty) || 0, conformance: conform, damaged }
        : { delivered: false },
      labour: { count: Number(labour) || 0, adequacy },
      plant: plantPresent
        ? { present: true, type: plantType, operational: plantOperational, idle: plantIdle }
        : { present: false },
      visitors: vName.trim() ? [{ name: vName.trim(), company: vCompany.trim(), purpose: vPurpose.trim() }] : [],
      information: infoReceived
        ? { received: true, source: infoSource, nature: infoNature, reference: infoRef.trim() }
        : { received: false },
    };
    setBusy(true);
    submitDailyLog({ project_id: project.id, log_date: date, labour_count: Number(labour) || 0, notes, details })
      .then(() => {
        Alert.alert("Recorded", "Daily site condition saved.");
        onDone();
      })
      .catch((e) => Alert.alert("Error", (e as Error).message))
      .finally(() => setBusy(false));
  }

  return (
    <View>
      <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, marginBottom: spacing.xs }}>
        <Text style={typography.heading}>Weather</Text>
        <Pressable
          onPress={handleAutoWeather}
          disabled={wxLoading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 4,
            paddingHorizontal: 8,
            backgroundColor: colors.card,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          accessibilityRole="button"
          accessibilityLabel="Auto-detect on-site weather"
        >
          <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>
            {wxLoading ? "Fetching..." : "🌤️ Auto-fill Weather"}
          </Text>
        </Pressable>
      </View>
      {wxData && (
        <View style={{ backgroundColor: colors.card, padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border }}>
          <Text style={[typography.muted, { fontSize: 13 }]}>📍 Site station: {wxData.summary}</Text>
        </View>
      )}
      <ChipSelect label="Morning" options={WEATHER} value={wxAm} onChange={setWxAm} />
      <ChipSelect label="Afternoon" options={WEATHER} value={wxPm} onChange={setWxPm} />
      <YesNo label="Rainfall occurred?" value={rain} onChange={setRain} />
      {rain && <Field label="Hours lost" value={hoursLost} onChangeText={setHoursLost} keyboardType="decimal-pad" />}

      <SubHead>Materials delivered</SubHead>
      <YesNo label="Delivered today?" value={matDelivered} onChange={setMatDelivered} />
      {matDelivered && (
        <>
          <ChipSelect label="Material type" options={MATERIAL_TYPES} value={matType} onChange={setMatType} />
          <Field label="Quantity" value={matQty} onChangeText={setMatQty} keyboardType="decimal-pad" />
          <YesNo label="Conformance (to spec)?" value={conform} onChange={setConform} />
          <YesNo label="Damaged materials?" value={damaged} onChange={setDamaged} />
          {damaged && <Muted>Capture a photo on the Delivery tab as proof.</Muted>}
        </>
      )}

      <SubHead>Labour deployment</SubHead>
      <Field label="Labour on site" value={labour} onChangeText={setLabour} keyboardType="number-pad" />
      <ChipSelect label="Adequacy" options={ADEQUACY} value={adequacy} onChange={setAdequacy} />

      <SubHead>Plant &amp; equipment</SubHead>
      <YesNo label="Equipment present?" value={plantPresent} onChange={setPlantPresent} />
      {plantPresent && (
        <>
          <ChipSelect label="Type" options={PLANT_TYPES} value={plantType} onChange={setPlantType} />
          <YesNo label="Operational?" value={plantOperational} onChange={setPlantOperational} />
          <YesNo label="Idle?" value={plantIdle} onChange={setPlantIdle} />
        </>
      )}

      <SubHead>Visitors</SubHead>
      <Field label="Name" value={vName} onChangeText={setVName} placeholder="optional" />
      {vName.trim() ? (
        <>
          <Field label="Company" value={vCompany} onChangeText={setVCompany} placeholder="optional" />
          <Field label="Purpose" value={vPurpose} onChangeText={setVPurpose} placeholder="optional" />
        </>
      ) : null}

      <SubHead>Information received</SubHead>
      <YesNo label="Information received?" value={infoReceived} onChange={setInfoReceived} />
      {infoReceived && (
        <>
          <ChipSelect label="Source" options={INFO_SOURCES} value={infoSource} onChange={setInfoSource} />
          <ChipSelect label="Nature" options={INFO_NATURE} value={infoNature} onChange={setInfoNature} />
          <Field label="Reference number" value={infoRef} onChangeText={setInfoRef} placeholder="optional" />
        </>
      )}

      <SubHead>Notes & Observations</SubHead>
      <View style={{ marginBottom: spacing.xs }}>
        <Text style={[typography.muted, { fontSize: 12, marginBottom: 4 }]}>Quick field presets (tap to add):</Text>
        <View style={styles.chips}>
          {QUICK_NOTES.map((qn) => (
            <Pressable
              key={qn}
              onPress={() => setNotes((prev) => (prev.trim() ? `${prev.trim()} · ${qn}` : qn))}
              style={[styles.chip, { paddingVertical: 4, paddingHorizontal: 10 }]}
              accessibilityRole="button"
              accessibilityLabel={`Add note ${qn}`}
            >
              <Text style={{ fontSize: 11, color: colors.textMuted }}>+ {qn}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Field label="General notes" value={notes} onChangeText={setNotes} multiline placeholder="Enter or dictate notes..." />

      <Button title="Submit daily report" loading={busy} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: colors.primaryText },
  ynRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  yn: {
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 6, minWidth: 52, alignItems: "center",
  },
  ynOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
