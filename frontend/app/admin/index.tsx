// Admin entry — routes to /admin/dashboard if an admin session is cached,
// otherwise to /admin/login.
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { api, clearSession, getCachedUser, setCachedUser } from "@/src/api";
import { colors } from "@/src/theme";

export default function AdminIndex() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const cached = await getCachedUser();
      if (!cached || cached.role !== "admin") {
        router.replace("/admin/login");
        return;
      }
      try {
        const me = await api.me();
        if (me.role !== "admin") {
          await clearSession();
          router.replace("/admin/login");
          return;
        }
        await setCachedUser(me);
        router.replace("/admin/dashboard");
      } catch {
        await clearSession();
        router.replace("/admin/login");
      }
    })();
  }, [router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
