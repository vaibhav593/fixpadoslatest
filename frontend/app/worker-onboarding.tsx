import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { Toast } from "@/src/components/Toast";
import { api, getCachedUser, setCachedUser } from "@/src/api";
import { colors, radius, shadow, spacing } from "@/src/theme";

async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.5,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${res.assets[0].base64}`;
}

export default function WorkerOnboarding() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [photo, setPhoto] = useState<string>("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [aadhaarFront, setAadhaarFront] = useState<string>("");
  const [aadhaarBack, setAadhaarBack] = useState<string>("");
  const [skillCert, setSkillCert] = useState<string>("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCachedUser();
      setUser(u);
      if (u) {
        setName(u.name || "");
        setPhoto(u.photo || "");
        setSelectedCats(u.categories || []);
      }
      try {
        setCategories(await api.listCategories(true));
      } catch {}
    })();
  }, []);

  const toggleCat = (id: string) => {
    setSelectedCats((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const submit = async () => {
    setErr("");
    if (!name.trim()) return setErr("Enter your name");
    if (selectedCats.length === 0) return setErr("Select at least one skill / category");
    if (!aadhaarFront) return setErr("Upload Aadhaar front");
    if (!aadhaarBack) return setErr("Upload Aadhaar back");
    setLoading(true);
    try {
      if (name !== user?.name) {
        await api.updateProfile({ name });
      }
      const u = await api.uploadKyc({
        photo,
        categories: selectedCats,
        aadhaar_front: aadhaarFront,
        aadhaar_back: aadhaarBack,
        skill_certificate: skillCert,
      });
      await setCachedUser(u);
      router.replace("/(worker)/jobs");
    } catch (e: any) {
      setErr(e.message || "Could not submit");
    } finally {
      setLoading(false);
    }
  };

  const Doc = ({
    label,
    value,
    onPick,
    optional,
    testID,
  }: {
    label: string;
    value: string;
    onPick: () => void;
    optional?: boolean;
    testID: string;
  }) => (
    <TouchableOpacity
      testID={testID}
      onPress={onPick}
      activeOpacity={0.9}
      style={[styles.docBox, shadow.card, value && styles.docBoxFilled]}
    >
      {value ? (
        <Image source={{ uri: value }} style={styles.docPreview} />
      ) : (
        <View style={styles.docPlaceholder}>
          <Ionicons name="cloud-upload" color={colors.brand} size={26} />
          <Text style={styles.docLabel}>{label}</Text>
          {optional ? <Text style={styles.docOptional}>(optional)</Text> : null}
        </View>
      )}
      {value ? (
        <View style={styles.docOverlay}>
          <Ionicons name="checkmark-circle" color={colors.success} size={20} />
          <Text style={styles.docOverlayTxt}>{label}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  // KYC status banner
  const status = user?.kyc_status;

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <Text style={styles.title}>Worker Verification</Text>
        <Text style={styles.subtitle}>Complete your profile to start receiving jobs</Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.lg }}
        bottomOffset={90}
      >
        {status === "submitted" ? (
          <Toast type="info" message="Your KYC is under review by admin. You'll be notified shortly." />
        ) : null}
        {status === "rejected" ? (
          <Toast type="error" message={`KYC rejected: ${user?.rejection_reason || "Please re-submit"}`} />
        ) : null}
        {status === "approved" ? (
          <Toast type="success" message="You're verified ✓ — update info if needed" />
        ) : null}

        {/* Photo */}
        <View style={[styles.card, shadow.card, { alignItems: "center" }]}>
          <TouchableOpacity
            testID="worker-photo-picker"
            onPress={async () => {
              const p = await pickImage();
              if (p) setPhoto(p);
            }}
            style={styles.photoWrap}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <Ionicons name="camera" color={colors.brand} size={36} />
            )}
          </TouchableOpacity>
          <Text style={styles.photoLabel}>Profile Photo</Text>
        </View>

        {/* Name */}
        <View>
          <Text style={styles.label}>Name</Text>
          <TextInput
            testID="worker-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>

        {/* Categories */}
        <View>
          <Text style={styles.label}>Skills / Categories</Text>
          <Text style={styles.hint}>Select all that apply</Text>
          <View style={styles.chipsWrap}>
            {categories.map((c) => {
              const active = selectedCats.includes(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  testID={`worker-cat-${c.name.toLowerCase().replace(/\s/g, "-")}`}
                  onPress={() => toggleCat(c.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  {active ? <Ionicons name="checkmark" color="#fff" size={14} /> : null}
                  <Text style={[styles.chipTxt, active && { color: "#fff" }]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Documents */}
        <View>
          <Text style={styles.label}>Identity Documents</Text>
          <Text style={styles.hint}>Aadhaar card (front + back) is mandatory</Text>
          <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Doc
                testID="aadhaar-front-picker"
                label="Aadhaar Front"
                value={aadhaarFront}
                onPick={async () => {
                  const p = await pickImage();
                  if (p) setAadhaarFront(p);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Doc
                testID="aadhaar-back-picker"
                label="Aadhaar Back"
                value={aadhaarBack}
                onPick={async () => {
                  const p = await pickImage();
                  if (p) setAadhaarBack(p);
                }}
              />
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Doc
              testID="skill-cert-picker"
              label="Skill Certificate"
              value={skillCert}
              optional
              onPick={async () => {
                const p = await pickImage();
                if (p) setSkillCert(p);
              }}
            />
          </View>
        </View>

        {err ? <Toast type="error" message={err} /> : null}
      </KeyboardAwareScrollView>

      <View style={[styles.cta, shadow.pop]}>
        <Button
          testID="submit-kyc-button"
          label={status === "approved" ? "Update Profile" : "Submit for Verification"}
          icon="cloud-upload"
          onPress={submit}
          loading={loading}
        />
        {status === "approved" ? (
          <TouchableOpacity
            testID="skip-onboarding"
            onPress={() => router.replace("/(worker)/jobs")}
            style={{ marginTop: spacing.sm }}
          >
            <Text style={{ textAlign: "center", color: colors.textMuted, fontWeight: "600" }}>Skip</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4, fontSize: 13 },

  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg },

  photoWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  photoLabel: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },

  label: { fontSize: 12, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.6, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 14, color: colors.text },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipTxt: { fontWeight: "700", color: colors.text, fontSize: 13 },

  docBox: {
    minHeight: 110,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  docBoxFilled: { borderColor: colors.success, borderStyle: "solid" },
  docPreview: { width: "100%", height: "100%", minHeight: 110 },
  docPlaceholder: { padding: spacing.lg, alignItems: "center", gap: 4 },
  docLabel: { fontWeight: "700", color: colors.text, fontSize: 13, marginTop: 4 },
  docOptional: { color: colors.textMuted, fontSize: 11 },
  docOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  docOverlayTxt: { fontSize: 11, fontWeight: "700", color: colors.success },

  cta: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: spacing.lg, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
});
