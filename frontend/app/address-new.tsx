import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function NewAddress() {
  const router = useRouter();
  const [label, setLabel] = useState("Home");
  const [line, setLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const detect = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return setErr("Permission denied");
      const loc = await Location.getCurrentPositionAsync({});
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      if (place && !line) {
        setLine([place.name, place.street, place.city].filter(Boolean).join(", "));
      }
    } catch (e: any) {
      setErr(e.message || "Location failed");
    }
  };

  const save = async () => {
    setErr("");
    if (!line.trim()) return setErr("Address is required");
    setLoading(true);
    try {
      await api.addAddress({
        label: label.trim() || "Home",
        line: line.trim(),
        landmark: landmark.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
      });
      router.back();
    } catch (e: any) {
      setErr(e.message || "Save failed");
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
        <Text style={styles.title}>Add Address</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View>
          <Text style={styles.label}>Label</Text>
          <View style={styles.chipsRow}>
            {["Home", "Work", "Other"].map((opt) => (
              <TouchableOpacity
                key={opt}
                testID={`label-${opt.toLowerCase()}`}
                onPress={() => setLabel(opt)}
                style={[styles.chip, label === opt && styles.chipActive]}
              >
                <Text style={[styles.chipTxt, label === opt && { color: "#fff" }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.label}>Address</Text>
            <TouchableOpacity testID="address-locate" onPress={detect} style={styles.locBtn}>
              <Ionicons name="locate" color={colors.brand} size={14} />
              <Text style={styles.locTxt}>{coords.lat ? "Location set" : "Use current"}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            testID="address-line-input"
            value={line}
            onChangeText={setLine}
            placeholder="House no, street, area, city"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            multiline
          />
        </View>

        <View>
          <Text style={styles.label}>Landmark</Text>
          <TextInput
            testID="address-landmark-input"
            value={landmark}
            onChangeText={setLandmark}
            placeholder="Optional"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>

        {err ? <Toast type="error" message={err} /> : null}
        <Button testID="save-address-button" label="Save Address" icon="checkmark" onPress={save} loading={loading} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },
  label: { fontWeight: "800", color: colors.textMuted, fontSize: 12, letterSpacing: 0.6, marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.text, fontSize: 14 },
  chipsRow: { flexDirection: "row", gap: spacing.sm },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontWeight: "700", color: colors.text, fontSize: 13 },
  locBtn: { flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: colors.brandLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, marginBottom: 8 },
  locTxt: { color: colors.brand, fontWeight: "700", fontSize: 11 },
});
