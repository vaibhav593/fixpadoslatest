import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { api, clearSession, getCachedUser, setCachedUser } from "@/src/api";
import { colors } from "@/src/theme";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const cached = await getCachedUser();
      if (!cached) {
        router.replace("/role");
        return;
      }
      try {
        const me = await api.me();
        await setCachedUser(me);
        if (me.role === "admin") router.replace("/admin/dashboard");
        else if (me.role === "worker") {
          const status = (me as any).kyc_status;
          if (status === "rejected") router.replace("/worker-rejected");
          else if (status === "approved") router.replace("/(worker)/jobs");
          else router.replace("/worker-pending"); // pending or submitted
        } else router.replace("/(customer)/home");
      } catch {
        await clearSession();
        router.replace("/role");
      }
    })();
  }, [router]);

  return (
    <View testID="splash" style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
