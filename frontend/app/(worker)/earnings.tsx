import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { workerColors as colors, radius, shadow, spacing } from "@/src/theme";

export default function Earnings() {
  const [data, setData] = useState<any>({});

  useFocusEffect(
    useCallback(() => {
      api.workerEarnings().then(setData).catch(() => {});
    }, []),
  );

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 }}>
        <Text style={styles.title}>Earnings</Text>

        <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={styles.hero}>
          <Text style={styles.heroLabel}>TOTAL EARNINGS</Text>
          <Text style={styles.heroAmt}>₹{(data.total_earnings ?? 0).toLocaleString()}</Text>
          <Text style={styles.heroSub}>From {data.completed_jobs ?? 0} completed jobs</Text>
        </LinearGradient>

        <View style={[styles.row, shadow.card]}>
          <View style={styles.statCard}>
            <Ionicons name="cash" color={colors.success} size={20} />
            <Text style={styles.statN}>₹{(data.this_week ?? 0).toLocaleString()}</Text>
            <Text style={styles.statL}>This Week</Text>
          </View>
          <View style={styles.sep} />
          <View style={styles.statCard}>
            <Ionicons name="star" color={colors.warning} size={20} />
            <Text style={styles.statN}>{(data.rating ?? 4.5).toFixed(1)}</Text>
            <Text style={styles.statL}>Avg Rating</Text>
          </View>
        </View>

        <View style={[styles.tip, shadow.card]}>
          <Ionicons name="bulb" color={colors.warning} size={18} />
          <Text style={styles.tipTxt}>
            Tip: Higher ratings = more jobs! Keep your service quality high to attract more bookings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  hero: { padding: spacing.xl, borderRadius: radius.xxl, gap: 4 },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 11, letterSpacing: 1.3 },
  heroAmt: { color: "#fff", fontSize: 32, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  row: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, alignItems: "center" },
  statCard: { flex: 1, alignItems: "center", gap: 6 },
  sep: { width: 1, backgroundColor: colors.borderSoft, alignSelf: "stretch" },
  statN: { fontWeight: "800", fontSize: 18, color: colors.text },
  statL: { color: colors.textMuted, fontSize: 12 },
  tip: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.warningBg, borderRadius: radius.xl, padding: spacing.lg, alignItems: "center" },
  tipTxt: { flex: 1, color: colors.text, fontSize: 13 },
});
