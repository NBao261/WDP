import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from "../../../src/constants/theme";
import { Loading } from "../../../src/components";
import { reservationApi, vehicleTypeApi, vehicleApi, api, sessionApi } from "../../../src/services/api";
import { AvailableSlot } from "../../../src/types/facility.types";

const getVehicleIcon = (name: string): any => {
  const n = (name || "").toLowerCase();
  if (n.includes("ô tô") || n.includes("car")) return "car-sport-outline";
  if (n.includes("xe tải") || n.includes("truck")) return "car-outline";
  return "bicycle-outline";
};

interface UserVehicle {
  _id: string;
  licensePlate: string;
  nickname?: string;
  image?: string;
  isDefault: boolean;
  vehicleTypeId: {
    _id: string;
    name: string;
    code: string;
  } | string | null;
}

export default function BookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const facilityId = typeof id === "string" ? id : id?.[0] || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [facilityName, setFacilityName] = useState("");
  const [facilityOpenTime, setFacilityOpenTime] = useState<string>("06:00");
  const [facilityCloseTime, setFacilityCloseTime] = useState<string>("22:00");

  // Vehicle selection
  const [userVehicles, setUserVehicles] = useState<UserVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("");
  const [licensePlate, setLicensePlate] = useState("");
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [existingReservations, setExistingReservations] = useState<any[]>([]);

  const [startTime, setStartTime] = useState(
    new Date(Date.now() + 35 * 60 * 1000),
  );
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"date" | "time">("date");

  useEffect(() => {
    fetchInitialData();
  }, [facilityId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [vtRes, slotRes, facilityData, vehiclesRes, sessionsRes, reservRes] = await Promise.all<any>([
        vehicleTypeApi.getVehicleTypes(),
        api.getAvailableSlots(facilityId),
        api.getPublicFacilityById(facilityId),
        vehicleApi.getMyVehicles(),
        sessionApi.getMySessions('active'),
        reservationApi.getReservations(),
      ]);

      const slots: AvailableSlot[] = slotRes || [];
      setAvailableSlots(slots);

      if (vtRes.success) {
        const supportedIds = new Set(slots.map((s) => s.vehicleTypeId));
        const supported = (vtRes.data as any[]).filter((vt) => supportedIds.has(vt._id));
        setVehicleTypes(supported);
        if (supported.length > 0) setSelectedVehicleType(supported[0]._id);
      }

      if (facilityData) {
        setFacilityName(facilityData.name);
        setFacilityOpenTime(facilityData.openTime || "06:00");
        setFacilityCloseTime(facilityData.closeTime || "22:00");
      }

      // Load active sessions
      if (sessionsRes.success && sessionsRes.data) {
        setActiveSessions(sessionsRes.data);
      }

      // Load existing pending/confirmed reservations to check duplicates
      if (reservRes.success && reservRes.data) {
        setExistingReservations(
          reservRes.data.filter((r: any) => ['pending', 'confirmed'].includes(r.status))
        );
      }

      // Load user's vehicles
      if (vehiclesRes.success && vehiclesRes.data) {
        const vehicles: UserVehicle[] = vehiclesRes.data;
        setUserVehicles(vehicles);

        // Auto-select default vehicle
        const defaultV = vehicles.find((v) => v.isDefault);
        if (defaultV) {
          selectVehicle(defaultV, slots);
        } else if (vehicles.length > 0) {
          selectVehicle(vehicles[0], slots);
        }
      }
    } catch {
      Alert.alert("Lỗi", "Không thể tải dữ liệu, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const selectVehicle = (vehicle: UserVehicle, slots?: AvailableSlot[]) => {
    setSelectedVehicleId(vehicle._id);
    setLicensePlate(vehicle.licensePlate);
    const typeId = !vehicle.vehicleTypeId
      ? ''
      : typeof vehicle.vehicleTypeId === 'string'
        ? vehicle.vehicleTypeId
        : vehicle.vehicleTypeId._id;
    setSelectedVehicleType(typeId);
  };

  const getVehicleTypeId = (vehicle: UserVehicle): string => {
    if (!vehicle.vehicleTypeId) return '';
    return typeof vehicle.vehicleTypeId === 'string'
      ? vehicle.vehicleTypeId
      : vehicle.vehicleTypeId._id;
  };

  const getVehicleTypeName = (vehicle: UserVehicle): string => {
    if (!vehicle.vehicleTypeId || typeof vehicle.vehicleTypeId === 'string') return '';
    return vehicle.vehicleTypeId.name;
  };

  // Filter vehicles by selected vehicle type
  const filteredVehicles = userVehicles.filter((v) => {
    return getVehicleTypeId(v) === selectedVehicleType;
  });

  const handleBook = async () => {
    if (!selectedVehicleId) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn xe để đặt chỗ.");
      return;
    }
    if (startTime.getTime() - Date.now() < 5 * 60 * 1000) {
      Alert.alert("Thời gian không hợp lệ", "Phải đặt trước ít nhất 5 phút.");
      return;
    }

    const startH = startTime.getHours();
    const startM = startTime.getMinutes();
    const startMins = startH * 60 + startM;

    const [openH, openM] = facilityOpenTime.split(':').map(Number);
    const [closeH, closeM] = facilityCloseTime.split(':').map(Number);
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;

    let isWithinOpenHours = false;
    if (closeMins <= openMins) {
      isWithinOpenHours = startMins >= openMins || startMins < closeMins;
    } else {
      isWithinOpenHours = startMins >= openMins && startMins < closeMins;
    }

    if (!isWithinOpenHours) {
      Alert.alert(
        "Ngoài giờ hoạt động",
        `Bãi xe chỉ mở cửa từ ${facilityOpenTime} đến ${facilityCloseTime}. Vui lòng chọn thời gian khác.`
      );
      return;
    }

    const isCurrentlyParked = activeSessions.some(
      (s) =>
        s.licensePlate === licensePlate &&
        (s.facilityId?._id === facilityId || s.facilityId === facilityId)
    );

    // Check for existing pending/confirmed reservation with same plate at same facility
    const hasDuplicateReservation = existingReservations.some(
      (r) =>
        r.licensePlate === licensePlate &&
        (r.facilityId?._id === facilityId || r.facilityId === facilityId)
    );

    if (hasDuplicateReservation) {
      Alert.alert(
        "Đã có đặt chỗ",
        `Biển số ${licensePlate} đã có đặt chỗ đang chờ/xác nhận tại bãi này. Vui lòng hủy đặt chỗ cũ trước.`
      );
      return;
    }

    if (isCurrentlyParked) {
      Alert.alert(
        "Lưu ý",
        `Biển số ${licensePlate} hiện đang được gửi tại bãi này. Bạn có chắc chắn muốn đặt trước cho khung giờ sắp tới không?`,
        [
          { text: "Hủy", style: "cancel" },
          { text: "Tiếp tục", onPress: () => performBooking() },
        ]
      );
    } else {
      performBooking();
    }
  };

  const performBooking = async () => {
    try {
      setSubmitting(true);
      const res = (await reservationApi.createReservation({
        facilityId,
        vehicleTypeId: selectedVehicleType,
        licensePlate,
        startTime: startTime.toISOString(),
      })) as any;
      if (res.success) {
        Alert.alert(
          "Đặt chỗ thành công!",
          "Chúng tôi đã giữ chỗ cho bạn. Bạn có thể xem và quản lý đặt chỗ trong mục Hoạt động.",
          [
            {
              text: "Xem đặt chỗ của tôi",
              onPress: () => {
                router.dismissAll();
                router.replace("/(driver)/sessions?tab=reserved" as any);
              },
            },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert(
        "Lỗi đặt chỗ",
        err?.message || "Có lỗi xảy ra, vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentAvailCount =
    availableSlots.find((s) => s.vehicleTypeId === selectedVehicleType)
      ?.availableCount || 0;
  const selectedVehicleTypeName =
    vehicleTypes.find((v) => v._id === selectedVehicleType)?.name || "";

  const openPicker = (mode: "date" | "time") => {
    setPickerMode(mode);
    setShowPicker(true);
  };

  if (loading) return <Loading />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        {/* ── White header: ← Đặt chỗ trước ── */}
        <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.white }}>
          <View style={styles.heroNav}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={18} color={Colors.brandDark} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.heroNavTitle}>Đặt chỗ trước</Text>
              {facilityName ? (
                <Text style={styles.heroFacilityName} numberOfLines={1}>
                  {facilityName} • {facilityOpenTime} – {facilityCloseTime}
                </Text>
              ) : null}
            </View>
          </View>
        </SafeAreaView>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 1: Loại xe ── */}
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Loại xe</Text>
          </View>
          <View style={styles.card}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vtRow}
            >
              {vehicleTypes.map((vt) => {
                const active = selectedVehicleType === vt._id;
                const slotInfo = availableSlots.find(s => s.vehicleTypeId === vt._id);
                const count = slotInfo?.availableCount ?? 0;
                const noSlot = count === 0;
                return (
                  <TouchableOpacity
                    key={vt._id}
                    style={[styles.vtChip, active && styles.vtChipActive, noSlot && styles.vtChipFull]}
                    onPress={() => {
                      setSelectedVehicleType(vt._id);
                      // Auto-select first vehicle of this type
                      const matchingVehicles = userVehicles.filter(
                        (v) => getVehicleTypeId(v) === vt._id
                      );
                      if (matchingVehicles.length > 0) {
                        const defV = matchingVehicles.find((v) => v.isDefault) || matchingVehicles[0];
                        setSelectedVehicleId(defV._id);
                        setLicensePlate(defV.licensePlate);
                      } else {
                        setSelectedVehicleId("");
                        setLicensePlate("");
                      }
                    }}
                  >
                    <Ionicons
                      name={getVehicleIcon(vt.name)}
                      size={18}
                      color={active ? Colors.primary : noSlot ? Colors.textTertiary : Colors.textSecondary}
                    />
                    <Text style={[styles.vtChipText, active && styles.vtChipTextActive, noSlot && styles.vtChipTextFull]}>
                      {vt.name}
                    </Text>
                    <View style={[styles.slotCountBadge, { backgroundColor: noSlot ? Colors.dangerLight : count <= 5 ? Colors.warningLight : Colors.successLight }]}>
                      <Text style={[styles.slotCountText, { color: noSlot ? Colors.danger : count <= 5 ? Colors.warning : Colors.success }]}>
                        {count}
                      </Text>
                    </View>
                    {active && !noSlot && (
                      <View style={styles.vtCheck}>
                        <Ionicons name="checkmark" size={10} color={Colors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Step 2: Chọn xe ── */}
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Chọn xe của bạn</Text>
          </View>

          {filteredVehicles.length === 0 ? (
            <View style={styles.noVehicleCard}>
              <View style={styles.noVehicleIconWrap}>
                <Ionicons name="car-outline" size={32} color={Colors.textTertiary} />
              </View>
              <Text style={styles.noVehicleTitle}>Chưa có xe {selectedVehicleTypeName}</Text>
              <Text style={styles.noVehicleSub}>
                Bạn chưa đăng ký xe loại này. Hãy thêm xe để đặt chỗ nhanh hơn.
              </Text>
              <TouchableOpacity
                style={styles.addVehicleBtn}
                onPress={() => router.push('/profile/add-vehicle' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color={Colors.white} />
                <Text style={styles.addVehicleBtnText}>Thêm xe mới</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.vehicleList}>
              {filteredVehicles.map((vehicle) => {
                const isSelected = selectedVehicleId === vehicle._id;
                const typeName = getVehicleTypeName(vehicle);
                return (
                  <TouchableOpacity
                    key={vehicle._id}
                    style={[styles.vehicleCard, isSelected && styles.vehicleCardActive]}
                    onPress={() => selectVehicle(vehicle)}
                    activeOpacity={0.8}
                  >
                    {/* Radio indicator */}
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>

                    {/* Vehicle image or icon */}
                    {vehicle.image ? (
                      <Image source={{ uri: vehicle.image }} style={styles.vehicleImg} />
                    ) : (
                      <View style={[styles.vehicleIconFallback, isSelected && { backgroundColor: Colors.primaryBg }]}>
                        <Ionicons
                          name={getVehicleIcon(typeName)}
                          size={22}
                          color={isSelected ? Colors.primary : Colors.textTertiary}
                        />
                      </View>
                    )}

                    {/* Vehicle info */}
                    <View style={styles.vehicleInfo}>
                      <Text style={[styles.vehiclePlate, isSelected && { color: Colors.primary }]}>
                        {vehicle.licensePlate}
                      </Text>
                      <View style={styles.vehicleMeta}>
                        {vehicle.nickname ? (
                          <Text style={styles.vehicleNickname}>{vehicle.nickname}</Text>
                        ) : (
                          <Text style={styles.vehicleTypeName}>{typeName}</Text>
                        )}
                        {vehicle.isDefault && (
                          <View style={styles.defaultPill}>
                            <Ionicons name="star" size={8} color={Colors.warning} />
                            <Text style={styles.defaultPillText}>Mặc định</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Add vehicle shortcut */}
              <TouchableOpacity
                style={styles.addVehicleLink}
                onPress={() => router.push('/profile/add-vehicle' as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.addVehicleLinkText}>Thêm xe mới</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 3: Thời gian ── */}
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <Text style={styles.stepTitle}>Thời gian vào bãi</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Ngày & giờ bắt đầu dự kiến</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => openPicker("date")}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={Colors.brandDark}
                />
                <Text style={styles.dateBtnText}>
                  {startTime.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => openPicker("time")}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={Colors.brandDark}
                />
                <Text style={styles.dateBtnText}>
                  {startTime.toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            {showPicker && (
              <DateTimePicker
                value={startTime}
                mode={pickerMode}
                is24Hour={true}
                display="default"
                onChange={(event, date) => {
                  if (Platform.OS === "android") setShowPicker(false);
                  if (event.type === "set" && date) {
                    const newDate = new Date(startTime);
                    if (pickerMode === "date") {
                      newDate.setFullYear(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate(),
                      );
                    } else {
                      newDate.setHours(date.getHours(), date.getMinutes());
                    }
                    setStartTime(newDate);
                  }
                  if (Platform.OS === "ios" && event.type === "set")
                    setShowPicker(false);
                }}
              />
            )}

            <View style={styles.reminderBox}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={Colors.info}
              />
              <Text style={styles.reminderText}>
                Hoạt động:{" "}
                <Text style={{ fontFamily: Typography.fontFamily.semiBold }}>
                  {facilityOpenTime} – {facilityCloseTime}
                </Text>{" "}
                (Đặt trước tối thiểu 5p)
              </Text>
            </View>
          </View>

          {/* ── Availability banner ── */}
          <View
            style={[
              styles.availBanner,
              {
                backgroundColor:
                  currentAvailCount > 0
                    ? Colors.successLight
                    : Colors.dangerLight,
              },
            ]}
          >
            <Ionicons
              name={
                currentAvailCount > 0
                  ? "checkmark-circle-outline"
                  : "close-circle-outline"
              }
              size={20}
              color={currentAvailCount > 0 ? Colors.success : Colors.danger}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.availTitle,
                  {
                    color:
                      currentAvailCount > 0 ? Colors.success : Colors.danger,
                  },
                ]}
              >
                {currentAvailCount > 0 ? "Còn chỗ trống" : "Hết chỗ trống"}
              </Text>
              <Text style={styles.availSub}>
                {selectedVehicleTypeName}: còn{" "}
                <Text
                  style={{
                    fontFamily: Typography.fontFamily.bold,
                    color:
                      currentAvailCount > 0 ? Colors.success : Colors.danger,
                  }}
                >
                  {currentAvailCount} chỗ
                </Text>{" "}
                hiện tại
              </Text>
            </View>
          </View>

          {/* ── Confirm button ── */}
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (submitting || !selectedVehicleId) && styles.confirmBtnLoading,
            ]}
            onPress={handleBook}
            disabled={submitting || !selectedVehicleId}
            activeOpacity={0.85}
          >
            <Ionicons
              name={submitting ? "hourglass-outline" : "checkmark"}
              size={18}
              color={Colors.brandDark}
            />
            <Text style={styles.confirmBtnText}>
              {submitting ? "Đang xử lý..." : "Xác nhận đặt chỗ"}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  /* ── Header ── */
  heroNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandGray,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brandGray,
    borderRadius: 19,
  },
  heroNavTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  heroFacilityName: {
    fontSize: 11,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.bold,
    marginTop: 2,
  },

  /* ── Content ── */
  content: { padding: 20, paddingBottom: 16 },

  /* ── Step header ── */
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    marginTop: 6,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandLime,
  },
  stepTitle: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* ── Card ── */
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.brandGray,
    ...Shadows.sm,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandGrayText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  /* ── Vehicle type chips — lime active ── */
  vtRow: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  vtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: Colors.brandGray,
  },
  vtChipActive: {
    backgroundColor: Colors.brandLime,
  },
  vtChipText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  vtChipTextActive: {
    color: Colors.brandDark,
    fontFamily: Typography.fontFamily.bold,
  },
  vtCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vtChipFull: {
    backgroundColor: Colors.brandGray,
    opacity: 0.5,
  },
  vtChipTextFull: {
    color: Colors.brandGrayText,
  },
  slotCountBadge: {
    borderRadius: 9999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  slotCountText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },

  /* ── Vehicle selector ── */
  vehicleList: { marginBottom: 20 },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.brandGray,
  },
  vehicleCardActive: {
    borderColor: Colors.brandLime,
    backgroundColor: Colors.white,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.brandGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: Colors.brandLime,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.brandDark,
  },
  vehicleImg: {
    width: 48,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.brandGray,
  },
  vehicleIconFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brandGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: { flex: 1 },
  vehiclePlate: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    letterSpacing: 0.5,
  },
  vehicleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  vehicleNickname: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandGrayText,
  },
  vehicleTypeName: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandGrayText,
  },
  defaultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(164,255,7,0.15)',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultPillText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: '#304f00',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addVehicleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  addVehicleLinkText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },

  /* ── No vehicle card ── */
  noVehicleCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.brandGray,
    borderStyle: 'dashed',
  },
  noVehicleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noVehicleTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    marginBottom: 4,
  },
  noVehicleSub: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.brandGrayText,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brandDark,
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addVehicleBtnText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },

  /* ── Date row ── */
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.brandGray,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateBtnText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },

  /* ── Reminder ── */
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    backgroundColor: 'rgba(255, 191, 0, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  reminderText: {
    fontSize: 11,
    color: Colors.brandDark,
    fontFamily: Typography.fontFamily.semiBold,
    flex: 1,
    lineHeight: 16,
  },

  /* ── Availability banner ── */
  availBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  availTitle: { fontSize: 13, fontFamily: Typography.fontFamily.bold },
  availSub: {
    fontSize: 11,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.semiBold,
    marginTop: 2,
  },

  /* ── Confirm button — lime pill ── */
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.brandLime,
    borderRadius: 9999,
    paddingVertical: 16,
    marginBottom: 8,
    ...Shadows.sm,
  },
  confirmBtnLoading: { backgroundColor: Colors.brandGray },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
});
