import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { colors, radius, shadow, spacing } from "@/src/theme";

// Rough per-character width for a 700-weight sans-serif at 1px font size.
const CHAR_UNIT = 0.55;
const LONGEST_LINE_CHARS = "Reliable Local Services".length; // 23

export function HeroBanner({ banner }: { banner?: any }) {
  const { width } = useWindowDimensions();
  const subtitle = banner?.subtitle || "Fast. Trusted. Verified.";
  const image =
    banner?.image ||
    "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=400&q=80";

  // Available width for text: screen − outer margin (2 × 16) − banner padding (2 × 24)
  // − left column gap (12) − image column (127).
  const textWidth = Math.max(120, width - 32 - 48 - 12 - 127);
  // Fit "Reliable Local Services" on one line. Cap at spec (28), floor at 18.
  const fittedSize = Math.floor(textWidth / (LONGEST_LINE_CHARS * CHAR_UNIT));
  // On native, `adjustsFontSizeToFit` handles shrinking → keep exact 28 spec.
  // On web (RN Web ignores that prop), pre-shrink so lines don't wrap.
  const titleSize = Platform.OS === "web" ? Math.min(28, Math.max(14, fittedSize)) : 28;
  const lineHeight = Math.round(titleSize * 1.2);

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
          <Text
            testID="hero-title-line-1"
            style={[styles.title, { fontSize: titleSize, lineHeight }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            allowFontScaling={false}
          >
            Reliable Local Services
          </Text>
          <Text
            testID="hero-title-line-2"
            style={[styles.title, { fontSize: titleSize, lineHeight }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            allowFontScaling={false}
          >
            At Your Doorstep
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.right}>
          <Image
            source={{ uri: image }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    height: 240,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  left: {
    flex: 6,
    justifyContent: "center",
    paddingRight: spacing.md,
  },
  right: {
    flex: 4,
    alignItems: "center",
    justifyContent: "center",
  },
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
  pillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  title: {
    color: "#fff",
    fontWeight: "700",
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 12,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  image: {
    width: 127,
    height: 161,
    borderRadius: radius.xl,
  },
});
