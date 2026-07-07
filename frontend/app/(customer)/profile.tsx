import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { api, clearSession, getCachedUser } from "@/src/api";
import { colors, radius, shadow, spacing } from "@/src/theme";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [count, setCount] = useState(0);
  const [addresses, setAddresses] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const u = await getCachedUser();
      if (!u) {
        router.replace("/role");
        return;
      }
      setUser(u);
      try {
        const [bookings, addr] = await Promise.all([api.myBookings(), api.listAddresses()]);
        setCount(bookings.length);
        setAddresses(addr);
      } catch {}
    })();
  }, [router]);

  const logout = async () => {
    await clearSession();
    router.replace("/role");
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32, gap: spacing.lg }}>
        <View style={[styles.head, shadow.card]}>
          <View style={styles.avatar}>
            <Ionicons name="person" color={colors.brand} size={28} />
          </View>
          <Text testID="profile-name" style={styles.name}>{user?.name}</Text>
          <Text testID="profile-mobile" style={styles.mobile}>{user?.mobile}</Text>
        </View>

        <View style={[styles.stats, shadow.card]}>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{count}</Text>
            <Text style={styles.statL}>Bookings</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statBox}>
            <Text style={styles.statN}>{addresses.length}</Text>
            <Text style={styles.statL}>Addresses</Text>
          </View>
        </View>

        <View style={[styles.section, shadow.card]}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            <TouchableOpacity
              testID="add-address-button"
              onPress={() => router.push("/address-new")}
              style={styles.addBtn}
            >
              <Ionicons name="add" color={colors.brand} size={16} />
              <Text style={styles.addBtnTxt}>Add</Text>
            </TouchableOpacity>
          </View>
          {addresses.length === 0 ? (
            <Text style={styles.empty}>No saved addresses yet.</Text>
          ) : (
            addresses.map((a) => (
              <View key={a.id} testID={`address-${a.id}`} style={styles.addrRow}>
                <Ionicons name="location" color={colors.brand} size={16} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addrLabel}>{a.label}</Text>
                  <Text style={styles.addrLine} numberOfLines={2}>
                    {a.line} {a.landmark ? `· ${a.landmark}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  testID={`delete-address-${a.id}`}
                  onPress={async () => {
                    await api.delAddress(a.id).catch(() => {});
                    setAddresses((p) => p.filter((x) => x.id !== a.id));
                  }}
                >
                  <Ionicons name="trash-outline" color={colors.danger} size={16} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={[styles.section, shadow.card]}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            testID="booking-history-link"
            onPress={() => router.push("/(customer)/bookings")}
            style={styles.link}
          >
            <Ionicons name="time" color={colors.brand} size={18} />
            <Text style={styles.linkTxt}>Booking History</Text>
            <Ionicons name="chevron-forward" color={colors.textFaint} size={16} />
          </TouchableOpacity>
        </View>

        <Button testID="logout-button" label="Log out" variant="ghost" icon="log-out" onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center" },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  mobile: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  stats: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg },
  statBox: { flex: 1, alignItems: "center" },
  statN: { fontSize: 22, fontWeight: "800", color: colors.text },
  statL: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statSep: { width: 1, backgroundColor: colors.borderSoft },

  section: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  addBtn: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: colors.brandLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  addBtnTxt: { color: colors.brand, fontWeight: "700", fontSize: 12 },
  empty: { color: colors.textMuted, fontSize: 13 },
  addrRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  addrLabel: { fontWeight: "700", color: colors.text, fontSize: 13 },
  addrLine: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  link: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 6 },
  linkTxt: { flex: 1, color: colors.text, fontWeight: "600", fontSize: 14 },
});
