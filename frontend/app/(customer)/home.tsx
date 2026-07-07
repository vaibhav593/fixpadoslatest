import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeroBanner } from "@/src/components/HeroBanner";
import { StatusPill } from "@/src/components/StatusPill";
import { api, getCachedUser } from "@/src/api";
import { CATEGORY_ICON, colors, radius, shadow, spacing } from "@/src/theme";

export default function CustomerHome() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [banner, setBanner] = useState<any>(null);
  const [city, setCity] = useState<string>("Detecting...");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const u = await getCachedUser();
    setUser(u);
    try {
      const [cats, mine, b] = await Promise.all([
        api.listCategories(true),
        api.myBookings(),
        api.activeBanner().catch(() => null),
      ]);
      setCategories(cats);
      setBookings(mine.slice(0, 5));
      if (b && b.title) setBanner(b);
    } catch {}
  }, []);

  const detectLocation = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setCity("Set location");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      setCity(place?.city || place?.subregion || place?.region || "Your area");
    } catch {
      setCity("Set location");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      detectLocation();
    }, [load, detectLocation]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity testID="location-selector" style={styles.locWrap}>
            <Ionicons name="location" color={colors.brand} size={16} />
            <View>
              <Text style={styles.locLabel}>YOUR LOCATION</Text>
              <Text style={styles.locCity} numberOfLines={1}>
                {city}
              </Text>
            </View>
            <Ionicons name="chevron-down" color={colors.text} size={14} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="header-notifications-button"
            onPress={() => router.push("/(customer)/notifications")}
            style={styles.bell}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hi}>Hi, {user?.name?.split(" ")[0] || "there"} 👋</Text>

        <View style={{ marginTop: spacing.md }}>
          <HeroBanner banner={banner} />
        </View>

        {/* Categories */}
        <Text style={styles.sectionTitle}>Our Services</Text>
        <View style={styles.grid}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              testID={`category-${c.name.toLowerCase().replace(/\s/g, "-")}`}
              onPress={() => router.push({ pathname: "/booking/new", params: { categoryId: c.id } })}
              style={[styles.cat, shadow.card]}
              activeOpacity={0.85}
            >
              <View style={styles.catIconWrap}>
                <Ionicons
                  name={(CATEGORY_ICON[c.icon] || "construct") as any}
                  size={22}
                  color={colors.brand}
                />
              </View>
              <Text style={styles.catName} numberOfLines={2}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent bookings */}
        <View style={styles.recentHead}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          {bookings.length ? (
            <TouchableOpacity onPress={() => router.push("/(customer)/bookings")}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {bookings.length === 0 ? (
          <View style={[styles.empty, shadow.card]}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1649769069590-268b0b994462?w=400&q=80",
              }}
              style={styles.emptyImg}
            />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySub}>Pick a service above to get started</Text>
          </View>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(it) => it.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`recent-booking-${item.id}`}
                onPress={() => router.push({ pathname: "/booking/[id]", params: { id: item.id } })}
                style={[styles.bookCard, shadow.card]}
                activeOpacity={0.9}
              >
                <View style={styles.bookIcon}>
                  <Ionicons
                    name={(CATEGORY_ICON[item.category_icon] || "construct") as any}
                    color={colors.brand}
                    size={20}
                  />
                </View>
                <Text style={styles.bookTitle} numberOfLines={1}>
                  {item.category_name}
                </Text>
                <Text style={styles.bookAddr} numberOfLines={1}>
                  {item.address}
                </Text>
                <StatusPill status={item.status} />
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  locWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    maxWidth: "75%",
  },
  locLabel: { fontSize: 9, color: colors.textFaint, fontWeight: "800", letterSpacing: 1 },
  locCity: { fontSize: 13, color: colors.text, fontWeight: "700", maxWidth: 160 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  hi: { paddingHorizontal: spacing.lg, fontSize: 22, fontWeight: "800", color: colors.text, marginTop: spacing.md },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg - 4,
    gap: 0,
  },
  cat: {
    width: "31%",
    marginHorizontal: "1.16%",
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  catIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  catName: { fontSize: 12, fontWeight: "700", color: colors.text, textAlign: "center", paddingHorizontal: 4 },

  recentHead: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seeAll: { color: colors.brand, fontWeight: "700", fontSize: 13 },

  empty: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    gap: 8,
  },
  emptyImg: { width: 90, height: 90, borderRadius: radius.lg, marginBottom: 6 },
  emptyTitle: { fontWeight: "800", color: colors.text, fontSize: 15 },
  emptySub: { fontSize: 12, color: colors.textMuted },

  bookCard: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: 6,
  },
  bookIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  bookTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  bookAddr: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
});
