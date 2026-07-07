import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, Text, View } from "react-native";

import { colors, radius, shadow, spacing } from "@/src/theme";

export function HeroBanner({ banner }: { banner?: any }) {
  const title = banner?.title || "Reliable Local Services At Your Doorstep";
  const subtitle = banner?.subtitle || "Fast. Trusted. Verified.";
  const image = banner?.image || "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=400&q=80";
  const titleLines = title.split("\n").length > 1 ? title.split("\n") : title.length > 28 ? [title.slice(0, title.length / 2), title.slice(title.length / 2)] : [title];
  return (
    <View testID="hero-banner" style={[styles.wrap, shadow.pop]}>
      <LinearGradient
        colors={[colors.gradStart, colors.gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.grad}
      >
        <View style={styles.left}>
          <View style={styles.pill}>
            <Ionicons name="shield-checkmark" size={12} color="#fff" />
            <Text style={styles.pillText}>Verified Pros</Text>
          </View>
          {titleLines.map((t: string, i: number) => (
            <Text key={i} style={styles.title} numberOfLines={2}>{t.trim()}</Text>
          ))}
          <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
        </View>
        <Image source={{ uri: image }} style={styles.image} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xxl,
    overflow: "hidden",
  },
  grad: {
    flexDirection: "row",
    padding: spacing.xl,
    minHeight: 180,
    alignItems: "center",
  },
  left: { flex: 1, paddingRight: spacing.sm },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 28 },
  subtitle: {
    marginTop: spacing.sm,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  image: {
    width: 110,
    height: 140,
    borderRadius: radius.xl,
    marginLeft: spacing.sm,
  },
});
