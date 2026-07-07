import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AdminShell, adminStyles } from "@/src/components/AdminShell";
import { api } from "@/src/api";
import { colors, spacing } from "@/src/theme";

const KPI = [
  { key: "customers", label: "Total Customers", icon: "people", color: "#2563EB" },
  { key: "workers", label: "Total Workers", icon: "construct", color: "#7C3AED" },
  { key: "active_workers", label: "Active Workers", icon: "flash", color: "#10B981" },
  { key: "bookings", label: "Total Bookings", icon: "briefcase", color: "#F59E0B" },
  { key: "completed", label: "Completed", icon: "trophy", color: "#10B981" },
  { key: "cancelled", label: "Cancelled", icon: "close-circle", color: "#EF4444" },
  { key: "in_progress", label: "In Progress", icon: "time", color: "#3B82F6" },
  { key: "pending_verification", label: "Pending Verifications", icon: "hourglass", color: "#F59E0B" },
  { key: "approved_workers", label: "Approved Workers", icon: "shield-checkmark", color: "#10B981" },
  { key: "rejected_workers", label: "Rejected Workers", icon: "alert-circle", color: "#EF4444" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({});

  useFocusEffect(
    useCallback(() => {
      api.adminStats().then(setStats).catch(() => {});
    }, []),
  );

  return (
    <AdminShell title="Dashboard">
      <View style={styles.grid}>
        {KPI.map((k) => (
          <View key={k.key} testID={`kpi-${k.key}`} style={[adminStyles.card, styles.kpi]}>
            <View style={[styles.iconWrap, { backgroundColor: `${k.color}1A` }]}>
              <Ionicons name={k.icon as any} color={k.color} size={20} />
            </View>
            <Text style={styles.kpiN}>{stats[k.key] ?? 0}</Text>
            <Text style={styles.kpiL}>{k.label}</Text>
          </View>
        ))}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  kpi: { minWidth: 180, flex: 1, alignItems: "flex-start", gap: 6 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  kpiN: { fontSize: 24, fontWeight: "800", color: colors.text },
  kpiL: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
});
