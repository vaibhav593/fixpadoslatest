// FixPados design tokens. Mirrors /app/design_guidelines.json (StyleSheet-friendly).
export const colors = {
  brand: "#2563EB",
  brandDark: "#1E3A8A",
  brandLight: "#DBEAFE",
  gradStart: "#1E3A8A",
  gradEnd: "#3B82F6",

  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  borderSoft: "#F1F5F9",
  text: "#0F172A",
  textMuted: "#64748B",
  textFaint: "#94A3B8",

  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",

  successBg: "#ECFDF5",
  warningBg: "#FFFBEB",
  dangerBg: "#FEF2F2",
  infoBg: "#EFF6FF",
};

// Worker dark palette — overrides surface tones while keeping brand colors.
export const workerColors = {
  ...colors,
  bg: "#0F172A",
  surface: "#1E293B",
  border: "#334155",
  borderSoft: "#293548",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  textFaint: "#64748B",
  brandLight: "rgba(37, 99, 235, 0.22)",
  successBg: "rgba(16, 185, 129, 0.18)",
  warningBg: "rgba(245, 158, 11, 0.18)",
  dangerBg: "rgba(239, 68, 68, 0.18)",
  infoBg: "rgba(59, 130, 246, 0.18)",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const shadow = {
  card: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pop: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  created: { label: "Booking Created", color: colors.info, bg: colors.infoBg },
  worker_assigned: { label: "Worker Assigned", color: colors.warning, bg: colors.warningBg },
  worker_accepted: { label: "Worker Accepted", color: colors.brand, bg: colors.brandLight },
  in_progress: { label: "In Progress", color: colors.warning, bg: colors.warningBg },
  completed: { label: "Completed", color: colors.success, bg: colors.successBg },
  cancelled: { label: "Cancelled", color: colors.danger, bg: colors.dangerBg },
};

export const TIME_SLOTS = [
  "10AM-12PM",
  "12PM-2PM",
  "2PM-4PM",
  "4PM-6PM",
];

export const CATEGORY_ICON: Record<string, string> = {
  zap: "flash",
  droplet: "water",
  hammer: "hammer",
  wind: "snow",
  sparkles: "sparkles",
  tool: "construct",
};
