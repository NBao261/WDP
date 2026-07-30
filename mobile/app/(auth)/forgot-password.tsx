import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, ScrollView,
  Alert, TouchableOpacity, TextInput as RNTextInput, ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Shadows } from '../../src/constants/theme';
import { authApi } from '../../src/services/api';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpInputRefs = useRef<(RNTextInput | null)[]>([]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // ── Step 1: Gửi OTP ─────────────────────────
  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert('Lỗi', 'Vui lòng nhập email');
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setStep('otp');
      setCountdown(60);
      Alert.alert('Thành công', 'Mã OTP đã được gửi đến email của bạn');
    } catch (error: any) {
      const msg = error?.message || error?.error?.message || 'Có lỗi xảy ra';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──────────────────────
  const handleVerifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Lỗi', 'Vui lòng nhập đủ 6 số OTP');
      return;
    }
    setLoading(true);
    try {
      const res: any = await authApi.verifyOtp(email, otpString);
      setResetToken(res.data.resetToken);
      setStep('password');
    } catch (error: any) {
      const msg = error?.message || error?.error?.message || 'Mã OTP không chính xác';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Đổi mật khẩu ───────────────────
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ mật khẩu');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(email, resetToken, newPassword);
      Alert.alert('Thành công', 'Đổi mật khẩu thành công! Hãy đăng nhập lại.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login' as any) },
      ]);
    } catch (error: any) {
      const msg = error?.message || error?.error?.message || 'Có lỗi xảy ra';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Gửi lại OTP ────────────────────────────
  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      Alert.alert('Thành công', 'Mã OTP mới đã được gửi');
    } catch (error: any) {
      const msg = error?.message || error?.error?.message || 'Có lỗi xảy ra';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Input Handler ───────────────────────
  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) {
      // Handle paste
      const chars = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      chars.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      const nextIdx = Math.min(index + chars.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, '');
    setOtp(newOtp);

    if (text && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'email': return 1;
      case 'otp': return 2;
      case 'password': return 3;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'email': return 'Quên mật khẩu';
      case 'otp': return 'Nhập mã OTP';
      case 'password': return 'Đặt mật khẩu mới';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'email': return 'Nhập email đã đăng ký để nhận mã OTP';
      case 'otp': return `Mã OTP đã được gửi đến\n${email}`;
      case 'password': return 'Nhập mật khẩu mới cho tài khoản của bạn';
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
              <TouchableOpacity
                onPress={() => {
                  if (step === 'email') router.back();
                  else if (step === 'otp') setStep('email');
                  else setStep('otp');
                }}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={20} color={Colors.brandDark} />
              </TouchableOpacity>
              <View style={styles.logoSmall}>
                <Ionicons name="key" size={16} color={Colors.brandDark} />
              </View>
              <View style={{ width: 40 }} />
            </View>

            {/* Step Indicator */}
            <View style={styles.stepIndicator}>
              {[1, 2, 3].map(num => (
                <View key={num} style={styles.stepRow}>
                  <View style={[
                    styles.stepDot,
                    num <= getStepNumber() && styles.stepDotActive,
                    num < getStepNumber() && styles.stepDotDone,
                  ]}>
                    {num < getStepNumber() ? (
                      <Ionicons name="checkmark" size={12} color={Colors.brandDark} />
                    ) : (
                      <Text style={[
                        styles.stepDotText,
                        num <= getStepNumber() && styles.stepDotTextActive,
                      ]}>{num}</Text>
                    )}
                  </View>
                  {num < 3 && (
                    <View style={[styles.stepLine, num < getStepNumber() && styles.stepLineActive]} />
                  )}
                </View>
              ))}
            </View>

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>{getStepTitle()}</Text>
              <Text style={styles.subtitle}>{getStepSubtitle()}</Text>
            </View>

            {/* Form */}
            <View style={styles.formSection}>
              {/* ── Step 1: Email ── */}
              {step === 'email' && (
                <>
                  <View style={styles.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={Colors.brandGrayText} style={styles.inputIcon} />
                    <RNTextInput
                      style={styles.input}
                      placeholder="Email đã đăng ký"
                      placeholderTextColor={Colors.brandGrayText}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={handleSendOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={Colors.brandDark} />
                    ) : (
                      <>
                        <Ionicons name="send-outline" size={18} color={Colors.brandDark} />
                        <Text style={styles.primaryBtnText}>Gửi mã OTP</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* ── Step 2: OTP ── */}
              {step === 'otp' && (
                <>
                  <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                      <RNTextInput
                        key={index}
                        ref={ref => { otpInputRefs.current[index] = ref; }}
                        style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                        value={digit}
                        onChangeText={text => handleOtpChange(text, index)}
                        onKeyPress={e => handleOtpKeyPress(e, index)}
                        keyboardType="number-pad"
                        maxLength={1}
                        autoFocus={index === 0}
                        selectTextOnFocus
                      />
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={Colors.brandDark} />
                    ) : (
                      <>
                        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.brandDark} />
                        <Text style={styles.primaryBtnText}>Xác nhận OTP</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleResendOtp}
                    disabled={countdown > 0}
                  >
                    <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
                      {countdown > 0 ? `Gửi lại mã sau ${countdown}s` : 'Gửi lại mã OTP'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Step 3: New Password ── */}
              {step === 'password' && (
                <>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.brandGrayText} style={styles.inputIcon} />
                    <RNTextInput
                      style={styles.input}
                      placeholder="Mật khẩu mới"
                      placeholderTextColor={Colors.brandGrayText}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      autoFocus
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={Colors.brandGrayText}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.brandGrayText} style={styles.inputIcon} />
                    <RNTextInput
                      style={styles.input}
                      placeholder="Xác nhận mật khẩu mới"
                      placeholderTextColor={Colors.brandGrayText}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                    />
                  </View>

                  {newPassword && newPassword.length < 6 && (
                    <Text style={styles.errorHint}>⚠️ Mật khẩu phải có ít nhất 6 ký tự</Text>
                  )}

                  {confirmPassword && newPassword !== confirmPassword && (
                    <Text style={styles.errorHint}>⚠️ Mật khẩu xác nhận không khớp</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={handleResetPassword}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={Colors.brandDark} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color={Colors.brandDark} />
                        <Text style={styles.primaryBtnText}>Đổi mật khẩu</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={{ flex: 1 }} />

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Đã nhớ mật khẩu? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login' as any)}>
                <Text style={styles.footerLink}>Đăng nhập</Text>
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
    marginBottom: 16,
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

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brandGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.brandLime,
  },
  stepDotDone: {
    backgroundColor: Colors.brandLime,
  },
  stepDotText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandGrayText,
  },
  stepDotTextActive: {
    color: Colors.brandDark,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.brandGray,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: Colors.brandLime,
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
    lineHeight: 20,
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

  // OTP Input
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 8,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.brandGray,
    textAlign: 'center',
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  otpInputFilled: {
    backgroundColor: Colors.brandLime,
  },

  // Buttons
  primaryBtn: {
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
  btnDisabled: {
    backgroundColor: Colors.disabled,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  resendBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    textDecorationLine: 'underline',
  },
  resendTextDisabled: {
    color: Colors.brandGrayText,
    textDecorationLine: 'none',
  },

  // Error hint
  errorHint: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.danger,
    marginLeft: 4,
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
