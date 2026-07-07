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
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${res.assets[0].base64}`;
}

export default function AdminBanners() {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [image, setImage] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.listBanners()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    setErr("");
    if (!title.trim()) return setErr("Enter title");
    try {
      await api.createBanner({ title, subtitle, image, active: true });
      setTitle(""); setSubtitle(""); setImage("");
      load();
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  };

  const toggle = async (b: any) => {
    await api.updateBanner(b.id, { title: b.title, subtitle: b.subtitle || "", image: b.image || "", active: !b.active }).catch(() => {});
    load();
  };

  const remove = async (id: string) => {
    await api.deleteBanner(id).catch(() => {});
    load();
  };

  return (
    <AdminShell title="Banners">
      <View style={adminStyles.card}>
        <Text style={adminStyles.sectionTitle}>Create Banner</Text>
        <TextInput testID="banner-title-input" value={title} onChangeText={setTitle} placeholder="Title (multi-line ok)" placeholderTextColor={colors.textFaint} multiline style={[adminStyles.input, { minHeight: 60 }]} />
        <TextInput testID="banner-subtitle-input" value={subtitle} onChangeText={setSubtitle} placeholder="Subtitle" placeholderTextColor={colors.textFaint} style={adminStyles.input} />
        <TouchableOpacity testID="banner-image-pick" onPress={async () => { const p = await pickImage(); if (p) setImage(p); }} style={styles.uploadBtn}>
          <Ionicons name="image" color={colors.brand} size={16} />
          <Text style={{ color: colors.brand, fontWeight: "700", fontSize: 13 }}>{image ? "Replace image" : "Upload banner image"}</Text>
        </TouchableOpacity>
        {image ? <Image source={{ uri: image }} style={styles.preview} /> : null}
        {err ? <Toast type="error" message={err} /> : null}
        <Button testID="add-banner-button" label="Create Banner" icon="add-circle" onPress={add} />
      </View>

      <View style={adminStyles.card}>
        <Text style={adminStyles.sectionTitle}>All Banners ({items.length})</Text>
        {items.length === 0 ? <Text style={{ color: colors.textMuted }}>No banners yet.</Text> : null}
        {items.map((b) => (
          <View key={b.id} testID={`banner-row-${b.id}`} style={styles.row}>
            {b.image ? <Image source={{ uri: b.image }} style={styles.thumb} /> : (
              <View style={[styles.thumb, { backgroundColor: colors.brandLight }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={2}>{b.title}</Text>
              <Text style={styles.muted} numberOfLines={1}>{b.subtitle}</Text>
            </View>
            <Switch testID={`banner-toggle-${b.id}`} value={b.active} onValueChange={() => toggle(b)} trackColor={{ true: colors.brand, false: colors.border }} />
            <TouchableOpacity testID={`banner-delete-${b.id}`} onPress={() => remove(b.id)} style={{ marginLeft: spacing.sm }}>
              <Ionicons name="trash-outline" color={colors.danger} size={18} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  uploadBtn: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: colors.brandLight, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, alignSelf: "flex-start" },
  preview: { width: "100%", height: 120, borderRadius: radius.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  thumb: { width: 56, height: 40, borderRadius: radius.md },
  name: { fontWeight: "700", color: colors.text, fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
