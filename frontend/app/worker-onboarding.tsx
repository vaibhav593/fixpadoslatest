import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
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

async function pickFromLibrary(): Promise<string | null> {
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

async function captureFromCamera(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.5,
    base64: true,
    cameraType: ImagePicker.CameraType.front,
  });
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  return `data:image/jpeg;base64,${res.assets[0].base64}`;
}

const EXPERIENCE_OPTIONS = ["0-1 years", "1-3 years", "3-5 years", "5+ years"];

export default function WorkerOnboarding() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // Basic details
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");

  // Address
  const [fullAddress, setFullAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");

  // Work details
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [experience, setExperience] = useState("");

  // Verification documents
  const [photo, setPhoto] = useState<string>("");
  const [liveSelfie, setLiveSelfie] = useState<string>("");
  const [aadhaarFront, setAadhaarFront] = useState<string>("");
  const [aadhaarBack, setAadhaarBack] = useState<string>("");
  const [skillCert, setSkillCert] = useState<string>("");

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCachedUser();
      setUser(u);
      if (u) {
        setName(u.name || "");
        setMobile(u.mobile || "");
        setEmail((u as any).email || "");
        setFullAddress((u as any).full_address || "");
        setCity((u as any).city || "");
        setStateName((u as any).state || "");
        setPincode((u as any).pincode || "");
        setExperience((u as any).experience || "");
        setPhoto(u.photo || "");
        setLiveSelfie((u as any).live_selfie || "");
        setSelectedCats((u.categories || []) as string[]);
        setAadhaarFront((u as any).kyc_docs?.aadhaar_front || "");
        setAadhaarBack((u as any).kyc_docs?.aadhaar_back || "");
        setSkillCert((u as any).kyc_docs?.skill_certificate || "");
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
    if (!name.trim()) return setErr("Enter your full name");
    if (!email.includes("@")) return setErr("Enter a valid email");
    if (!fullAddress.trim()) return setErr("Enter your full address");
    if (!city.trim()) return setErr("Enter your city");
    if (!stateName.trim()) return setErr("Enter your state");
    if (!/^\d{6}$/.test(pincode.trim())) return setErr("Pincode must be 6 digits");
    if (selectedCats.length === 0) return setErr("Select at least one service category");
    if (!experience) return setErr("Select your experience");
    if (!photo) return setErr("Upload a profile photo");
    if (!liveSelfie) return setErr("Capture a live selfie");
    if (!aadhaarFront) return setErr("Upload Aadhaar front");
    if (!aadhaarBack) return setErr("Upload Aadhaar back");

    setLoading(true);
    try {
      if (name.trim() !== user?.name) {
        await api.updateProfile({ name: name.trim() });
      }
      const u = await api.uploadKyc({
        email: email.trim(),
        full_address: fullAddress.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        experience,
        photo,
        live_selfie: liveSelfie,
        aadhaar_front: aadhaarFront,
        aadhaar_back: aadhaarBack,
        skill_certificate: skillCert,
        categories: selectedCats,
      });
      await setCachedUser(u as any);
      // Submitted → verification pending page.
      router.replace("/worker-pending");
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
    testID,
    optional,
    hint,
  }: {
    label: string;
    value: string;
    onPick: () => void;
    testID: string;
    optional?: boolean;
    hint?: string;
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
          {hint ? <Text style={styles.docOptional}>{hint}</Text> : null}
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

  const status = user?.kyc_status;

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]} testID="worker-onboarding-screen">
      <View style={styles.head}>
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          Fill every section — you cannot receive jobs without admin approval.
        </Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.lg }}
        bottomOffset={90}
      >
        {status === "submitted" ? (
          <Toast type="info" message="Your profile is under review by admin." />
        ) : null}
        {status === "rejected" ? (
          <Toast type="error" message={`Rejected: ${user?.rejection_reason || "Please re-submit"}`} />
        ) : null}

        {/* ── Basic Details ────────────────────────── */}
        <SectionTitle icon="person" title="Basic Details" />
        <View style={styles.card}>
          <LabeledInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rajesh Kumar"
            testID="worker-name-input"
          />
          <LabeledInput
            label="Mobile Number"
            value={mobile}
            editable={false}
            placeholder=""
            testID="worker-mobile-input"
          />
          <LabeledInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="worker-email-input"
          />
        </View>

        {/* ── Address ─────────────────────────────── */}
        <SectionTitle icon="location" title="Address" />
        <View style={styles.card}>
          <LabeledInput
            label="Full Address"
            value={fullAddress}
            onChangeText={setFullAddress}
            placeholder="House / Street / Area"
            multiline
            testID="worker-address-input"
          />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <LabeledInput
                label="City"
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Mumbai"
                testID="worker-city-input"
              />
            </View>
            <View style={{ flex: 1 }}>
              <LabeledInput
                label="State"
                value={stateName}
                onChangeText={setStateName}
                placeholder="e.g. Maharashtra"
                testID="worker-state-input"
              />
            </View>
          </View>
          <LabeledInput
            label="Pincode"
            value={pincode}
            onChangeText={(t) => setPincode(t.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit pincode"
            keyboardType="number-pad"
            maxLength={6}
            testID="worker-pincode-input"
          />
        </View>

        {/* ── Work Details ────────────────────────── */}
        <SectionTitle icon="briefcase" title="Work Details" />
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Service Category</Text>
          <Text style={styles.hint}>Select all you can service</Text>
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

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Experience</Text>
          <View style={styles.chipsWrap}>
            {EXPERIENCE_OPTIONS.map((exp) => {
              const active = experience === exp;
              return (
                <TouchableOpacity
                  key={exp}
                  testID={`worker-exp-${exp}`}
                  onPress={() => setExperience(exp)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipTxt, active && { color: "#fff" }]}>{exp}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Verification ───────────────────────── */}
        <SectionTitle icon="shield-checkmark" title="Verification (Mandatory)" />
        <View style={[styles.card, { gap: spacing.md }]}>
          <Doc
            testID="worker-photo-picker"
            label="Profile Photo"
            value={photo}
            hint="Tap to upload"
            onPick={async () => {
              const p = await pickFromLibrary();
              if (p) setPhoto(p);
            }}
          />
          <Doc
            testID="worker-live-selfie-picker"
            label="Live Selfie (Camera)"
            value={liveSelfie}
            hint="Tap to open camera"
            onPick={async () => {
              const p = await captureFromCamera();
              if (p) setLiveSelfie(p);
            }}
          />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Doc
                testID="aadhaar-front-picker"
                label="Aadhaar Front"
                value={aadhaarFront}
                onPick={async () => {
                  const p = await pickFromLibrary();
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
                  const p = await pickFromLibrary();
                  if (p) setAadhaarBack(p);
                }}
              />
            </View>
          </View>
          <Doc
            testID="skill-cert-picker"
            label="Skill Certificate"
            value={skillCert}
            optional
            onPick={async () => {
              const p = await pickFromLibrary();
              if (p) setSkillCert(p);
            }}
          />
        </View>

        {err ? <Toast type="error" message={err} /> : null}
      </KeyboardAwareScrollView>

      <View style={[styles.cta, shadow.pop]}>
        <Button
          testID="submit-kyc-button"
          label="Submit for Verification"
          icon="cloud-upload"
          onPress={submit}
          loading={loading}
        />
      </View>
    </SafeAreaView>
  );
}

function SectionTitle({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} color={colors.brand} size={16} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function LabeledInput({
  label,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder: string;
  testID: string;
  keyboardType?: any;
  autoCapitalize?: any;
  maxLength?: number;
  editable?: boolean;
  multiline?: boolean;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textFaint}
        style={[
          styles.input,
          rest.multiline && { minHeight: 64, textAlignVertical: "top" },
          rest.editable === false && { color: colors.textMuted, backgroundColor: colors.borderSoft },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  head: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4, fontSize: 13 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  sectionIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.brandLight,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text, letterSpacing: 0.3 },

  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },

  fieldLabel: {
    fontSize: 12, fontWeight: "800", color: colors.textMuted,
    letterSpacing: 0.6, marginBottom: 4,
  },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
  },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
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
