import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, ScrollView, Alert, TouchableOpacity, Image, TextInput as RNTextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Shadows } from '../../src/constants/theme';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const login = useAuthStore(state => state.login);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      const userData = useAuthStore.getState().user;
      const isStaff = userData?.role === 'staff' || userData?.role === 'manager' || userData?.role === 'admin';
      if (isStaff) {
        router.replace('/(staff)/scan-plate');
      } else {
        router.replace('/(driver)/home');
      }
    } catch (error: any) {
      const errMsg = error?.message || (typeof error === 'string' ? error : 'Có lỗi xảy ra');
      Alert.alert('Đăng nhập thất bại', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SafeAreaView edges={['top']} style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={Colors.brandDark} />
              </TouchableOpacity>
              <View style={styles.logoSmall}>
                <Ionicons name="car-sport" size={16} color={Colors.brandDark} />
              </View>
              <View style={{ width: 40 }} />
            </View>

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Smart Parking</Text>
              <Text style={styles.subtitle}>Đăng nhập tài khoản Driver</Text>
            </View>

            {/* Form */}
            <View style={styles.formSection}>
              {/* Email Input */}
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.brandGrayText} style={styles.inputIcon} />
                <RNTextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={Colors.brandGrayText}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.brandGrayText} style={styles.inputIcon} />
                <RNTextInput
                  style={styles.input}
                  placeholder="Mật khẩu"
                  placeholderTextColor={Colors.brandGrayText}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.brandGrayText}
                  />
                </TouchableOpacity>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity style={styles.forgotPass} onPress={() => router.push('/(auth)/forgot-password' as any)}>
                <Text style={styles.forgotPassText}>Quên mật khẩu?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Ionicons name="log-in-outline" size={18} color={Colors.brandDark} />
                <Text style={styles.loginBtnText}>{loading ? "Đang xử lý..." : "Đăng nhập"}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }} />

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)}>
                <Text style={styles.footerLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brandGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.brandLime,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Title
  titleSection: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.brandGrayText,
  },

  // Form
  formSection: {
    gap: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brandGray,
    borderRadius: 20,
    height: 56,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.brandDark,
    height: '100%',
  },
  eyeBtn: {
    padding: 8,
  },

  // Forgot password
  forgotPass: {
    alignSelf: 'flex-end',
  },
  forgotPassText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    textDecorationLine: 'underline',
  },

  // Login button
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.brandLime,
    borderRadius: 9999,
    height: 56,
    marginTop: 8,
    ...Shadows.sm,
  },
  loginBtnDisabled: {
    backgroundColor: Colors.disabled,
  },
  loginBtnText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 13,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.regular,
  },
  footerLink: {
    fontSize: 13,
    color: Colors.brandDark,
    fontFamily: Typography.fontFamily.bold,
  },
});
