import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
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
import { api, getCachedUser } from "@/src/api";
import { CATEGORY_ICON, colors, radius, shadow, spacing } from "@/src/theme";

const TIMELINE = [
  { key: "created", label: "Booking Created", icon: "create" },
  { key: "worker_assigned", label: "Worker Assigned", icon: "person-add" },
  { key: "worker_accepted", label: "Worker Accepted", icon: "checkmark-done" },
  { key: "in_progress", label: "In Progress", icon: "play-circle" },
  { key: "completed", label: "Completed", icon: "trophy" },
] as const;

const ORDER = TIMELINE.map((t) => t.key);

export default function BookingDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [showRate, setShowRate] = useState(false);
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const u = await getCachedUser();
      setMe(u);
      const b = await api.getBooking(id);
      setBooking(b);
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!booking) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <Text style={{ padding: spacing.lg }}>Loading…</Text>
        {err ? <Toast type="error" message={err} /> : null}
      </SafeAreaView>
    );
  }

  const currentIdx = ORDER.indexOf(booking.status);
  const cancelled = booking.status === "cancelled";

  const openMaps = () => {
    if (booking.latitude && booking.longitude) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${booking.latitude},${booking.longitude}`);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`);
    }
  };

  const call = () => {
    if (booking.worker?.mobile) Linking.openURL(`tel:${booking.worker.mobile}`);
  };

  const doCancel = async () => {
    try {
      await api.cancelBooking(booking.id, reason || "Cancelled by customer");
      setShowCancel(false);
      load();
    } catch (e: any) {
      setErr(e.message || "Cancel failed");
    }
  };

  const submitRating = async () => {
    try {
      await api.rateBooking(booking.id, stars, review);
      setShowRate(false);
      load();
    } catch (e: any) {
      setErr(e.message || "Rating failed");
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Booking Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.lg }}>
        {/* Summary */}
        <View style={[styles.card, shadow.card]}>
          <View style={styles.summaryRow}>
            <View style={styles.iconBig}>
              <Ionicons
                name={(CATEGORY_ICON[booking.category_icon] || "construct") as any}
                color={colors.brand}
                size={24}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigTitle}>{booking.category_name}</Text>
              <Text style={styles.muted} numberOfLines={2}>{booking.problem}</Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <StatusPill status={booking.status} testID="booking-status-pill" />
          </View>
        </View>

        {/* Status timeline */}
        {!cancelled ? (
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.sectionTitle}>Status</Text>
            {TIMELINE.map((step, idx) => {
              const done = idx <= currentIdx;
              const active = idx === currentIdx;
              return (
                <View key={step.key} style={styles.tlRow}>
                  <View
                    style={[
                      styles.tlDot,
                      done && { backgroundColor: colors.brand, borderColor: colors.brand },
                      active && { backgroundColor: colors.brand },
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : null}
                  </View>
                  <Text style={[styles.tlLabel, done && { color: colors.text, fontWeight: "700" }]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.card, shadow.card, { borderColor: colors.danger, borderWidth: 1 }]}>
            <Text style={[styles.sectionTitle, { color: colors.danger }]}>Cancelled</Text>
            <Text style={styles.muted}>By: {booking.cancelled_by || "—"}</Text>
            <Text style={styles.muted}>Reason: {booking.cancellation_reason || "—"}</Text>
          </View>
        )}

        {/* Worker card */}
        {booking.worker ? (
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.sectionTitle}>Your Worker</Text>
            <View style={styles.workerRow}>
              <Image
                source={{
                  uri: booking.worker.photo || "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=200",
                }}
                style={styles.workerPic}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.workerName}>{booking.worker.name}</Text>
                  {booking.worker.verified ? (
                    <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Ionicons name="star" size={12} color={colors.warning} />
                  <Text style={styles.workerMeta}>
                    {(booking.worker.rating ?? 4.5).toFixed(1)} · {booking.worker.completed_jobs ?? 0} jobs
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                testID="chat-worker-button"
                onPress={() => router.push({ pathname: "/chat/[bookingId]", params: { bookingId: booking.id } })}
                style={[styles.actionBtn, shadow.card]}
              >
                <Ionicons name="chatbubbles" size={16} color={colors.brand} />
                <Text style={styles.actionTxt}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="call-worker-button" onPress={call} style={[styles.actionBtn, shadow.card]}>
                <Ionicons name="call" size={16} color={colors.brand} />
                <Text style={styles.actionTxt}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="open-maps-button" onPress={openMaps} style={[styles.actionBtn, shadow.card]}>
                <Ionicons name="map" size={16} color={colors.brand} />
                <Text style={styles.actionTxt}>Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Address */}
        <View style={[styles.card, shadow.card]}>
          <Text style={styles.sectionTitle}>Service Address</Text>
          <Text style={styles.body}>{booking.address}</Text>
          {booking.landmark ? <Text style={styles.muted}>Landmark: {booking.landmark}</Text> : null}
          <Text style={styles.muted}>
            {booking.schedule_type === "now" ? "Need Now" : `Scheduled · ${booking.scheduled_date} · ${booking.time_slot}`}
          </Text>
        </View>

        {/* PIN for customer */}
        {me?.role === "customer" && !cancelled && booking.status !== "completed" && booking.completion_pin ? (
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.sectionTitle}>Service Completion PIN</Text>
            <Text style={styles.muted}>Share with worker only after the job is done.</Text>
            <View style={styles.pinRow}>
              {String(booking.completion_pin).split("").map((d: string, i: number) => (
                <View key={i} style={styles.pinBox}>
                  <Text style={styles.pinDigit}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Rating completed */}
        {booking.status === "completed" ? (
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.sectionTitle}>Rate your experience</Text>
            {booking.rating ? (
              <Text style={styles.muted}>You rated {booking.rating}/5 · "{booking.review || ""}"</Text>
            ) : me?.role === "customer" ? (
              <Button
                testID="rate-worker-button"
                label="Leave a Rating"
                icon="star"
                onPress={() => setShowRate(true)}
              />
            ) : null}
          </View>
        ) : null}

        {/* Cancel */}
        {me?.role === "customer" && ["created", "worker_assigned", "worker_accepted"].includes(booking.status) ? (
          <Button
            testID="cancel-booking-button"
            label="Cancel Booking"
            variant="danger"
            icon="close-circle"
            onPress={() => setShowCancel(true)}
          />
        ) : null}

        {err ? <Toast type="error" message={err} /> : null}
      </ScrollView>

      {/* Cancel modal */}
      <Modal visible={showCancel} transparent animationType="slide" onRequestClose={() => setShowCancel(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, shadow.pop]}>
            <Text style={styles.sectionTitle}>Cancel Booking</Text>
            <Text style={styles.muted}>Please tell us why</Text>
            <TextInput
              testID="cancel-reason-input"
              value={reason}
              onChangeText={setReason}
              placeholder="Reason"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { minHeight: 80, textAlignVertical: "top", marginTop: spacing.sm }]}
              multiline
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button label="Close" variant="ghost" onPress={() => setShowCancel(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="confirm-cancel-button" label="Cancel It" variant="danger" onPress={doCancel} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rate modal */}
      <Modal visible={showRate} transparent animationType="slide" onRequestClose={() => setShowRate(false)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modal, shadow.pop]}>
            <Text style={styles.sectionTitle}>Rate the worker</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} testID={`star-${n}`} onPress={() => setStars(n)}>
                  <Ionicons
                    name={n <= stars ? "star" : "star-outline"}
                    color={colors.warning}
                    size={32}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              testID="rating-review-input"
              value={review}
              onChangeText={setReview}
              placeholder="Write a review (optional)"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              multiline
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button label="Close" variant="ghost" onPress={() => setShowRate(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="submit-rating-button" label="Submit" icon="checkmark" onPress={submitRating} />
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
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 4 },

  summaryRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  iconBig: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  bigTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13 },
  body: { color: colors.text, fontSize: 14 },

  tlRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 6 },
  tlDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  tlLabel: { color: colors.textMuted, fontSize: 13 },

  workerRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  workerPic: { width: 56, height: 56, borderRadius: 28 },
  workerName: { fontWeight: "800", color: colors.text, fontSize: 15 },
  workerMeta: { color: colors.textMuted, fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, paddingVertical: 12,
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  actionTxt: { color: colors.brand, fontWeight: "700", fontSize: 13 },

  pinRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
  pinBox: {
    width: 50, height: 60,
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
  },
  pinDigit: { fontSize: 24, fontWeight: "800", color: colors.brandDark },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.xl,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: spacing.md, marginVertical: spacing.lg },
});
