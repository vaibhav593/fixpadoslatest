import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api, clearSession, getCachedUser, setCachedUser } from "@/src/api";
import { colors, radius, shadow, spacing } from "@/src/theme";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function WorkerRejected() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "info" | "success" | "error"; msg: string } | null>(null);

  const load = useCallback(async () => {
    const cached = await getCachedUser();
    if (!cached) {
      router.replace("/role");
      return;
    }
    setUser(cached);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const resubmit = async () => {
    setSubmitting(true);
    setToast(null);
    try {
      await api.resubmitWorker();
      const me = await api.me();
      await setCachedUser(me);
      setToast({ type: "success", msg: "Profile resubmitted for review." });
      setTimeout(() => router.replace("/worker-pending"), 700);
    } catch (e) {
      const err = e as Error;
      setToast({ type: "error", msg: err.message || "Could not resubmit." });
    } finally {
      setSubmitting(false);
    }
  };

  const updateDetails = () => {
    // Reuse the existing worker-onboarding screen to update profile photo, categories, KYC docs.
    router.push("/worker-onboarding");
  };

  const signOut = async () => {
    await clearSession();
    router.replace("/role");
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]} testID="worker-rejected-screen">
      <View style={styles.topBar}>
        <Text style={styles.brand}>FixPados</Text>
        <TouchableOpacity testID="worker-rejected-signout" onPress={signOut} style={styles.signOutBtn}>
          <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
          <Text style={styles.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.iconWrap, shadow.card]} testID="worker-rejected-icon">
          <Ionicons name="close-circle" size={84} color={colors.danger} />
        </View>

        <Text testID="worker-rejected-title" style={styles.title}>Verification Rejected</Text>
        <Text style={styles.message}>
          Your verification did not meet our requirements. You can update your details and submit again.
        </Text>

        <View style={[styles.reasonCard, shadow.card]} testID="worker-rejected-reason-card">
          <View style={styles.reasonHead}>
            <Ionicons name="information-circle" size={18} color={colors.danger} />
            <Text style={styles.reasonHeadTxt}>Rejection Reason</Text>
          </View>
          <Text testID="worker-rejected-reason" style={styles.reasonBody}>
            {user?.rejection_reason?.trim() || "No specific reason was provided. Please contact support if you'd like more detail."}
          </Text>
        </View>

        <View style={[styles.detailsCard, shadow.card]}>
          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
              <Text style={styles.detailLabelTxt}>Applicant</Text>
            </View>
            <Text style={styles.detailValue}>{user?.name || "—"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.detailLabelTxt}>Rejected On</Text>
            </View>
            <Text testID="worker-rejected-date" style={styles.detailValue}>
              {formatDate(user?.rejected_date)}
            </Text>
          </View>
        </View>

        {toast ? <Toast type={toast.type} message={toast.msg} /> : null}

        <View style={styles.actions}>
          <Button
            testID="worker-rejected-resubmit-button"
            label={submitting ? "Resubmitting…" : "Resubmit Verification"}
            icon="refresh-circle"
            onPress={resubmit}
            loading={submitting}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            testID="worker-rejected-update-button"
            label="Update Profile Details"
            icon="create-outline"
            variant="ghost"
            onPress={updateDetails}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontWeight: "800", color: colors.text, fontSize: 18, letterSpacing: -0.2 },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutTxt: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },

  body: { padding: spacing.xl, paddingBottom: spacing.xxl, alignItems: "center" },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, textAlign: "center", letterSpacing: -0.3 },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },

  reasonCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.dangerBg,
  },
  reasonHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  reasonHeadTxt: { color: colors.danger, fontWeight: "800", fontSize: 13, letterSpacing: 0.2 },
  reasonBody: { color: colors.text, fontSize: 14, lineHeight: 20 },

  detailsCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    marginTop: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
  },
  detailLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailLabelTxt: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.borderSoft },

  actions: { width: "100%", marginTop: spacing.xl },
});
