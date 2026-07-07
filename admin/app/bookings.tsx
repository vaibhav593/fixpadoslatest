import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AdminShell, adminStyles } from "@/src/components/AdminShell";
import { Button } from "@/src/components/Button";
import { StatusPill } from "@/src/components/StatusPill";
import { Toast } from "@/src/components/Toast";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

const STATUS_OPTS = [
  { key: "all", label: "All" },
  { key: "created", label: "Unassigned" },
  { key: "worker_assigned", label: "Assigned" },
  { key: "worker_accepted", label: "Accepted" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const SCHED_OPTS = [
  { key: "all", label: "All" },
  { key: "now", label: "Immediate" },
  { key: "later", label: "Scheduled" },
];

export default function AdminBookings() {
  const [status, setStatus] = useState("all");
  const [sched, setSched] = useState("all");
  const [items, setItems] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [chat, setChat] = useState<any[] | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api.adminBookings(status === "all" ? undefined : status, sched === "all" ? undefined : sched));
    } catch {}
  }, [status, sched]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    api.listWorkers().then(setWorkers).catch(() => {});
  }, []);

  const assign = async (workerId: string) => {
    if (!active) return;
    try {
      await api.adminAssignWorker(active.id, workerId);
      setActive(null);
      load();
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  };

  const viewChat = async (bid: string) => {
    try { setChat(await api.adminChat(bid)); } catch {}
  };

  return (
    <AdminShell title="Bookings">
      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Status:</Text>
        {STATUS_OPTS.map((f) => (
          <TouchableOpacity key={f.key} testID={`bk-status-${f.key}`} onPress={() => setStatus(f.key)} style={[styles.chip, status === f.key && styles.chipActive]}>
            <Text style={[styles.chipTxt, status === f.key && { color: "#fff" }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.filters}>
        <Text style={styles.filterLabel}>When:</Text>
        {SCHED_OPTS.map((f) => (
          <TouchableOpacity key={f.key} testID={`bk-sched-${f.key}`} onPress={() => setSched(f.key)} style={[styles.chip, sched === f.key && styles.chipActive]}>
            <Text style={[styles.chipTxt, sched === f.key && { color: "#fff" }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {err ? <Toast type="error" message={err} /> : null}

      {items.map((b) => (
        <View key={b.id} testID={`adminbk-${b.id}`} style={adminStyles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.cat}>{b.category_name}</Text>
            <StatusPill status={b.status} />
          </View>
          <Text style={styles.muted}>{b.name} · {b.mobile}</Text>
          <Text style={styles.muted} numberOfLines={2}>{b.address}</Text>
          <Text style={styles.muted}>
            {b.schedule_type === "now" ? "Need Now" : `${b.scheduled_date} · ${b.time_slot}`}
          </Text>
          {b.cancellation_reason ? (
            <Text style={{ color: colors.danger, fontSize: 12 }}>Cancelled ({b.cancelled_by}): {b.cancellation_reason}</Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            <TouchableOpacity testID={`assign-${b.id}`} onPress={() => setActive(b)} style={styles.actionBtn}>
              <Ionicons name="person-add" color={colors.brand} size={14} />
              <Text style={styles.actionTxt}>{b.worker_id ? "Reassign" : "Assign"} Worker</Text>
            </TouchableOpacity>
            <TouchableOpacity testID={`viewchat-${b.id}`} onPress={() => viewChat(b.id)} style={styles.actionBtn}>
              <Ionicons name="chatbubbles" color={colors.brand} size={14} />
              <Text style={styles.actionTxt}>View Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Assign modal */}
      <Modal visible={!!active} transparent animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
              <Text style={adminStyles.sectionTitle}>Select a Worker</Text>
              {workers.length === 0 ? <Text style={styles.muted}>No workers found.</Text> : null}
              {workers.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  testID={`assign-pick-${w.id}`}
                  onPress={() => assign(w.id)}
                  style={styles.workerRow}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                      <Text style={styles.workerName}>{w.name}</Text>
                      {w.kyc_status === "approved" ? <Ionicons name="shield-checkmark" color={colors.success} size={12} /> : null}
                    </View>
                    <Text style={styles.muted}>★ {(w.rating ?? 0).toFixed(1)} · {w.completed_jobs ?? 0} jobs · {w.available ? "Available" : "Offline"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" color={colors.textFaint} size={16} />
                </TouchableOpacity>
              ))}
              <View style={{ marginTop: spacing.lg }}>
                <Button label="Close" variant="ghost" onPress={() => setActive(null)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Chat viewer */}
      <Modal visible={!!chat} transparent animationType="slide" onRequestClose={() => setChat(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
              <Text style={adminStyles.sectionTitle}>Chat Transcript</Text>
              {chat && chat.length === 0 ? <Text style={styles.muted}>No messages.</Text> : null}
              {chat?.map((m, i) => (
                <View key={i} style={styles.msg}>
                  <Text style={styles.msgRole}>{m.sender_role}</Text>
                  <Text style={styles.msgTxt}>{m.text}</Text>
                </View>
              ))}
              <View style={{ marginTop: spacing.lg }}>
                <Button label="Close" variant="ghost" onPress={() => setChat(null)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  filterLabel: { color: colors.textMuted, fontWeight: "700", fontSize: 12, marginRight: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontWeight: "700", color: colors.text, fontSize: 11 },

  cat: { fontWeight: "800", color: colors.text, fontSize: 15 },
  muted: { color: colors.textMuted, fontSize: 12 },
  actionBtn: { flexDirection: "row", gap: 4, alignItems: "center", backgroundColor: colors.brandLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  actionTxt: { color: colors.brand, fontWeight: "700", fontSize: 12 },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%" },
  workerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  workerName: { fontWeight: "700", color: colors.text, fontSize: 14 },
  msg: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md },
  msgRole: { fontSize: 10, fontWeight: "800", color: colors.brand, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  msgTxt: { color: colors.text, fontSize: 13 },
});
