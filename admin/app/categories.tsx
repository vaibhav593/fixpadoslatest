import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import { AdminShell, adminStyles } from "@/src/components/AdminShell";
import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${res.assets[0].base64}`;
}

const ICONS = ["zap", "droplet", "hammer", "wind", "sparkles", "tool"];

export default function AdminCategories() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("tool");
  const [iconImage, setIconImage] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.listCategories(false)); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    setErr("");
    if (!name.trim()) return setErr("Enter category name");
    try {
      await api.createCategory({ name: name.trim(), icon, icon_image: iconImage, active: true });
      setName(""); setIconImage("");
      load();
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  };

  const toggle = async (c: any) => {
    await api.updateCategory(c.id, { name: c.name, icon: c.icon, icon_image: c.icon_image || "", active: !c.active }).catch(() => {});
    load();
  };

  const remove = async (id: string) => {
    await api.deleteCategory(id).catch(() => {});
    load();
  };

  return (
    <AdminShell title="Categories">
      <View style={adminStyles.card}>
        <Text style={adminStyles.sectionTitle}>Add Category</Text>
        <TextInput testID="cat-name-input" value={name} onChangeText={setName} placeholder="Category name" placeholderTextColor={colors.textFaint} style={adminStyles.input} />
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {ICONS.map((ic) => (
            <TouchableOpacity key={ic} testID={`icon-${ic}`} onPress={() => setIcon(ic)} style={[styles.iconPill, icon === ic && styles.iconPillActive]}>
              <Text style={[styles.iconTxt, icon === ic && { color: "#fff" }]}>{ic}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity testID="cat-icon-pick" onPress={async () => { const p = await pickImage(); if (p) setIconImage(p); }} style={styles.uploadBtn}>
          <Ionicons name="image" color={colors.brand} size={16} />
          <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 13 }}>{iconImage ? "Replace icon image" : "Upload icon image (optional)"}</Text>
        </TouchableOpacity>
        {iconImage ? <Image source={{ uri: iconImage }} style={styles.iconPreview} /> : null}
        {err ? <Toast type="error" message={err} /> : null}
        <Button testID="add-cat-button" label="Add Category" icon="add-circle" onPress={add} />
      </View>

      <View style={adminStyles.card}>
        <Text style={adminStyles.sectionTitle}>All Categories ({items.length})</Text>
        {items.map((c) => (
          <View key={c.id} testID={`cat-row-${c.id}`} style={styles.row}>
            {c.icon_image ? (
              <Image source={{ uri: c.icon_image }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="construct" color={colors.brand} size={20} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.muted}>Icon: {c.icon}</Text>
            </View>
            <Switch testID={`cat-toggle-${c.id}`} value={c.active} onValueChange={() => toggle(c)} trackColor={{ true: colors.brand, false: colors.border }} />
            <TouchableOpacity testID={`cat-delete-${c.id}`} onPress={() => remove(c.id)} style={{ marginLeft: spacing.sm }}>
              <Ionicons name="trash-outline" color={colors.danger} size={18} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  iconPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  iconPillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  iconTxt: { color: colors.text, fontWeight: "600", fontSize: 12 },
  uploadBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: colors.brandLight, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, alignSelf: "flex-start" },
  iconPreview: { width: 64, height: 64, borderRadius: radius.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  thumb: { width: 40, height: 40, borderRadius: radius.md },
  name: { fontWeight: "700", color: colors.text, fontSize: 14 },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
