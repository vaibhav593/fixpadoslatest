import { StyleSheet, Text, View } from "react-native";

import { STATUS_META, colors, radius } from "@/src/theme";

export function StatusPill({ status, testID }: { status: string; testID?: string }) {
  const meta = STATUS_META[status] || {
    label: status,
    color: colors.textMuted,
    bg: colors.borderSoft,
  };
  return (
    <View
      testID={testID || `status-${status}`}
      style={[styles.wrap, { backgroundColor: meta.bg }]}
    >
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.txt, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  txt: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
});
