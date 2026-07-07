// Admin app entry — routes to /dashboard if an admin session is cached,
// otherwise to /login. Customers/workers cannot reach this app since it
// runs as a fully separate Expo project with its own storage namespace.
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { api, clearSession, getCachedUser, setCachedUser } from "@/src/api";
import { colors } from "@/src/theme";

export default function AdminRootIndex() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const cached = await getCachedUser();
      if (!cached) {
        router.replace("/login");
        return;
      }
      try {
        const me = await api.me();
        if (me.role !== "admin") {
          // Defensive: a non-admin token will never have been written by this
          // app (namespaced storage), but if someone hand-crafts one we reject.
          await clearSession();
          router.replace("/login");
          return;
        }
        await setCachedUser(me);
        router.replace("/dashboard");
      } catch {
        await clearSession();
        router.replace("/login");
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
