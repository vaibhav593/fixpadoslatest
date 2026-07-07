import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { StatusPill } from "@/src/components/StatusPill";
import { Toast } from "@/src/components/Toast";
import { api } from "@/src/api";
import { CATEGORY_ICON, colors, radius, shadow, spacing } from "@/src/theme";

export default function WorkerJobDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [b, setB] = useState<any>(null);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const refs = useRef<(TextInput | null)[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api.getBooking(id);
      setB(data);
    } catch (e: any) {
      setErr(e.message || "Load failed");
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!b) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <Text style={{ padding: spacing.lg }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const accept = async () => {
    try { await api.acceptJob(b.id); load(); } catch (e: any) { setErr(e.message); }
  };
  const start = async () => {
    try { await api.startJob(b.id); load(); } catch (e: any) { setErr(e.message); }
  };
  const submitPin = async () => {
    const code = pin.join("");
    if (code.length !== 4) return setErr("Enter the 4-digit PIN");
    try {
      await api.verifyPin(b.id, code);
      setShowPin(false);
      load();
    } catch (e: any) {
      setErr(e.message || "Invalid PIN");
    }
  };
  const openMaps = () => {
    if (b.latitude && b.longitude) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`);
    }
  };
  const call = () => b.customer?.mobile && Linking.openURL(`tel:${b.customer.mobile}`);

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Job Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
        <View style={[styles.card, shadow.card]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={styles.iconBig}>
              <Ionicons
                name={(CATEGORY_ICON[b.category_icon] || "construct") as any}
                color={colors.brand}
                size={24}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigTitle}>{b.category_name}</Text>
              <Text style={styles.muted} numberOfLines={2}>{b.problem}</Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <StatusPill status={b.status} />
          </View>
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Text style={styles.body}>{b.customer?.name || b.name}</Text>
          <Text style={styles.muted}>{b.customer?.mobile || b.mobile}</Text>
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.sectionTitle}>Address</Text>
          <Text style={styles.body}>{b.address}</Text>
          {b.landmark ? <Text style={styles.muted}>Landmark: {b.landmark}</Text> : null}
          <Text style={styles.muted}>
            {b.schedule_type === "now" ? "Need Now" : `Scheduled · ${b.scheduled_date} · ${b.time_slot}`}
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity testID="job-call-button" onPress={call} style={styles.actionBtn}>
              <Ionicons name="call" color={colors.brand} size={16} />
              <Text style={styles.actionTxt}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="job-chat-button"
              onPress={() => router.push({ pathname: "/chat/[bookingId]", params: { bookingId: b.id } })}
              style={styles.actionBtn}
            >
              <Ionicons name="chatbubbles" color={colors.brand} size={16} />
              <Text style={styles.actionTxt}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="job-maps-button" onPress={openMaps} style={styles.actionBtn}>
              <Ionicons name="navigate" color={colors.brand} size={16} />
              <Text style={styles.actionTxt}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {err ? <Toast type="error" message={err} /> : null}
      </ScrollView>

      <View style={[styles.cta, shadow.pop]}>
        {b.status === "worker_assigned" ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button testID="reject-job-button" label="Reject" variant="danger" icon="close-circle" onPress={() => setShowReject(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button testID="accept-job-button" label="Accept" icon="checkmark-done" onPress={accept} />
            </View>
          </View>
        ) : b.status === "worker_accepted" ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button testID="worker-cancel-button" label="Cancel" variant="ghost" icon="close" onPress={() => setShowCancel(true)} />
            </View>
            <View style={{ flex: 2 }}>
              <Button testID="start-job-button" label="Start Service" icon="play-circle" onPress={start} />
            </View>
          </View>
        ) : b.status === "in_progress" ? (
          <Button testID="complete-job-button" label="Enter Completion PIN" icon="key" onPress={() => setShowPin(true)} />
        ) : (
          <Text style={{ textAlign: "center", color: colors.textMuted, fontWeight: "600" }}>
            {b.status === "completed" ? "Job completed 🎉" : b.status === "cancelled" ? "Cancelled" : "Awaiting…"}
          </Text>
        )}
      </View>

      {/* Reject modal */}
      <Modal visible={showReject} transparent animationType="slide" onRequestClose={() => setShowReject(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, shadow.pop]}>
            <Text style={styles.sectionTitle}>Reject this job?</Text>
            <Text style={styles.muted}>Reason is required. We&apos;ll reassign to another worker.</Text>
            <TextInput
              testID="reject-reason-input"
              value={reason}
              onChangeText={setReason}
              placeholder="Why are you rejecting?"
              placeholderTextColor={colors.textFaint}
              multiline
              style={{ backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, minHeight: 80, textAlignVertical: "top", color: colors.text, fontSize: 14 }}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button label="Close" variant="ghost" onPress={() => setShowReject(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  testID="confirm-reject-button"
                  label="Reject"
                  variant="danger"
                  onPress={async () => {
                    if (!reason.trim()) { setErr("Reason is required"); return; }
                    try {
                      await api.rejectJob(b.id, reason);
                      setShowReject(false);
                      setReason("");
                      router.back();
                    } catch (e: any) {
                      setErr(e.message || "Could not reject");
                    }
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Worker cancel modal */}
      <Modal visible={showCancel} transparent animationType="slide" onRequestClose={() => setShowCancel(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, shadow.pop]}>
            <Text style={styles.sectionTitle}>Cancel booking?</Text>
            <Text style={styles.muted}>Please tell us why.</Text>
            <TextInput
              testID="worker-cancel-reason-input"
              value={reason}
              onChangeText={setReason}
              placeholder="Reason"
              placeholderTextColor={colors.textFaint}
              multiline
              style={{ backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm, minHeight: 80, textAlignVertical: "top", color: colors.text, fontSize: 14 }}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button label="Close" variant="ghost" onPress={() => setShowCancel(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  testID="confirm-worker-cancel-button"
                  label="Cancel It"
                  variant="danger"
                  onPress={async () => {
                    if (!reason.trim()) { setErr("Reason is required"); return; }
                    try {
                      await api.cancelBooking(b.id, reason);
                      setShowCancel(false);
                      setReason("");
                      router.back();
                    } catch (e: any) {
                      setErr(e.message || "Could not cancel");
                    }
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* PIN modal */}
      <Modal visible={showPin} transparent animationType="slide" onRequestClose={() => setShowPin(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, shadow.pop]}>
            <Text style={styles.sectionTitle}>Enter Completion PIN</Text>
            <Text style={styles.muted}>Ask the customer for their 4-digit code.</Text>
            <View style={styles.pinRow}>
              {pin.map((d, i) => (
                <TextInput
                  key={i}
                  testID={`pin-digit-${i}`}
                  ref={(r) => { refs.current[i] = r; }}
                  value={d}
                  onChangeText={(t) => {
                    const ch = t.replace(/\D/g, "").slice(0, 1);
                    const next = [...pin];
                    next[i] = ch;
                    setPin(next);
                    if (ch && i < 3) refs.current[i + 1]?.focus();
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={[styles.pinInput, d ? { borderColor: colors.brand, backgroundColor: colors.brandLight } : null]}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="ghost" onPress={() => setShowPin(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="verify-pin-submit" label="Verify" icon="checkmark" onPress={submitPin} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "800", color: colors.text },

  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  iconBig: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  bigTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13 },
  body: { color: colors.text, fontSize: 14 },

  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1, paddingVertical: 12, backgroundColor: colors.brandLight, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionTxt: { color: colors.brand, fontWeight: "700", fontSize: 13 },

  cta: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderSoft },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl },
  pinRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginVertical: spacing.lg },
  pinInput: { width: 56, height: 64, borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, textAlign: "center", fontSize: 22, fontWeight: "800", color: colors.text },
});
