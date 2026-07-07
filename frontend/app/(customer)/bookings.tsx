import { Ionicons } from "@expo/vector-icons";
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
import { api } from "@/src/api";
import { CATEGORY_ICON, colors, radius, shadow, spacing } from "@/src/theme";

export default function MyBookings() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.myBookings();
      setItems(data);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.head}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View testID="empty-bookings" style={[styles.empty, shadow.card]}>
            <Ionicons name="calendar-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySub}>Your service history will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`booking-card-${item.id}`}
            onPress={() => router.push({ pathname: "/booking/[id]", params: { id: item.id } })}
            activeOpacity={0.9}
            style={[styles.card, shadow.card]}
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
                <Text style={styles.addr} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
              <Ionicons name="chevron-forward" color={colors.textFaint} size={18} />
            </View>
            <View style={styles.footer}>
              <StatusPill status={item.status} />
              <Text style={styles.time}>
                {item.schedule_type === "now" ? "Now" : `${item.scheduled_date || ""} ${item.time_slot || ""}`}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cat: { fontSize: 15, fontWeight: "800", color: colors.text },
  addr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },

  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xl,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 6 },
  emptySub: { fontSize: 12, color: colors.textMuted },
});
