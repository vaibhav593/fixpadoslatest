import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatusPill } from "@/src/components/StatusPill";
import { api, getCachedUser } from "@/src/api";
import { CATEGORY_ICON, workerColors as colors, radius, shadow, spacing } from "@/src/theme";

export default function WorkerJobs() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setUser(await getCachedUser());
    try {
      const data = await api.workerJobs();
      setItems(data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = items.filter((j) => !["completed", "cancelled"].includes(j.status));
  const history = items.filter((j) => ["completed", "cancelled"].includes(j.status));

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <FlatList
        data={[...active, ...history]}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          />
        }
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={[colors.gradStart, colors.gradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <Text style={styles.hello}>Hi, {user?.name?.split(" ")[0] || "Pro"} 👋</Text>
              <Text style={styles.welcome}>You have {active.length} active job{active.length === 1 ? "" : "s"}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statN}>{user?.completed_jobs ?? 0}</Text>
                  <Text style={styles.statL}>Completed</Text>
                </View>
                <View style={styles.statBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="star" color="#FBBF24" size={16} />
                    <Text style={styles.statN}>{(user?.rating ?? 4.5).toFixed(1)}</Text>
                  </View>
                  <Text style={styles.statL}>Rating</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statN}>{active.length}</Text>
                  <Text style={styles.statL}>Active</Text>
                </View>
              </View>
            </LinearGradient>
            <Text style={styles.section}>Jobs</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`worker-job-${item.id}`}
            onPress={() => router.push({ pathname: "/worker-job/[id]", params: { id: item.id } })}
            style={[styles.card, shadow.card]}
            activeOpacity={0.9}
          >
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={(CATEGORY_ICON[item.category_icon] || "construct") as any}
                  color={colors.brand}
                  size={20}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cat}>{item.category_name}</Text>
                <Text style={styles.addr} numberOfLines={1}>{item.address}</Text>
              </View>
              <Ionicons name="chevron-forward" color={colors.textFaint} size={18} />
            </View>
            <View style={styles.footer}>
              <StatusPill status={item.status} />
              <Text style={styles.time}>
                {item.schedule_type === "now" ? "Now" : `${item.scheduled_date} ${item.time_slot}`}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text testID="worker-empty" style={styles.empty}>No jobs yet. Check back soon!</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  banner: {
    margin: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xxl,
  },
  hello: { color: "#fff", fontSize: 22, fontWeight: "800" },
  welcome: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.md },
  statBox: { flex: 1, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  statN: { color: "#fff", fontWeight: "800", fontSize: 18 },
  statL: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 4 },

  section: { paddingHorizontal: spacing.lg, fontSize: 14, fontWeight: "800", color: colors.text, marginVertical: spacing.sm },

  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  cat: { fontSize: 15, fontWeight: "800", color: colors.text },
  addr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  empty: { textAlign: "center", color: colors.textMuted, paddingVertical: spacing.xl },
});
