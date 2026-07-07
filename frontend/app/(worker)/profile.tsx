import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, clearSession, getCachedUser, setCachedUser } from "@/src/api";
import { workerColors as colors, radius, shadow, spacing } from "@/src/theme";

export default function WorkerProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCachedUser();
      if (!u) {
        router.replace("/role");
        return;
      }
      setUser(u);
      setAvailable(!!u?.available);
    })();
  }, [router]);

  const toggleAvail = async (v: boolean) => {
    setAvailable(v);
    try {
      const u = await api.updateProfile({ available: v });
      await setCachedUser(u);
    } catch {}
  };

  const logout = async () => {
    await clearSession();
    router.replace("/role");
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 32 }}>
        <View style={[styles.head, shadow.card]}>
          <Image
            source={{ uri: user?.photo || "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=200" }}
            style={styles.avatar}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.name}>{user?.name}</Text>
            {user?.verified ? <Ionicons name="shield-checkmark" color={colors.success} size={16} /> : null}
          </View>
          <Text style={styles.mobile}>{user?.mobile}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Ionicons name="star" color={colors.warning} size={14} />
            <Text style={styles.meta}>
              {(user?.rating ?? 4.5).toFixed(1)} · {user?.completed_jobs ?? 0} jobs
            </Text>
          </View>
        </View>

        <View style={[styles.row, shadow.card]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Available for jobs</Text>
            <Text style={styles.rowSub}>Turn off to pause job assignments</Text>
          </View>
          <Switch
            testID="availability-switch"
            value={available}
            onValueChange={toggleAvail}
            trackColor={{ true: colors.brand, false: colors.border }}
          />
        </View>

        <TouchableOpacity
          testID="logout-button"
          onPress={logout}
          style={styles.logoutBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" color={colors.text} size={18} />
          <Text style={styles.logoutTxt}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center" },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing.sm },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  mobile: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  rowTitle: { fontWeight: "700", color: colors.text, fontSize: 14 },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  logoutTxt: { color: colors.text, fontWeight: "700", letterSpacing: 0.2, fontSize: 15 },
});
