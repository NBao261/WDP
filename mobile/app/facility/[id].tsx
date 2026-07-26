import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Alert, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Colors, Typography, Spacing, BorderRadius, Shadows,
} from "../../src/constants/theme";
import { api, vehicleApi } from "../../src/services/api";
import { Facility, PricingPlan, AvailableSlot } from "../../src/types/facility.types";

const getVehicleIcon = (code?: string): keyof typeof Ionicons.glyphMap => {
  if (!code) return "bicycle";
  const u = code.toUpperCase();
  if (u.includes("CAR")) return "car-sport";
  if (u.includes("BUS")) return "bus";
  if (u.includes("TRUCK")) return "car";
  if (u.includes("MOTO")) return "bicycle";
  return "bicycle";
};

export default function FacilityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [pricing, setPricing] = useState<PricingPlan[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [defaultVehicleTypeId, setDefaultVehicleTypeId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const facilitiesList = await api.getPublicFacilities(1, 100);
      const found = facilitiesList.find((f: Facility) => f._id === id);
      if (found) setFacility(found);
      const [pricingData, slotsData] = await Promise.all([
        api.getPublicPricing(id),
        api.getAvailableSlots(id),
      ]);
      setPricing(pricingData);
      setSlots(slotsData);

      // Fetch user's default vehicle to sort pricing
      try {
        const vRes: any = await vehicleApi.getMyVehicles();
        if (vRes.success && vRes.data) {
          const defaultV = vRes.data.find((v: any) => v.isDefault);
          if (defaultV) {
            const typeId = defaultV.vehicleTypeId?._id || defaultV.vehicleTypeId;
            setDefaultVehicleTypeId(typeId);
          }
        }
      } catch {}
    } catch {
      Alert.alert("Lỗi", "Không thể tải thông tin bãi xe.");
    }
  };

  useEffect(() => {
    if (id) { setLoading(true); loadData().finally(() => setLoading(false)); }
  }, [id]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const isActive = facility?.status === 'active';

  const isOpen = (() => {
    if (!isActive) return false;
    const open = (facility as any).openTime as string | undefined;
    const close = (facility as any).closeTime as string | undefined;
    if (!open || !close) return true;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = open.split(':').map(Number);
    const [closeH, closeM] = close.split(':').map(Number);
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;
    if (closeMins <= openMins) return nowMins >= openMins || nowMins < closeMins;
    return nowMins >= openMins && nowMins < closeMins;
  })();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.brandDark} />
        <Text style={styles.loadingText}>Đang tải thông tin...</Text>
      </View>
    );
  }

  if (!facility) {
    return (
      <View style={styles.center}>
        <Ionicons name="business-outline" size={48} color={Colors.brandGrayText} />
        <Text style={styles.errorText}>Không tìm thấy bãi xe</Text>
      </View>
    );
  }

  const totalAvail = slots.reduce((s, sl) => s + sl.availableCount, 0);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        {/* ── White header: ← Facility Details 🔗 ── */}
        <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.white }}>
          <View style={styles.headerBar}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color={Colors.brandDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chi tiết bãi xe</Text>
            <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={16} color={Colors.brandDark} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* ── Scrollable Content ── */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brandDark} />}
        >
          {/* Name + Status */}
          <View style={styles.nameSection}>
            <View style={styles.nameRow}>
              <Text style={styles.facilityName}>{facility.name}</Text>
              <View style={[styles.statusPill, { backgroundColor: isOpen ? 'rgba(164,255,7,0.2)' : Colors.brandGray }]}>
                <Text style={[styles.statusText, { color: isOpen ? '#304f00' : Colors.brandGrayText }]}>
                  {isOpen ? 'Đang mở cửa' : 'Đóng cửa'}
                </Text>
              </View>
            </View>
            <Text style={styles.facilityAddress}>{facility.address}</Text>
          </View>

          {/* Address & Hours — gray info card */}
          <View style={styles.infoCard}>
            {/* Address row */}
            <View style={styles.infoRow}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="location" size={16} color={Colors.brandDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Địa chỉ</Text>
                <Text style={styles.infoValue}>{facility.address}</Text>
              </View>
            </View>
            <View style={styles.infoDivider} />
            {/* Hours row */}
            <View style={styles.infoRow}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="time" size={16} color={Colors.brandDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Giờ hoạt động</Text>
                <Text style={styles.infoValue}>
                  {(facility as any).openTime || "06:00"} – {(facility as any).closeTime || "22:00"}
                </Text>
              </View>
            </View>
          </View>

          {/* Available Slots */}
          <Text style={styles.sectionTitle}>Chỗ trống hiện tại</Text>
          {slots.length === 0 ? (
            <View style={styles.emptySlots}>
              <Text style={styles.emptyText}>Chưa có thông tin chỗ trống</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotsRow}>
              {[...slots].sort((a, b) => {
                if (!defaultVehicleTypeId) return 0;
                if (a.vehicleTypeId === defaultVehicleTypeId) return -1;
                if (b.vehicleTypeId === defaultVehicleTypeId) return 1;
                return 0;
              }).map((slot) => {
                const avail = slot.availableCount;
                const isDefault = slot.vehicleTypeId === defaultVehicleTypeId;
                return (
                  <View
                    key={slot.vehicleTypeId}
                    style={[styles.slotChip, isDefault && styles.slotChipActive]}
                  >
                    <Ionicons name={getVehicleIcon(slot.vehicleTypeCode)} size={14} color={Colors.brandDark} />
                    <Text style={styles.slotChipLabel}>{slot.vehicleTypeName}</Text>
                    <View style={[styles.slotCountBadge, isDefault && styles.slotCountBadgeActive]}>
                      <Text style={[styles.slotCountText, isDefault && styles.slotCountTextActive]}>
                        {avail}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Pricing */}
          <Text style={styles.sectionTitle}>Bảng giá</Text>
          {pricing.length === 0 ? (
            <View style={styles.emptySlots}>
              <Text style={styles.emptyText}>Chưa có bảng giá</Text>
            </View>
          ) : (
            <View style={styles.pricingList}>
              {[...pricing].sort((a, b) => {
                if (!defaultVehicleTypeId) return 0;
                const aId = a.vehicleTypeId?._id || '';
                const bId = b.vehicleTypeId?._id || '';
                if (aId === defaultVehicleTypeId) return -1;
                if (bId === defaultVehicleTypeId) return 1;
                return 0;
              }).map((plan) => (
                <View key={plan._id} style={styles.pricingRow}>
                  <View style={styles.pricingRowLeft}>
                    <View style={styles.pricingIconCircle}>
                      <Ionicons name={getVehicleIcon(plan.vehicleTypeId?.code)} size={16} color={Colors.brandDark} />
                    </View>
                    <Text style={styles.pricingVehicleName}>
                      {plan.vehicleTypeId?.name || plan.name}
                    </Text>
                  </View>
                  <View style={styles.pricingRowRight}>
                    {plan.rates?.map((rate, i) => (
                      <Text key={i} style={styles.pricingAmount}>
                        {rate.amount.toLocaleString("vi-VN")}đ
                        <Text style={styles.pricingUnit}> / {rate.unit}</Text>
                      </Text>
                    ))}
                    {plan.overnightFee > 0 && (
                      <Text style={styles.pricingOvernight}>
                        Qua đêm: {plan.overnightFee.toLocaleString("vi-VN")}đ
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Sticky Bottom CTA — Lime like reference ── */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBtnRow}>
            <TouchableOpacity
              style={styles.directionsBtn}
              onPress={() => {
                const coords = facility.location?.coordinates;
                const lng = coords?.[0] ?? 0;
                const lat = coords?.[1] ?? 0;
                router.push({
                  pathname: '/navigation/[facilityId]',
                  params: {
                    facilityId: id,
                    lat: String(lat),
                    lng: String(lng),
                    name: facility.name,
                  },
                } as any);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={16} color={Colors.brandDark} />
              <Text style={styles.directionsBtnText}>Chỉ đường</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bookBtn, !isActive && styles.bookBtnDisabled]}
              onPress={() => isActive ? router.push(`/facility/${id}/book`) : null}
              activeOpacity={0.85}
            >
              <Text style={[styles.bookBtnText, !isActive && styles.bookBtnTextDisabled]}>
                {isActive ? "Đặt chỗ ngay" : "Ngừng hoạt động"}
              </Text>
              {isActive && <Ionicons name="arrow-forward" size={16} color={Colors.brandDark} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  /* ── Header bar ── */
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandGray,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },

  /* ── Content ── */
  content: { padding: 20 },

  /* ── Name + Status ── */
  nameSection: { marginBottom: 20 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  facilityName: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    flex: 1,
  },
  statusPill: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  facilityAddress: {
    fontSize: 12,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.semiBold,
  },

  /* ── Info card — gray rounded ── */
  infoCard: {
    backgroundColor: Colors.brandGray,
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
    gap: 0,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 2,
  },
  infoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 10,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.brandDark,
    fontFamily: Typography.fontFamily.bold,
    marginTop: 2,
    lineHeight: 18,
  },
  infoDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginVertical: 12,
  },

  /* ── Section title ── */
  sectionTitle: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    marginBottom: 12,
  },

  /* ── Slot chips — horizontal scroll ── */
  slotsRow: { gap: 10, paddingBottom: 4, marginBottom: 24 },
  slotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.brandGray,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "transparent",
  },
  slotChipActive: {
    backgroundColor: Colors.brandLime,
    borderColor: Colors.brandLime,
  },
  slotChipLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  slotCountBadge: {
    backgroundColor: Colors.white,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  slotCountBadgeActive: {
    backgroundColor: Colors.brandDark,
  },
  slotCountText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  slotCountTextActive: {
    color: Colors.white,
  },
  emptySlots: {
    backgroundColor: Colors.brandGray,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  emptyText: {
    color: Colors.brandGrayText,
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },

  /* ── Pricing rows ── */
  pricingList: { marginBottom: 20 },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandGray,
  },
  pricingRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pricingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
  },
  pricingVehicleName: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.brandDark,
  },
  pricingRowRight: {
    alignItems: "flex-end",
  },
  pricingAmount: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  pricingUnit: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.brandGrayText,
  },
  pricingOvernight: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.warning,
    marginTop: 2,
  },

  /* ── Bottom CTA — Lime pill like reference ── */
  bottomBar: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.brandGray,
  },
  bottomBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.brandGray,
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  directionsBtnText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  bookBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.brandLime,
    borderRadius: 9999,
    paddingVertical: 16,
    ...Shadows.sm,
  },
  bookBtnDisabled: {
    backgroundColor: Colors.brandGray,
  },
  bookBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  bookBtnTextDisabled: {
    color: Colors.brandGrayText,
  },

  /* ── States ── */
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: Colors.white },
  loadingText: { fontSize: 13, color: Colors.brandGrayText, fontFamily: Typography.fontFamily.medium },
  errorText: { fontSize: 15, color: Colors.brandGrayText, fontFamily: Typography.fontFamily.medium },
});
