import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { AdminShell, adminStyles } from "@/src/components/AdminShell";
import { Button } from "@/src/components/Button";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending_verification", label: "Pending Verification" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function AdminWorkers() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.adminWorkers(filter === "all" ? undefined : filter, search.trim() || undefined);
      setItems(data);
    } catch {}
  }, [filter, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const approve = async (id: string) => {
    await api.approveWorker(id).catch(() => {});
    setActive(null);
    load();
  };

  const reject = async () => {
    if (!active || !rejectReason.trim()) return;
    await api.rejectWorker(active.id, rejectReason).catch(() => {});
    setShowReject(false);
    setRejectReason("");
    setActive(null);
    load();
  };

  return (
    <AdminShell title="Worker Verification">
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          testID="worker-search-input"
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or mobile"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity testID="worker-search-clear" onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            testID={`worker-filter-${f.key}`}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipTxt, filter === f.key && { color: "#fff" }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>No workers in this state.</Text>
      ) : (
        items.map((w) => (
          <TouchableOpacity
            key={w.id}
            testID={`worker-row-${w.id}`}
            onPress={() => setActive(w)}
            activeOpacity={0.9}
            style={[adminStyles.card, styles.row]}
          >
            <Image source={{ uri: w.photo || "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=200" }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Text style={styles.name}>{w.name}</Text>
                {w.kyc_status === "approved" ? <Ionicons name="shield-checkmark" color={colors.success} size={14} /> : null}
              </View>
              <Text style={styles.muted}>{w.mobile}</Text>
              <View style={[styles.badge, { backgroundColor: badgeColor(w.kyc_status, true), marginTop: 4 }]}>
                <Text style={[styles.badgeTxt, { color: badgeColor(w.kyc_status) }]}>{labelOf(w.kyc_status)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" color={colors.textFaint} size={18} />
          </TouchableOpacity>
        ))
      )}

      {/* Detail modal */}
      <Modal visible={!!active} transparent animationType="slide" onRequestClose={() => setActive(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Image source={{ uri: active?.photo || "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=200" }} style={styles.bigAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigName}>{active?.name}</Text>
                  <Text style={styles.muted}>{active?.mobile}</Text>
                  <Text style={styles.muted}>★ {(active?.rating ?? 0).toFixed(1)} · {active?.completed_jobs ?? 0} jobs</Text>
                </View>
              </View>

              {/* Basic + Address details */}
              <View style={adminStyles.card}>
                <Text style={adminStyles.sectionTitle}>Applicant Details</Text>
                <DetailRow label="Email" value={active?.email || "—"} testID="worker-detail-email" />
                <DetailRow label="Full Address" value={active?.full_address || "—"} testID="worker-detail-address" />
                <DetailRow label="City" value={active?.city || "—"} testID="worker-detail-city" />
                <DetailRow label="State" value={active?.state || "—"} testID="worker-detail-state" />
                <DetailRow label="Pincode" value={active?.pincode || "—"} testID="worker-detail-pincode" />
                <DetailRow label="Experience" value={active?.experience || "—"} testID="worker-detail-experience" />
              </View>

              {active?.live_selfie ? (
                <View>
                  <Text style={adminStyles.sectionTitle}>Live Selfie</Text>
                  <Image testID="worker-detail-live-selfie" source={{ uri: active.live_selfie }} style={styles.doc} />
                </View>
              ) : null}

              <View>
                <Text style={adminStyles.sectionTitle}>Aadhaar Front</Text>
                {active?.kyc_docs?.aadhaar_front ? (
                  <Image source={{ uri: active.kyc_docs.aadhaar_front }} style={styles.doc} />
                ) : <Text style={styles.muted}>Not uploaded</Text>}
              </View>

              <View>
                <Text style={adminStyles.sectionTitle}>Aadhaar Back</Text>
                {active?.kyc_docs?.aadhaar_back ? (
                  <Image source={{ uri: active.kyc_docs.aadhaar_back }} style={styles.doc} />
                ) : <Text style={styles.muted}>Not uploaded</Text>}
              </View>

              {active?.kyc_docs?.skill_certificate ? (
                <View>
                  <Text style={adminStyles.sectionTitle}>Skill Certificate</Text>
                  <Image source={{ uri: active.kyc_docs.skill_certificate }} style={styles.doc} />
                </View>
              ) : null}

              {active?.rejection_reason ? (
                <Text style={{ color: colors.danger, fontWeight: "600" }}>
                  Previous rejection: {active.rejection_reason}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
                <View style={{ flex: 1 }}>
                  <Button label="Close" variant="ghost" onPress={() => setActive(null)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID="worker-reject-button" label="Reject" variant="danger" icon="close-circle" onPress={() => setShowReject(true)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button testID="worker-approve-button" label="Approve" icon="checkmark-circle" onPress={() => approve(active.id)} />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reject reason modal */}
      <Modal visible={showReject} transparent animationType="slide" onRequestClose={() => setShowReject(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, { padding: spacing.lg }]}>
            <Text style={adminStyles.sectionTitle}>Reason for rejection</Text>
            <TextInput
              testID="reject-reason-input"
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Please explain"
              placeholderTextColor={colors.textFaint}
              multiline
              style={[adminStyles.input, { minHeight: 80, textAlignVertical: "top", marginTop: spacing.sm }]}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button label="Close" variant="ghost" onPress={() => setShowReject(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="confirm-reject-worker-button" label="Submit" variant="danger" onPress={reject} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

function labelOf(s?: string) {
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending Verification";
}

function DetailRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text testID={testID} style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function badgeColor(s?: string, bg = false) {
  if (s === "approved") return bg ? colors.successBg : colors.success;
  if (s === "rejected") return bg ? colors.dangerBg : colors.danger;
  return bg ? colors.warningBg : colors.warning;
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontWeight: "700", color: colors.text, fontSize: 12 },

  empty: { color: colors.textMuted, fontStyle: "italic" },

  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  name: { fontWeight: "800", color: colors.text, fontSize: 14 },
  muted: { color: colors.textMuted, fontSize: 12 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeTxt: { fontSize: 11, fontWeight: "700" },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%" },
  bigAvatar: { width: 72, height: 72, borderRadius: 36 },
  bigName: { fontSize: 18, fontWeight: "800", color: colors.text },
  doc: { width: "100%", height: 180, borderRadius: radius.md, marginTop: 6, backgroundColor: colors.bg, resizeMode: "cover" },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 4,
  },
  detailLabel: { color: colors.textMuted, fontWeight: "700", fontSize: 12, flexShrink: 0 },
  detailValue: { color: colors.text, fontWeight: "600", fontSize: 13, flex: 1, textAlign: "right" },
});
