// Admin route group guard.
// Only sessions where `role === "admin"` may render admin screens; everyone
// else is bounced to /admin/login (which validates the ADMIN_PASSWORD).
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { api, clearSession, getCachedUser } from "@/src/api";
import { colors } from "@/src/theme";

export default function AdminLayout() {
  const router = useRouter();
  const segs = useSegments();
  const [ready, setReady] = useState(false);

  // Public sub-routes inside /admin that DON'T require an admin session.
  const isPublic = segs[segs.length - 1] === "login" || segs[segs.length - 1] === "index";

  useEffect(() => {
    (async () => {
      if (isPublic) {
        setReady(true);
        return;
      }
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
      } catch {
        await clearSession();
        router.replace("/admin/login");
        return;
      }
      setReady(true);
    })();
  }, [router, isPublic]);

  if (!ready) {
    return (
      <View testID="admin-guard-loading" style={styles.wrap}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
