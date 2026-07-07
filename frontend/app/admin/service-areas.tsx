import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AdminShell, adminStyles } from "@/src/components/AdminShell";
import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api } from "@/src/api";
import { colors, radius, shadow, spacing } from "@/src/theme";

type Area = {
  id: string;
  name: string;
  pincode: string;
  city: string;
  radius_km: number | null;
  enabled: boolean;
};

const EMPTY: Omit<Area, "id"> = {
  name: "",
  pincode: "",
  city: "",
  radius_km: null,
  enabled: true,
};

export default function ServiceAreasScreen() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [stats, setStats] = useState<
    Record<string, { customers: number; bookings: number; workers: number } | undefined>
  >({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [form, setForm] = useState<Omit<Area, "id">>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await api.adminServiceAreas();
      setAreas(list as Area[]);
      const nextStats: typeof stats = {};
      await Promise.all(
        (list as Area[]).map(async (a) => {
          try {
            nextStats[a.id] = await api.adminServiceAreaStats(a.id);
          } catch {
            nextStats[a.id] = undefined;
          }
        }),
      );
      setStats(nextStats);
    } catch (e: any) {
      setErr(e.message || "Failed to load service areas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  };

  const openEdit = (a: Area) => {
    setEditing(a);
    setForm({
      name: a.name,
      pincode: a.pincode,
      city: a.city,
      radius_km: a.radius_km,
      enabled: a.enabled,
    });
    setModalOpen(true);
  };

  const submitForm = async () => {
    setErr("");
    if (!form.name.trim()) return setErr("Enter an area name");
    if (!/^\d{6}$/.test(form.pincode.trim())) return setErr("Pincode must be 6 digits");
    if (!form.city.trim()) return setErr("Enter the city");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        pincode: form.pincode.trim(),
        city: form.city.trim(),
        radius_km:
          form.radius_km === null || Number.isNaN(form.radius_km) ? null : Number(form.radius_km),
        enabled: form.enabled,
      };
      if (editing) {
        await api.adminUpdateServiceArea(editing.id, payload);
      } else {
        await api.adminCreateServiceArea(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setErr(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (a: Area) => {
    try {
      await api.adminUpdateServiceArea(a.id, { enabled: !a.enabled });
      setAreas((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled: !a.enabled } : x)));
    } catch (e: any) {
      setErr(e.message || "Toggle failed");
    }
  };

  const remove = async (a: Area) => {
    try {
      await api.adminDeleteServiceArea(a.id);
      setAreas((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e: any) {
      setErr(e.message || "Delete failed");
    }
  };

  return (
    <AdminShell title="Service Areas">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.subtitle}>Only areas listed here accept new bookings.</Text>
        <TouchableOpacity testID="add-service-area-btn" onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add-circle" color="#fff" size={16} />
          <Text style={styles.addBtnTxt}>Add Area</Text>
        </TouchableOpacity>
      </View>

      {err ? <Toast type="error" message={err} /> : null}

      {loading ? (
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : areas.length === 0 ? (
        <View style={[adminStyles.card, { alignItems: "center" }]}>
          <Ionicons name="map-outline" size={40} color={colors.textFaint} />
          <Text style={{ color: colors.textMuted, fontWeight: "600", marginTop: 6 }}>
            No service areas yet. Tap “Add Area” to create one.
          </Text>
        </View>
      ) : (
        areas.map((a) => {
          const s = stats[a.id];
          return (
            <View
              key={a.id}
              testID={`service-area-row-${a.pincode}`}
              style={[adminStyles.card, shadow.card, !a.enabled && styles.disabled]}
            >
              <View style={styles.rowHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{a.name}</Text>
                  <Text style={styles.meta}>
                    {a.city} · {a.pincode}
                    {a.radius_km != null ? ` · ${a.radius_km} km` : ""}
                  </Text>
                </View>
                <Switch
                  testID={`toggle-area-${a.pincode}`}
                  value={a.enabled}
                  onValueChange={() => toggleEnabled(a)}
                  trackColor={{ true: colors.brand, false: colors.borderSoft }}
                />
              </View>

              <View style={styles.statsRow}>
                <StatCell label="Customers" value={s?.customers ?? "—"} />
                <StatCell label="Bookings" value={s?.bookings ?? "—"} />
                <StatCell label="Workers" value={s?.workers ?? "—"} />
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  testID={`edit-area-${a.pincode}`}
                  onPress={() => openEdit(a)}
                  style={[styles.actBtn, { backgroundColor: colors.brandLight }]}
                >
                  <Ionicons name="create" color={colors.brand} size={14} />
                  <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 12 }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`delete-area-${a.pincode}`}
                  onPress={() => remove(a)}
                  style={[styles.actBtn, { backgroundColor: "#FEE2E2" }]}
                >
                  <Ionicons name="trash" color={colors.danger} size={14} />
                  <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 12 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editing ? "Edit Service Area" : "New Service Area"}
            </Text>
            <ScrollView contentContainerStyle={{ gap: spacing.md }}>
              <Field
                label="Area Name"
                testID="area-name-input"
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="e.g. Bandra West"
              />
              <Field
                label="Pincode"
                testID="area-pincode-input"
                value={form.pincode}
                onChangeText={(t) => setForm((f) => ({ ...f, pincode: t.replace(/\D/g, "").slice(0, 6) }))}
                placeholder="6-digit pincode"
                keyboardType="number-pad"
                maxLength={6}
              />
              <Field
                label="City"
                testID="area-city-input"
                value={form.city}
                onChangeText={(t) => setForm((f) => ({ ...f, city: t }))}
                placeholder="e.g. Mumbai"
              />
              <Field
                label="Radius (km, optional)"
                testID="area-radius-input"
                value={form.radius_km == null ? "" : String(form.radius_km)}
                onChangeText={(t) => {
                  if (!t) return setForm((f) => ({ ...f, radius_km: null }));
                  const n = Number(t.replace(/[^\d.]/g, ""));
                  setForm((f) => ({ ...f, radius_km: Number.isFinite(n) ? n : null }));
                }}
                placeholder="e.g. 5"
                keyboardType="decimal-pad"
              />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>Enabled</Text>
                <Switch
                  testID="area-enabled-toggle"
                  value={form.enabled}
                  onValueChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                  trackColor={{ true: colors.brand, false: colors.borderSoft }}
                />
              </View>
              {err ? <Toast type="error" message={err} /> : null}
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button
                    testID="area-cancel-btn"
                    label="Cancel"
                    variant="ghost"
                    onPress={() => setModalOpen(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    testID="area-save-btn"
                    label={editing ? "Save" : "Create"}
                    icon="checkmark"
                    onPress={submitForm}
                    loading={saving}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

function Field({
  label,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  testID: string;
  keyboardType?: any;
  maxLength?: number;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textFaint}
        style={adminStyles.input}
      />
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: colors.textMuted, fontSize: 13, flex: 1, marginRight: 12 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  addBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },

  rowHead: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "800", color: colors.text },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  disabled: { opacity: 0.55 },

  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
  stat: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  statVal: { fontSize: 18, fontWeight: "800", color: colors.text },
  statLbl: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },

  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },

  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
});
