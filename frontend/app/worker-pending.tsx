import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api, clearSession, getCachedUser, setCachedUser } from "@/src/api";
import { colors, radius, shadow, spacing } from "@/src/theme";

const SUPPORT_PHONE = "+919999988888";
const SUPPORT_EMAIL = "support@fixpados.com";

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

export default function WorkerPending() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  const refresh = async () => {
    setRefreshing(true);
    setToast(null);
    try {
      const me = await api.me();
      await setCachedUser(me);
      setUser(me);
      const status = (me as any).kyc_status;
      if (status === "approved") {
        setToast({ type: "success", msg: "Verified ✓ Redirecting to your dashboard…" });
        setTimeout(() => router.replace("/(worker)/jobs"), 800);
      } else if (status === "rejected") {
        router.replace("/worker-rejected");
      } else {
        setToast({ type: "info", msg: "Still under review. We'll notify you once approved." });
      }
    } catch {
      setToast({ type: "error", msg: "Couldn't refresh. Please check your connection." });
    } finally {
      setRefreshing(false);
    }
  };

  const contactSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
      Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
    });
  };

  const signOut = async () => {
    await clearSession();
    router.replace("/role");
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]} testID="worker-pending-screen">
      <View style={styles.topBar}>
        <Text style={styles.brand}>FixPados</Text>
        <TouchableOpacity testID="worker-pending-signout" onPress={signOut} style={styles.signOutBtn}>
          <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
          <Text style={styles.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={[styles.iconWrap, shadow.card]} testID="worker-pending-icon">
          <Ionicons name="shield-half" size={80} color={colors.brand} />
          <View style={styles.iconPulse} />
        </View>

        <Text testID="worker-pending-title" style={styles.title}>Verification Pending</Text>
        <Text style={styles.message}>
          Your profile is currently under review. You will be able to receive jobs after admin approval.
        </Text>

        <View style={[styles.detailsCard, shadow.card]}>
          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Ionicons name="time-outline" size={16} color={colors.warning} />
              <Text style={styles.detailLabelTxt}>Verification Status</Text>
            </View>
            <View testID="worker-pending-status-badge" style={[styles.statusBadge, { backgroundColor: colors.warningBg }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.statusBadgeTxt, { color: colors.warning }]}>Pending</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={styles.detailLabelTxt}>Registration Date</Text>
            </View>
            <Text testID="worker-pending-registration-date" style={styles.detailValue}>
              {formatDate(user?.verification_date || user?.created_at)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
              <Text style={styles.detailLabelTxt}>Applicant</Text>
            </View>
            <Text style={styles.detailValue}>{user?.name || "—"}</Text>
          </View>
        </View>

        {toast ? <Toast type={toast.type} message={toast.msg} /> : null}

        <View style={styles.actions}>
          <Button
            testID="worker-pending-refresh-button"
            label={refreshing ? "Checking…" : "Refresh Status"}
            icon="refresh"
            onPress={refresh}
            loading={refreshing}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            testID="worker-pending-support-button"
            label="Contact Support"
            icon="headset-outline"
            variant="ghost"
            onPress={contactSupport}
          />
        </View>

        <Text style={styles.footnote}>
          Reviews typically take 24–48 hours. We&apos;ll notify you the moment your profile is approved.
        </Text>
      </View>
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

  body: { flex: 1, paddingHorizontal: spacing.xl, alignItems: "center", paddingTop: spacing.xl },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
    position: "relative",
  },
  iconPulse: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: colors.brand,
    opacity: 0.25,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  detailsCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
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
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeTxt: { fontSize: 12, fontWeight: "800", letterSpacing: 0.2 },

  actions: { width: "100%", marginTop: spacing.xl },
  footnote: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
});
