import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AdminShell, adminStyles } from "@/src/components/AdminShell";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function AdminAnalytics() {
  const [data, setData] = useState<any>({ category_performance: [], customer_growth: [], cancellation_rate: 0, total_bookings: 0, active_workers: 0 });

  useFocusEffect(useCallback(() => {
    api.adminAnalytics().then(setData).catch(() => {});
  }, []));

  const maxBars = Math.max(1, ...data.category_performance.map((c: any) => c.total));
  const maxGrowth = Math.max(1, ...data.customer_growth.map((d: any) => d.count));

  return (
    <AdminShell title="Analytics">
      <View style={styles.kpiRow}>
        <View style={[adminStyles.card, styles.kpiBox]}>
          <Ionicons name="briefcase" color={colors.brand} size={20} />
          <Text style={styles.kpiN}>{data.total_bookings}</Text>
          <Text style={styles.kpiL}>Total Bookings</Text>
        </View>
        <View style={[adminStyles.card, styles.kpiBox]}>
          <Ionicons name="people" color={colors.success} size={20} />
          <Text style={styles.kpiN}>{data.active_workers}</Text>
          <Text style={styles.kpiL}>Active Workers</Text>
        </View>
        <View style={[adminStyles.card, styles.kpiBox]}>
          <Ionicons name="close-circle" color={colors.danger} size={20} />
          <Text style={styles.kpiN}>{data.cancellation_rate}%</Text>
          <Text style={styles.kpiL}>Cancellation Rate</Text>
        </View>
      </View>

      <View style={adminStyles.card}>
        <Text style={adminStyles.sectionTitle}>Category Performance</Text>
        {data.category_performance.length === 0 ? (
          <Text style={styles.muted}>No bookings yet.</Text>
        ) : data.category_performance.map((c: any) => (
          <View key={c.category} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.barLabel}>{c.category}</Text>
              <Text style={styles.muted}>{c.completed} done · {c.cancelled} cancelled · {c.total} total</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(c.total / maxBars) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>

      <View style={adminStyles.card}>
        <Text style={adminStyles.sectionTitle}>Customer Growth (last 14 days)</Text>
        {data.customer_growth.length === 0 ? (
          <Text style={styles.muted}>No new customers yet.</Text>
        ) : (
          <View style={styles.chartRow}>
            {data.customer_growth.map((d: any) => (
              <View key={d.date} style={styles.chartBarWrap}>
                <View style={[styles.chartBar, { height: `${(d.count / maxGrowth) * 100}%` }]} />
                <Text style={styles.chartLabel}>{d.date.slice(5)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  kpiBox: { minWidth: 180, flex: 1, alignItems: "flex-start", gap: 6 },
  kpiN: { fontSize: 24, fontWeight: "800", color: colors.text },
  kpiL: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },

  muted: { color: colors.textMuted, fontSize: 13 },
  barLabel: { fontWeight: "700", color: colors.text, fontSize: 13 },
  barTrack: { height: 10, backgroundColor: colors.borderSoft, borderRadius: radius.pill, marginTop: 6, overflow: "hidden" },
  barFill: { height: 10, backgroundColor: colors.brand, borderRadius: radius.pill },

  chartRow: { flexDirection: "row", alignItems: "flex-end", height: 140, gap: 6 },
  chartBarWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  chartBar: { width: "100%", backgroundColor: colors.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4 },
  chartLabel: { fontSize: 9, color: colors.textMuted, marginTop: 4 },
});
