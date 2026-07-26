import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Typography, Spacing, Shadows } from "../../src/constants/theme";
import { exceptionApi, sessionApi } from "../../src/services/api";

const FEEDBACK_TYPES = [
  { id: "lost_card",    label: "Mất thẻ/Vé",       icon: "card-outline" },
  { id: "wrong_fee",    label: "Sai phí gửi xe",    icon: "cash-outline" },
  { id: "wrong_plate",  label: "Sai biển số",       icon: "document-text-outline" },
  { id: "wrong_zone",   label: "Sai khu vực đỗ",   icon: "navigate-outline" },
  { id: "unpaid",       label: "Chưa thanh toán",   icon: "wallet-outline" },
  { id: "other",        label: "Khác",              icon: "chatbubble-ellipses-outline" },
];

export default function CreateFeedbackScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>("other");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoadingSessions(true);
        // Chỉ lấy các phiên xe đang đỗ (active) để gửi phản hồi
        const activeRes: any = await sessionApi.getMySessions('active');
        
        let allSessions: any[] = [];
        if (activeRes.success && activeRes.data) allSessions = [...activeRes.data];

        // Sắp xếp phiên mới nhất lên đầu
        allSessions.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

        setSessions(allSessions);
        if (allSessions.length > 0) {
          setSelectedSessionId(allSessions[0]._id);
        } else {
          Alert.alert("Không có xe đang đỗ", "Bạn hiện không có xe nào đang đỗ trong bãi để gửi phản hồi.", [
            { text: "Đóng", onPress: () => router.back() }
          ]);
        }
      } catch (err) {
        console.log("Error loading sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    };
    loadSessions();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền bị từ chối", "Bạn cần cấp quyền thư viện ảnh."); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.3,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setImages(prev => [...prev, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!description.trim()) { Alert.alert("Thiếu mô tả", "Vui lòng mô tả vấn đề bạn gặp phải."); return; }
    if (!selectedSessionId) { Alert.alert("Lỗi", "Vui lòng chọn lượt gửi xe để phản hồi."); return; }

    try {
      setSubmitting(true);
      const payload: any = { type: selectedType, description: description.trim(), images, sessionId: selectedSessionId };

      const res: any = await exceptionApi.createDriverReport(payload);
      if (res.success) {
        Alert.alert("✅ Gửi thành công!", "Phản hồi của bạn đã được ghi nhận.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Lỗi", error?.message || "Không thể gửi phản hồi lúc này.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTypeData = FEEDBACK_TYPES.find(t => t.id === selectedType);

  if (loadingSessions) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Đang tải dữ liệu...</Text>
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
            <Text style={styles.heroTitle}>Gửi phản hồi</Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── Step 1: Lượt gửi xe ── */}
          {sessions.length > 0 && (
            <>
              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}><Text style={styles.stepNum}>1</Text></View>
                <Text style={styles.stepTitle}>Chọn xe đang đỗ cần phản hồi <Text style={{ color: Colors.danger }}>*</Text></Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {sessions.map((sess) => {
                  const active = selectedSessionId === sess._id;
                  const date = new Date(sess.checkInTime);
                  const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.getDate()}/${date.getMonth() + 1}`;
                  // Format the parking location text
                  const slotText = sess.slotId?.code ? `Đang đỗ: ${sess.slotId.code}` : "Đang gửi";
                  return (
                    <TouchableOpacity
                      key={sess._id}
                      style={[styles.typeChip, { marginRight: 10, width: 'auto', paddingHorizontal: 16 }, active && styles.typeChipActive]}
                      onPress={() => setSelectedSessionId(sess._id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="car-outline" size={17} color={active ? Colors.primary : Colors.textSecondary} />
                      <View style={{ flexDirection: 'column' }}>
                        <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>Xe: {sess.licensePlate || "Không biển"}</Text>
                        <Text style={[styles.typeChipText, { fontSize: 10, marginTop: 2 }, active ? styles.typeChipTextActive : { color: Colors.textTertiary }]}>{slotText} - Vô lúc: {timeString}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* ── Step 2: Loại vấn đề ── */}
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}><Text style={styles.stepNum}>2</Text></View>
            <Text style={styles.stepTitle}>Loại vấn đề</Text>
          </View>
          <View style={styles.typesGrid}>
            {FEEDBACK_TYPES.map(type => {
              const active = selectedType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setSelectedType(type.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={type.icon as any} size={17} color={active ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{type.label}</Text>
                  {active && (
                    <View style={styles.typeCheck}>
                      <Ionicons name="checkmark" size={10} color={Colors.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Step 3: Mô tả ── */}
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}><Text style={styles.stepNum}>3</Text></View>
            <Text style={styles.stepTitle}>Mô tả chi tiết</Text>
          </View>
          <View style={styles.card}>
            <TextInput
              style={styles.descInput}
              placeholder={`Mô tả vấn đề "${selectedTypeData?.label}" của bạn...`}
              placeholderTextColor={Colors.placeholder}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
            <Text style={styles.charCount}>{description.length} ký tự</Text>
          </View>

          {/* ── Step 4: Ảnh đính kèm ── */}
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}><Text style={styles.stepNum}>4</Text></View>
            <Text style={styles.stepTitle}>Hình ảnh <Text style={styles.optional}>(tùy chọn)</Text></Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imgRow}>
            {images.map((img, index) => (
              <View key={index} style={styles.imgWrap}>
                <Image source={{ uri: img }} style={styles.imgPreview} />
                <TouchableOpacity style={styles.imgRemove} onPress={() => removeImage(index)}>
                  <Ionicons name="close-circle" size={22} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 3 && (
              <TouchableOpacity style={styles.imgAdd} onPress={pickImage}>
                <Ionicons name="camera-outline" size={28} color={Colors.textTertiary} />
                <Text style={styles.imgAddText}>Thêm ảnh</Text>
                <Text style={styles.imgAddSub}>{images.length}/3</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[styles.submitBtn, (!description.trim() || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!description.trim() || submitting}
            activeOpacity={0.85}
          >
            <Text style={[styles.submitBtnText, (!description.trim() || submitting) && { color: Colors.brandGrayText }]}>
              {submitting ? "Đang gửi..." : "Gửi phản hồi"}
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

  // Step header
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 4 },
  stepBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.brandDark, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.brandLime },
  stepTitle: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.brandDark },
  optional: { fontFamily: Typography.fontFamily.regular, color: Colors.brandGrayText, fontSize: 13 },

  // Type chips
  typesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.brandGray,
    backgroundColor: Colors.white,
  },
  typeChipActive: { borderColor: Colors.brandDark, backgroundColor: Colors.brandDark },
  typeChipText: { fontSize: 12, fontFamily: Typography.fontFamily.medium, color: Colors.brandGrayText },
  typeChipTextActive: { color: Colors.white, fontFamily: Typography.fontFamily.bold },
  typeCheck: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.brandLime, alignItems: "center", justifyContent: "center" },

  // Description card
  card: {
    backgroundColor: Colors.brandGray, borderRadius: 16, padding: 14, marginBottom: 20,
  },
  descInput: {
    fontSize: 14, fontFamily: Typography.fontFamily.regular,
    color: Colors.brandDark, minHeight: 120, textAlignVertical: "top",
  },
  charCount: { fontSize: 10, color: Colors.brandGrayText, fontFamily: Typography.fontFamily.medium, textAlign: "right", marginTop: 6 },

  // Image row
  imgRow: { gap: 10, paddingBottom: 4, marginBottom: 20 },
  imgWrap: { position: "relative" },
  imgPreview: { width: 96, height: 96, borderRadius: 14, backgroundColor: Colors.brandGray },
  imgRemove: { position: "absolute", top: -8, right: -8, backgroundColor: Colors.white, borderRadius: 12 },
  imgAdd: {
    width: 96, height: 96, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.brandGray, borderStyle: "dashed",
    justifyContent: "center", alignItems: "center", backgroundColor: Colors.white, gap: 2,
  },
  imgAddText: { fontSize: 11, color: Colors.brandGrayText, fontFamily: Typography.fontFamily.medium },
  imgAddSub: { fontSize: 10, color: Colors.brandGrayText, fontFamily: Typography.fontFamily.regular },

  // Submit
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.brandLime, borderRadius: 9999, paddingVertical: 16,
    ...Shadows.sm,
  },
  submitBtnDisabled: { backgroundColor: Colors.brandGray },
  submitBtnText: { fontSize: 15, fontFamily: Typography.fontFamily.bold, color: Colors.brandDark },
});
