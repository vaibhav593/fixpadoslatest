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

import { api } from "@/src/api";
import { colors, radius, shadow, spacing } from "@/src/theme";

function fmt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.notifications();
      setItems(data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onTap = async (n: any) => {
    if (!n.read) {
      api.markRead(n.id).catch(() => {});
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.booking_id) {
      router.push({ pathname: "/booking/[id]", params: { id: n.booking_id } });
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.head}>
        <Text style={styles.title}>Notifications</Text>
        {items.some((i) => !i.read) ? (
          <TouchableOpacity
            testID="mark-all-read"
            onPress={async () => {
              await api.markAllRead().catch(() => {});
              load();
            }}
          >
            <Text style={styles.mark}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View testID="empty-notifications" style={[styles.empty, shadow.card]}>
            <Ionicons name="notifications-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
            <Text style={styles.emptySub}>Updates about your bookings appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`notification-${item.id}`}
            onPress={() => onTap(item)}
            activeOpacity={0.9}
            style={[styles.row, shadow.card, !item.read && styles.unread]}
          >
            <View style={styles.dotWrap}>
              <View style={[styles.dot, { backgroundColor: item.read ? colors.textFaint : colors.brand }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.t}>{item.title}</Text>
              <Text style={styles.b} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.time}>{fmt(item.created_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  mark: { color: colors.brand, fontWeight: "700", fontSize: 13 },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  unread: { backgroundColor: colors.infoBg },
  dotWrap: { paddingTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  t: { fontWeight: "800", color: colors.text, fontSize: 14 },
  b: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  time: { fontSize: 11, color: colors.textFaint, marginTop: 6 },
  empty: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: "center", gap: 6, marginTop: spacing.xl,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 6 },
  emptySub: { fontSize: 12, color: colors.textMuted },
});
