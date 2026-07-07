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

export default function ChatList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await api.myBookings();
    // chat is available once a worker is assigned and not yet cancelled
    setItems(data.filter((b: any) => b.worker_id && b.status !== "cancelled"));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <Text style={styles.title}>Chats</Text>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 32 }}
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
          <View testID="empty-chats" style={[styles.empty, shadow.card]}>
            <Ionicons name="chatbubbles-outline" size={36} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>No conversations</Text>
            <Text style={styles.emptySub}>Chats open once a worker is assigned.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`chat-row-${item.id}`}
            onPress={() => router.push({ pathname: "/chat/[bookingId]", params: { bookingId: item.id } })}
            activeOpacity={0.9}
            style={[styles.row, shadow.card]}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" color={colors.brand} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Worker for {item.category_name}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                Booking · {item.address}
              </Text>
            </View>
            <Ionicons name="chevron-forward" color={colors.textFaint} size={18} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, padding: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  name: { fontWeight: "800", color: colors.text, fontSize: 14 },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.xl, alignItems: "center", gap: 6, marginTop: spacing.xl,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 6 },
  emptySub: { fontSize: 12, color: colors.textMuted },
});
