import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image, Modal, FlatList, Switch,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Typography, Shadows } from "../../src/constants/theme";
import { vehicleApi, vehicleTypeApi } from "../../src/services/api";

interface VehicleTypeOption {
  _id: string;
  name: string;
  code: string;
  icon: string;
}

const getTypeIcon = (name?: string): any => {
  if (!name) return "car-outline";
  const n = name.toLowerCase();
  if (n.includes("ô tô") || n.includes("car")) return "car-sport-outline";
  if (n.includes("xe tải") || n.includes("truck")) return "bus-outline";
  return "bicycle-outline";
};

export default function EditVehicleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const vehicleId = typeof id === "string" ? id : id?.[0] || "";

  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeOption[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [plateError, setPlateError] = useState("");
  const [nickname, setNickname] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isInUse, setIsInUse] = useState(false);
  const [inUseReason, setInUseReason] = useState('');

  // Load vehicle types + vehicle data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingTypes(true);
        setLoadingVehicle(true);

        const [typesRes, vehicleRes]: any[] = await Promise.all([
          vehicleTypeApi.getVehicleTypes(),
          vehicleApi.getVehicleById(vehicleId),
        ]);

        if (typesRes.success && typesRes.data) {
          setVehicleTypes(typesRes.data);
        }

        if (vehicleRes.success && vehicleRes.data) {
          const v = vehicleRes.data;
          setSelectedTypeId(v.vehicleTypeId?._id || v.vehicleTypeId || "");
          setLicensePlate(v.licensePlate || "");
          setNickname(v.nickname || "");
          setImage(v.image || null);
          setIsDefault(v.isDefault || false);
          setIsInUse(v.isInUse || false);
          setInUseReason(v.inUseReason || '');
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        Alert.alert("Lỗi", "Không thể tải thông tin xe.");
      } finally {
        setLoadingTypes(false);
        setLoadingVehicle(false);
      }
    };
    if (vehicleId) fetchData();
  }, [vehicleId]);

  const selectedType = vehicleTypes.find((t) => t._id === selectedTypeId);

  // ── Auto format biển số (giống trang đặt chỗ) ──
  const autoFormatPlate = (text: string): string => {
    let s = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!s) return '';

    let prefix = '';
    let tail = '';

    const typeName = selectedType?.name?.toLowerCase() || '';
    const isCar = typeName.includes('ô tô') || typeName.includes('car');

    if (isCar) {
      const match = s.match(/^(\d{2}[A-Z]{1,2})(\d*)$/);
      if (match) {
        prefix = match[1];
        tail = match[2];
      } else {
        prefix = s;
      }
    } else {
      if (s.length >= 4) {
        prefix = s.substring(0, 4);
        tail = s.substring(4);
      } else {
        prefix = s;
      }
    }

    prefix = prefix.replace(/^(\d{2})([A-Z])/, '$1-$2');

    if (tail) {
      tail = tail.substring(0, 5);
      if (tail.length === 5) {
        tail = tail.substring(0, 3) + '.' + tail.substring(3);
      }
      return prefix + '-' + tail;
    }

    return prefix;
  };

  const isValidPlate = (plate: string): boolean => {
    const p = plate.trim();
    const moto = /^\d{2}-[A-Z]\d-(\d{3}\.\d{2}|\d{4,5})$/.test(p);
    const car1 = /^\d{2}-[A-Z]-(\d{3}\.\d{2}|\d{4,5})$/.test(p);
    const car2 = /^\d{2}-[A-Z]{2}-(\d{3}\.\d{2}|\d{4,5})$/.test(p);
    return moto || car1 || car2;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền bị từ chối", "Bạn cần cấp quyền truy cập thư viện ảnh.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSubmit = async () => {
    if (isInUse) {
      Alert.alert("Không thể chỉnh sửa", inUseReason);
      return;
    }
    if (!selectedTypeId) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn loại xe.");
      return;
    }
    const finalPlate = licensePlate.trim();
    if (!finalPlate) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập biển số xe.");
      return;
    }
    if (!isValidPlate(finalPlate)) {
      Alert.alert(
        "Biển số không hợp lệ",
        `"${finalPlate}" không đúng định dạng biển số Việt Nam.\n\nVí dụ hợp lệ:\n• Xe máy: 29-A1-123.45\n• Ô tô: 30-A-123.45`
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        vehicleTypeId: selectedTypeId,
        licensePlate: finalPlate,
        nickname: nickname.trim(),
        image: image || '',
        isDefault,
      };

      const res: any = await vehicleApi.updateVehicle(vehicleId, payload);
      if (res.success) {
        Alert.alert("✅ Cập nhật thành công!", "Thông tin xe đã được lưu.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Lỗi", error?.message || "Không thể cập nhật xe lúc này.");
    } finally {
      setSubmitting(false);
    }
  };

  const getPlaceholder = () => {
    const typeName = selectedType?.name?.toLowerCase() || '';
    if (typeName.includes('ô tô') || typeName.includes('car')) return "Ví dụ: 30-A-123.45";
    return "Ví dụ: 29-A1-123.45";
  };

  if (loadingVehicle || loadingTypes) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textTertiary, fontFamily: Typography.fontFamily.regular }}>
          Đang tải thông tin xe...
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        {/* ── White Header ── */}
        <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.white }}>
          <View style={styles.heroNav}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.brandDark} />
            </TouchableOpacity>
            <Text style={styles.heroTitle}>Chỉnh sửa xe</Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ── Warning: Xe đang sử dụng ── */}
          {isInUse && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={22} color="#E65100" />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>Không thể chỉnh sửa</Text>
                <Text style={styles.warningText}>{inUseReason}</Text>
              </View>
            </View>
          )}
          {/* ── Step 1: Loại xe (Dropdown) ── */}
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <Text style={styles.stepTitle}>
              Loại xe <Text style={{ color: Colors.danger }}>*</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.dropdownBtn, selectedTypeId ? styles.dropdownBtnActive : {}]}
            onPress={() => setShowDropdown(true)}
            activeOpacity={0.8}
          >
            {selectedType ? (
              <View style={styles.dropdownSelected}>
                <View style={[styles.dropdownIconWrap, { backgroundColor: Colors.primaryBg }]}>
                  <Ionicons name={getTypeIcon(selectedType.name)} size={20} color={Colors.primary} />
                </View>
                <Text style={styles.dropdownSelectedText}>{selectedType.name}</Text>
              </View>
            ) : (
              <View style={styles.dropdownSelected}>
                <Ionicons name="car-outline" size={20} color={Colors.placeholder} />
                <Text style={styles.dropdownPlaceholder}>Chọn loại xe...</Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          {/* ── Dropdown Modal ── */}
          <Modal
            visible={showDropdown}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDropdown(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowDropdown(false)}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Chọn loại xe</Text>
                  <TouchableOpacity onPress={() => setShowDropdown(false)}>
                    <Ionicons name="close" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={vehicleTypes}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => {
                    const active = selectedTypeId === item._id;
                    return (
                      <TouchableOpacity
                        style={[styles.modalItem, active && styles.modalItemActive]}
                        onPress={() => {
                          setSelectedTypeId(item._id);
                          setShowDropdown(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.modalItemIcon,
                          { backgroundColor: active ? Colors.primaryBg : Colors.surfaceElevated }
                        ]}>
                          <Ionicons
                            name={getTypeIcon(item.name)}
                            size={22}
                            color={active ? Colors.primary : Colors.textSecondary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[
                            styles.modalItemText,
                            active && { color: Colors.primary, fontFamily: Typography.fontFamily.semiBold }
                          ]}>
                            {item.name}
                          </Text>
                          <Text style={styles.modalItemCode}>{item.code}</Text>
                        </View>
                        {active && (
                          <View style={styles.modalCheck}>
                            <Ionicons name="checkmark" size={14} color={Colors.white} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableOpacity>
          </Modal>

          {/* ── Step 2: Biển số ── */}
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <Text style={styles.stepTitle}>
              Biển số xe <Text style={{ color: Colors.danger }}>*</Text>
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Biển số xe</Text>
            <View style={[styles.plateInputWrap, plateError ? { borderColor: Colors.danger } : {}]}>
              <Ionicons
                name="newspaper-outline"
                size={18}
                color={plateError ? Colors.danger : Colors.textSecondary}
              />
              <TextInput
                style={styles.plateField}
                placeholder={getPlaceholder()}
                placeholderTextColor={Colors.placeholder}
                value={licensePlate}
                onChangeText={(text) => {
                  const formatted = autoFormatPlate(text);
                  setLicensePlate(formatted);
                  if (formatted.length >= 8) {
                    setPlateError(isValidPlate(formatted) ? '' : 'Biển số không đúng định dạng');
                  } else {
                    setPlateError('');
                  }
                }}
                autoCapitalize="characters"
                maxLength={15}
              />
            </View>
            {plateError ? (
              <View style={styles.plateStatus}>
                <Ionicons name="alert-circle" size={13} color={Colors.danger} />
                <Text style={[styles.plateStatusText, { color: Colors.danger }]}>{plateError}</Text>
              </View>
            ) : licensePlate.length >= 8 && isValidPlate(licensePlate) ? (
              <View style={styles.plateStatus}>
                <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                <Text style={[styles.plateStatusText, { color: Colors.success }]}>Biển số hợp lệ</Text>
              </View>
            ) : null}
          </View>

          {/* ── Step 3: Nickname ── */}
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, { backgroundColor: Colors.textTertiary }]}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <Text style={styles.stepTitle}>
              Tên gợi nhớ <Text style={styles.optional}>(tuỳ chọn)</Text>
            </Text>
          </View>
          <View style={styles.card}>
            <TextInput
              style={styles.nicknameInput}
              placeholder="VD: Xe đi làm, Xe gia đình..."
              placeholderTextColor={Colors.placeholder}
              value={nickname}
              onChangeText={setNickname}
              maxLength={50}
            />
          </View>

          {/* ── Step 4: Ảnh xe ── */}
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, { backgroundColor: Colors.textTertiary }]}>
              <Text style={styles.stepNum}>4</Text>
            </View>
            <Text style={styles.stepTitle}>
              Ảnh xe <Text style={styles.optional}>(tuỳ chọn)</Text>
            </Text>
          </View>
          <View style={styles.imageSection}>
            {image ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: image }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.imageRemoveBtn}
                  onPress={() => setImage(null)}
                >
                  <Ionicons name="close-circle" size={26} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={32} color={Colors.textTertiary} />
                <Text style={styles.imagePickerText}>Chọn ảnh từ thư viện</Text>
                <Text style={styles.imagePickerSub}>Ảnh giúp bạn dễ nhận diện xe hơn</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Xe mặc định toggle ── */}
          <View style={styles.toggleCard}>
            <View style={styles.toggleInfo}>
              <View style={styles.toggleIconWrap}>
                <Ionicons name="star" size={18} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Đặt làm xe mặc định</Text>
                <Text style={styles.toggleSub}>Xe mặc định sẽ được chọn sẵn khi đặt chỗ</Text>
              </View>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: Colors.borderLight, true: Colors.primary + '60' }}
              thumbColor={isDefault ? Colors.primary : Colors.textTertiary}
            />
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!selectedTypeId || !licensePlate.trim() || submitting || isInUse) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedTypeId || !licensePlate.trim() || submitting || isInUse}
            activeOpacity={0.85}
          >
            <Text style={[styles.submitBtnText, (!selectedTypeId || !licensePlate.trim() || submitting || isInUse) && { color: Colors.brandGrayText }]}>
              {submitting ? (image && image.startsWith('data:') ? "Đang tải ảnh lên..." : "Đang lưu...") : "Lưu thay đổi"}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  // Header
  heroNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: Colors.brandGray,
  },
  backBtn: {
    width: 36, height: 36, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.brandGray, borderRadius: 18,
  },
  heroTitle: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.brandDark },

  // Content
  content: { padding: 16 },

  // Warning banner
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 14, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#E6510030',
  },
  warningTitle: {
    fontSize: 14, fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  warningText: {
    fontSize: 12, fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary, marginTop: 2,
  },

  // Step header
  stepHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginBottom: 10, marginTop: 4,
  },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  stepNum: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.white },
  stepTitle: { fontSize: 15, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary },
  optional: { fontFamily: Typography.fontFamily.regular, color: Colors.textTertiary, fontSize: 13 },

  // ── Dropdown ──
  dropdownBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 20, ...Shadows.sm,
  },
  dropdownBtnActive: { borderColor: Colors.primary + "50" },
  dropdownSelected: { flexDirection: "row", alignItems: "center", gap: 10 },
  dropdownIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  dropdownSelectedText: {
    fontSize: 15, fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  dropdownPlaceholder: {
    fontSize: 15, fontFamily: Typography.fontFamily.regular,
    color: Colors.placeholder,
  },

  // ── Dropdown Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: 17, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary,
  },
  modalItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalItemActive: { backgroundColor: Colors.primaryBg },
  modalItemIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  modalItemText: {
    fontSize: 15, fontFamily: Typography.fontFamily.medium, color: Colors.textPrimary,
  },
  modalItemCode: {
    fontSize: 12, fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary, marginTop: 2,
  },
  modalCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
  },

  // ── Plate input ──
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  fieldLabel: {
    fontSize: 12, fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textTertiary, textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 10,
  },
  plateInputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  plateField: {
    flex: 1, fontSize: 16, fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary, letterSpacing: 1,
  },
  plateStatus: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  plateStatusText: { fontSize: 12, fontFamily: Typography.fontFamily.medium },
  nicknameInput: {
    fontSize: 15, fontFamily: Typography.fontFamily.regular,
    color: Colors.textPrimary, paddingHorizontal: 0, paddingVertical: 2,
  },

  // Image
  imageSection: { marginBottom: 20 },
  imagePickerBtn: {
    borderWidth: 1.5, borderColor: Colors.borderLight, borderStyle: "dashed",
    borderRadius: 16, paddingVertical: 28, alignItems: "center",
    backgroundColor: Colors.surface, gap: 4,
  },
  imagePickerText: {
    fontSize: 14, fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary, marginTop: 4,
  },
  imagePickerSub: {
    fontSize: 12, fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary,
  },
  imagePreviewWrap: { position: "relative", alignSelf: "center" },
  imagePreview: {
    width: 200, height: 150, borderRadius: 16,
    backgroundColor: Colors.borderLight,
  },
  imageRemoveBtn: {
    position: "absolute", top: -10, right: -10,
    backgroundColor: Colors.white, borderRadius: 14,
  },

  // Toggle
  toggleCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  toggleInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  toggleIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.warningLight || "#FFF8E1",
    alignItems: "center", justifyContent: "center",
  },
  toggleTitle: {
    fontSize: 14, fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  toggleSub: {
    fontSize: 12, fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary, marginTop: 2,
  },

  // Submit
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.brandLime, borderRadius: 9999, paddingVertical: 16,
    ...Shadows.sm,
  },
  submitBtnDisabled: { backgroundColor: Colors.brandGray },
  submitBtnText: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.brandDark },
});
