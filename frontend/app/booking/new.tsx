import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api, getCachedUser } from "@/src/api";
import { TIME_SLOTS, colors, radius, shadow, spacing } from "@/src/theme";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function NewBooking() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();

  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | undefined>(categoryId);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [areaStatus, setAreaStatus] = useState<"idle" | "checking" | "ok" | "unavailable" | "invalid">(
    "idle",
  );
  const [areaName, setAreaName] = useState<string>("");
  const [landmark, setLandmark] = useState("");
  const [problem, setProblem] = useState("");
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [slot, setSlot] = useState<string>(TIME_SLOTS[0]);
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const u = await getCachedUser();
      if (u) {
        setName(u.name || "");
        setMobile(u.mobile || "");
      }
      const cats = await api.listCategories(true);
      setCategories(cats);
      if (!categoryId && cats.length) setSelectedCat(cats[0].id);
    })();
  }, [categoryId]);

  const detect = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Location permission denied. Enable it in Settings.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      if (place) {
        const line = [place.name, place.street, place.city, place.region]
          .filter(Boolean)
          .join(", ");
        if (!address) setAddress(line);
      }
    } catch (e: any) {
      setError(e.message || "Could not get location");
    } finally {
      setLocating(false);
    }
  };

  const checkArea = async (p: string) => {
    if (p.length !== 6) {
      setAreaStatus(p.length === 0 ? "idle" : "invalid");
      setAreaName("");
      return;
    }
    setAreaStatus("checking");
    try {
      const res = await api.checkServiceArea(p);
      if (res.serviced) {
        setAreaStatus("ok");
        setAreaName(res.area?.name ? `${res.area.name}, ${res.area.city}` : "");
      } else {
        setAreaStatus("unavailable");
        setAreaName("");
      }
    } catch {
      setAreaStatus("invalid");
      setAreaName("");
    }
  };

  const submit = async () => {
    setError("");
    if (!selectedCat) return setError("Pick a category");
    if (!name.trim()) return setError("Enter your name");
    if (!/^[+\d]{8,}$/.test(mobile.trim())) return setError("Enter a valid mobile number");
    if (!address.trim()) return setError("Enter your address");
    if (!/^\d{6}$/.test(pincode.trim())) return setError("Enter a valid 6-digit pincode");
    if (areaStatus === "unavailable")
      return setError("Sorry, services are currently unavailable in your area.");
    if (!problem.trim()) return setError("Describe the issue");

    setLoading(true);
    try {
      const b = await api.createBooking({
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        landmark: landmark.trim(),
        category_id: selectedCat,
        problem: problem.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        schedule_type: scheduleType,
        time_slot: scheduleType === "later" ? slot : undefined,
        scheduled_date: scheduleType === "later" ? date : undefined,
      });
      router.replace({ pathname: "/booking/[id]", params: { id: b.id } });
    } catch (e: any) {
      setError(e.message || "Could not create booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Book a Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.lg }}
        bottomOffset={90}
      >
        {/* Category */}
        <View>
          <Text style={styles.label}>Service Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}
          >
            {categories.map((c) => {
              const active = c.id === selectedCat;
              return (
                <TouchableOpacity
                  key={c.id}
                  testID={`cat-chip-${c.name.toLowerCase().replace(/\s/g, "-")}`}
                  onPress={() => setSelectedCat(c.id)}
                  style={[styles.chip, active && styles.chipActive, { flexShrink: 0 }]}
                >
                  <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Name */}
        <View>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            testID="booking-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>

        {/* Mobile */}
        <View>
          <Text style={styles.label}>Mobile Number</Text>
          <TextInput
            testID="booking-mobile-input"
            value={mobile}
            onChangeText={setMobile}
            placeholder="+91 98xxxxxx10"
            placeholderTextColor={colors.textFaint}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>

        {/* Address */}
        <View>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Address</Text>
            <TouchableOpacity
              testID="use-current-location-button"
              onPress={detect}
              style={styles.locBtn}
            >
              <Ionicons name="locate" color={colors.brand} size={14} />
              <Text style={styles.locBtnTxt}>
                {locating ? "Detecting…" : coords.lat ? "Location set" : "Use current"}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            testID="booking-address-input"
            value={address}
            onChangeText={setAddress}
            placeholder="House no, street, area, city"
            placeholderTextColor={colors.textFaint}
            multiline
            style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
          />
        </View>

        {/* Landmark */}
        <View>
          <Text style={styles.label}>Landmark (optional)</Text>
          <TextInput
            testID="booking-landmark-input"
            value={landmark}
            onChangeText={setLandmark}
            placeholder="Nearby shop, gate, building"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>

        {/* Pincode + service-area preflight */}
        <View>
          <Text style={styles.label}>Pincode</Text>
          <TextInput
            testID="booking-pincode-input"
            value={pincode}
            onChangeText={(t) => {
              const next = t.replace(/\D/g, "").slice(0, 6);
              setPincode(next);
              checkArea(next);
            }}
            placeholder="6-digit pincode"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.input}
          />
          {areaStatus === "ok" ? (
            <Text testID="area-status-ok" style={[styles.help, { color: colors.success }]}>
              We service this area{areaName ? ` — ${areaName}` : ""}.
            </Text>
          ) : null}
          {areaStatus === "unavailable" ? (
            <View testID="area-status-unavailable" style={{ marginTop: 6 }}>
              <Toast type="error" message="Sorry, services are currently unavailable in your area." />
            </View>
          ) : null}
          {areaStatus === "checking" ? (
            <Text style={styles.help}>Checking availability…</Text>
          ) : null}
        </View>

        {/* Problem */}
        <View>
          <Text style={styles.label}>Describe the issue</Text>
          <TextInput
            testID="booking-problem-input"
            value={problem}
            onChangeText={setProblem}
            placeholder="What needs to be done?"
            placeholderTextColor={colors.textFaint}
            multiline
            style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
          />
        </View>

        {/* Schedule */}
        <View>
          <Text style={styles.label}>When?</Text>
          <View style={styles.toggleRow}>
            {(["now", "later"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                testID={`schedule-${s}`}
                onPress={() => setScheduleType(s)}
                style={[styles.toggle, scheduleType === s && styles.toggleActive]}
              >
                <Ionicons
                  name={s === "now" ? "flash" : "time"}
                  size={16}
                  color={scheduleType === s ? "#fff" : colors.brand}
                />
                <Text style={[styles.toggleTxt, scheduleType === s && styles.toggleTxtActive]}>
                  {s === "now" ? "Need Service Now" : "Schedule For Later"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {scheduleType === "later" ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Text style={styles.subLabel}>Date</Text>
              <TextInput
                testID="booking-date-input"
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
              />
              <Text style={styles.subLabel}>Time Slot</Text>
              <View style={styles.slotsRow}>
                {TIME_SLOTS.map((s) => {
                  const active = slot === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      testID={`slot-${s}`}
                      onPress={() => setSlot(s)}
                      style={[styles.slotChip, active && styles.slotChipActive]}
                    >
                      <Text style={[styles.slotTxt, active && styles.slotTxtActive]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>

        {error ? <Toast type="error" message={error} /> : null}
      </KeyboardAwareScrollView>

      <View style={[styles.cta, shadow.pop]}>
        <Button
          testID="confirm-booking-button"
          label="Confirm Booking"
          icon="checkmark-circle"
          onPress={submit}
          loading={loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },

  label: { fontSize: 12, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.6, marginBottom: 8 },
  help: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  subLabel: { fontSize: 11, fontWeight: "700", color: colors.textMuted, marginBottom: 4 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  locBtn: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: colors.brandLight, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, marginBottom: 8,
  },
  locBtnTxt: { color: colors.brand, fontWeight: "700", fontSize: 11 },

  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    fontWeight: "500",
  },

  chip: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontSize: 13, fontWeight: "700", color: colors.text },
  chipTxtActive: { color: "#fff" },

  toggleRow: { flexDirection: "row", gap: spacing.sm },
  toggle: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.brandLight,
    backgroundColor: colors.surface,
  },
  toggleActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  toggleTxt: { fontSize: 12, color: colors.brand, fontWeight: "700" },
  toggleTxtActive: { color: "#fff" },

  slotsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slotChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  slotChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  slotTxt: { fontSize: 12, fontWeight: "700", color: colors.text },
  slotTxtActive: { color: "#fff" },

  cta: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
});
