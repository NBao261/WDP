import React, { useState } from "react";
import {
  View, Text, StyleSheet, Alert, TextInput, TouchableOpacity, ScrollView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Typography, Shadows } from "../../src/constants/theme";
import { authApi } from "../../src/services/api";

interface PasswordFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  iconName: any;
}

function PasswordField({ label, placeholder, value, onChangeText, visible, onToggle, iconName }: PasswordFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <Ionicons name={iconName} size={18} color={Colors.brandDark} style={{ marginRight: 10 }} />
        <TextInput
          style={styles.fieldInput}
          secureTextEntry={!visible}
          placeholder={placeholder}
          placeholderTextColor={Colors.brandGrayText}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
          <Ionicons name={visible ? "eye-outline" : "eye-off-outline"} size={18} color={Colors.brandGrayText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập đầy đủ các trường."); return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Không khớp", "Mật khẩu xác nhận không khớp với mật khẩu mới."); return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Mật khẩu quá ngắn", "Mật khẩu mới phải có ít nhất 6 ký tự."); return;
    }
    try {
      setLoading(true);
      const res: any = await authApi.changePassword({ oldPassword, newPassword });
      if (res.success) {
        Alert.alert("✅ Thành công", "Mật khẩu đã được thay đổi.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Lỗi", error?.message || error?.error?.message || "Không thể đổi mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  const allFilled = oldPassword && newPassword && confirmPassword;
  const matched = newPassword === confirmPassword;

  // Password strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpperLower = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumberOrSpecial = /[0-9]/.test(newPassword) || /[^a-zA-Z0-9]/.test(newPassword);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <SafeAreaView edges={["top"]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.brandDark} />
            </TouchableOpacity>
            <View style={{ width: 40 }} />
          </View>

          {/* Title Section */}
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              <Ionicons name="lock-closed" size={20} color={Colors.brandDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText}>Đổi mật khẩu</Text>
              <Text style={styles.titleSub}>Bảo vệ tài khoản bằng mật khẩu mạnh.</Text>
            </View>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Form card */}
          <View style={styles.card}>
            <PasswordField
              label="Mật khẩu hiện tại"
              placeholder="Nhập mật khẩu hiện tại"
              value={oldPassword}
              onChangeText={setOldPassword}
              visible={showOld}
              onToggle={() => setShowOld(v => !v)}
              iconName="lock-closed-outline"
            />
            <View style={styles.divider} />
            <PasswordField
              label="Mật khẩu mới"
              placeholder="Nhập mật khẩu mới"
              value={newPassword}
              onChangeText={setNewPassword}
              visible={showNew}
              onToggle={() => setShowNew(v => !v)}
              iconName="key-outline"
            />
            <View style={styles.divider} />
            <PasswordField
              label="Xác nhận mật khẩu mới"
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              visible={showConfirm}
              onToggle={() => setShowConfirm(v => !v)}
              iconName="checkmark-circle-outline"
            />

            {/* Match indicator */}
            {confirmPassword.length > 0 && (
              <View style={[styles.matchRow, { backgroundColor: matched ? 'rgba(164, 255, 7, 0.15)' : Colors.dangerLight }]}>
                <Ionicons
                  name={matched ? "checkmark-circle" : "close-circle"}
                  size={14}
                  color={matched ? Colors.brandDark : Colors.danger}
                />
                <Text style={[styles.matchText, { color: matched ? Colors.brandDark : Colors.danger }]}>
                  {matched ? "Mật khẩu khớp" : "Mật khẩu không khớp"}
                </Text>
              </View>
            )}
          </View>

          {/* Password Requirements */}
          <View style={styles.reqBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.brandDark} />
            <View style={styles.reqContent}>
              <Text style={styles.reqTitle}>Yêu cầu mật khẩu:</Text>
              <View style={styles.reqItem}>
                <Ionicons
                  name={hasMinLength ? "checkmark" : "chevron-forward"}
                  size={12}
                  color={hasMinLength ? Colors.success : Colors.brandGrayText}
                />
                <Text style={[styles.reqText, hasMinLength && { color: Colors.success }]}>Ít nhất 8 ký tự</Text>
              </View>
              <View style={styles.reqItem}>
                <Ionicons
                  name={hasUpperLower ? "checkmark" : "chevron-forward"}
                  size={12}
                  color={hasUpperLower ? Colors.success : Colors.brandGrayText}
                />
                <Text style={[styles.reqText, hasUpperLower && { color: Colors.success }]}>Bao gồm chữ hoa và chữ thường</Text>
              </View>
              <View style={styles.reqItem}>
                <Ionicons
                  name={hasNumberOrSpecial ? "checkmark" : "chevron-forward"}
                  size={12}
                  color={hasNumberOrSpecial ? Colors.success : Colors.brandGrayText}
                />
                <Text style={[styles.reqText, hasNumberOrSpecial && { color: Colors.success }]}>Chứa ít nhất một số hoặc ký tự đặc biệt</Text>
              </View>
            </View>
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.confirmBtn, (!allFilled || loading) && styles.confirmBtnDisabled]}
            onPress={handleChangePassword}
            disabled={!allFilled || loading}
            activeOpacity={0.85}
          >
            <Text style={[styles.confirmBtnText, (!allFilled || loading) && { color: Colors.brandGrayText }]}>
              {loading ? "Đang xử lý..." : "Xác nhận đổi mật khẩu"}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
  },

  // Title
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  titleSub: {
    fontSize: 12,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 2,
  },

  // Content
  content: { padding: 20 },

  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  divider: { height: 1, backgroundColor: Colors.brandGray, marginVertical: 14 },

  // Field
  fieldWrap: {},
  fieldLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    marginBottom: 8,
    marginLeft: 2,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.brandGray,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  fieldInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.brandDark,
    height: '100%',
  },
  eyeBtn: { padding: 8 },

  // Match indicator
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
  },
  matchText: { fontSize: 12, fontFamily: Typography.fontFamily.semiBold },

  // Requirements box
  reqBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 20,
    backgroundColor: 'rgba(164, 255, 7, 0.10)',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.brandLime,
  },
  reqContent: { flex: 1, gap: 4 },
  reqTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    marginBottom: 4,
  },
  reqItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reqText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.brandGrayText,
  },

  // Confirm
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.brandLime,
    borderRadius: 9999,
    height: 48,
    ...Shadows.sm,
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.brandGray,
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
});
