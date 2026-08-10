import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../../supabase/client';
import { isValidEmail, isValidMatricule, isValidUsername, sanitizeText } from '../lib/validation';

type Mode = 'signup' | 'login' | 'forgot_password';
type ForgotStep = 'request' | 'verify' | 'reset';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signup');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // CQ-7: separate toggle for confirm-password field
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // CQ-8: prevent duplicate submissions with a ref flag
  const isSubmitting = useRef(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [matricule, setMatricule] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Forgot Password Flow States
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');

  // Errors
  const [fullNameError, setFullNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [matriculeError, setMatriculeError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const toggleMode = () => {
    if (mode === 'forgot_password') {
      setMode('login');
      // Sign out and clear any pending reset status
      supabase.auth.signOut();
      AsyncStorage.removeItem('ubuzz_password_reset_pending').catch(() => {});
    } else {
      setMode(mode === 'signup' ? 'login' : 'signup');
    }
    // Clear errors and fields
    setFullNameError('');
    setUsernameError('');
    setMatriculeError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setOtpError('');
    setForgotStep('request');
  };

  /**
   * BUG-1 FIX: All normalization is done locally inside this function using
   * derived constants (normalizedMatricule, trimmedName, etc.) so we never
   * rely on async state having updated. State setters are called only for
   * display purposes, not for submission values.
   *
   * BUG-2 FIX: fullName is now validated (non-empty, at least 2 real chars).
   *
   * Returns { isValid, normalizedValues } so handleSignUp can use them.
   */
  const validateSignup = (): {
    isValid: boolean;
    normalizedValues: {
      fullName: string;
      username: string;
      matricule: string;
      email: string;
    };
  } => {
    let isValid = true;

    // --- Full Name ---
    // BUG-2: validate fullName
    const trimmedFullName = sanitizeText(fullName.trim(), 50);
    if (trimmedFullName.length < 2) {
      setFullNameError('Full name is required.');
      isValid = false;
    } else {
      setFullNameError('');
    }

    // --- Username ---
    const trimmedUsername = sanitizeText(username.trim().toLowerCase(), 20);
    const userValidation = isValidUsername(trimmedUsername);
    if (!userValidation.valid) {
      setUsernameError(userValidation.error);
      isValid = false;
    } else {
      setUsernameError('');
    }

    // --- Matricule ---
    // BUG-1: normalize locally; do NOT call setMatricule here to avoid
    // the stale-state pitfall. Update display state separately.
    const normalizedMatricule = matricule.trim().toUpperCase();
    const matValidation = isValidMatricule(normalizedMatricule);
    if (!matValidation.valid) {
      setMatriculeError(matValidation.error);
      isValid = false;
    } else {
      setMatriculeError('');
      // Update display value (cosmetic only; submission uses normalizedMatricule)
      setMatricule(normalizedMatricule);
    }

    // --- Email ---
    const trimmedEmail = email.trim();
    const emValidation = isValidEmail(trimmedEmail);
    if (!emValidation.valid) {
      setEmailError(emValidation.error);
      isValid = false;
    } else {
      setEmailError('');
    }

    // --- Password ---
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }

    return {
      isValid,
      normalizedValues: {
        fullName: trimmedFullName,
        username: trimmedUsername,
        matricule: normalizedMatricule,
        email: trimmedEmail,
      },
    };
  };

  const handleSignUp = async () => {
    const { isValid, normalizedValues } = validateSignup();
    if (!isValid) return;

    // CQ-10: dismiss keyboard before async work so Alerts are visible
    Keyboard.dismiss();
    setLoading(true);

    try {
      // BUG-3 FIX: setLoading(false) lives ONLY in the finally block.
      // The early return on authError is removed — we just return after
      // showing the alert and let finally handle cleanup.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedValues.email,
        password: password,
        options: {
          data: {
            // BUG-1 FIX: use normalizedValues instead of raw state
            full_name: normalizedValues.fullName,
            username: normalizedValues.username,
            matricule: normalizedValues.matricule,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('User already registered')) {
          Alert.alert('Error', 'An account with this email already exists.');
        } else if (authError.message.includes('Database error saving new user')) {
          Alert.alert('Registration Error', 'That username or matricule is already taken. Please try another one.');
        } else {
          Alert.alert('Error', authError.message);
        }
        // BUG-3 FIX: no setLoading(false) here — finally handles it
        return;
      }

      if (authData.user) {
        Alert.alert('Success', 'Check your email to confirm your account.');
      }
    } catch (e: unknown) {
      // CQ-2 FIX: use unknown + type guard instead of any
      const message =
        e instanceof Error ? e.message : 'An unexpected error occurred.';
      Alert.alert('Error', message);
    } finally {
      // BUG-3 FIX: single authoritative reset of loading
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    // CQ-10: dismiss keyboard before async work
    Keyboard.dismiss();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert('Error', 'Invalid email or password.');
      }
      // On success, session state changes and RootNavigator will redirect
    } catch (e: unknown) {
      // CQ-2 FIX: unknown + type guard
      const message =
        e instanceof Error ? e.message : 'An unexpected error occurred.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    const trimmedEmail = email.trim();
    const emValidation = isValidEmail(trimmedEmail);
    if (!emValidation.valid) {
      setEmailError(emValidation.error);
      return;
    }
    setEmailError('');

    Keyboard.dismiss();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      Alert.alert('Success', 'A recovery code has been sent to your email.');
      setForgotStep('verify');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otpCode.trim();
    if (cleanOtp.length < 6 || cleanOtp.length > 8 || !/^\d+$/.test(cleanOtp)) {
      setOtpError('Please enter a valid verification code.');
      return;
    }
    setOtpError('');

    Keyboard.dismiss();
    setLoading(true);
    try {
      // 1. Set the pending reset flag first so RootNavigator is intercepted
      await AsyncStorage.setItem('ubuzz_password_reset_pending', 'true');

      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanOtp,
        type: 'recovery',
      });
      if (error) {
        // If error, remove the pending flag
        await AsyncStorage.removeItem('ubuzz_password_reset_pending').catch(() => {});
        Alert.alert('Error', error.message);
        return;
      }
      if (data.session) {
        setForgotStep('reset');
      } else {
        await AsyncStorage.removeItem('ubuzz_password_reset_pending').catch(() => {});
        Alert.alert('Error', 'Failed to establish session. Please request a new code.');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    setPasswordError('');

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      return;
    }
    setConfirmPasswordError('');

    Keyboard.dismiss();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      // Remove the pending reset flag
      await AsyncStorage.removeItem('ubuzz_password_reset_pending').catch(() => {});

      Alert.alert('Success', 'Your password has been reset successfully. Please log in.');
      // Sign out the current session so the user must login explicitly with their new password
      await supabase.auth.signOut();
      // Go back to login
      setMode('login');
      // Clear password states
      setPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setForgotStep('request');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // CQ-8 FIX: debounce guard — prevent multiple queued calls before the
  // first setLoading(true) takes effect on some platforms.
  const onSubmit = () => {
    if (loading || isSubmitting.current) return;
    isSubmitting.current = true;
    let task: Promise<void>;
    if (mode === 'signup') {
      task = handleSignUp();
    } else if (mode === 'login') {
      task = handleLogin();
    } else {
      // mode === 'forgot_password'
      if (forgotStep === 'request') {
        task = handleRequestOtp();
      } else if (forgotStep === 'verify') {
        task = handleVerifyOtp();
      } else {
        task = handleResetPassword();
      }
    }
    task.finally(() => {
      isSubmitting.current = false;
    });
  };

  return (
    <SafeAreaView className="flex-1">
      {/* Background Gradient - Completely Blue */}
      <LinearGradient
        colors={['#1E3A8A', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-6"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Glass Card */}
          <View className="bg-white/10 p-6 rounded-3xl border border-white/20 shadow-lg">

            <Text className="text-3xl font-bold text-white mb-2 text-center">
              U-Buzz
            </Text>
            <Text className="text-white/80 text-center mb-8">
              {mode === 'signup'
                ? 'Create an account'
                : mode === 'login'
                ? 'Welcome back'
                : forgotStep === 'request'
                ? 'Reset your password'
                : forgotStep === 'verify'
                ? 'Verify the code sent to your email'
                : 'Choose a new password'}
            </Text>

            {/* FULL NAME - BUG-2 & CQ-9 FIX */}
            {mode === 'signup' && (
              <View className="mb-4">
                <TextInput
                  placeholder="Full name"
                  placeholderTextColor="#ffffff99"
                  className={`bg-black/20 text-white px-4 py-4 rounded-xl border ${fullNameError ? 'border-[#FF8A8A] border-2' : 'border-white/10'}`}
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    const trimmed = sanitizeText(text.trim(), 50);
                    if (trimmed.length < 2) {
                      setFullNameError('Full name is required.');
                    } else {
                      setFullNameError('');
                    }
                  }}
                  // CQ-9 FIX: words auto-capitalization suits name entry
                  autoCapitalize="words"
                />
                {fullNameError ? (
                  <Text className="text-[#FF8A8A] font-bold text-xs mt-1 ml-1">{fullNameError}</Text>
                ) : null}
              </View>
            )}

            {/* USERNAME */}
            {mode === 'signup' && (
              <View className="mb-4">
                <TextInput
                  placeholder="Username"
                  placeholderTextColor="#ffffff99"
                  className={`bg-black/20 text-white px-4 py-4 rounded-xl border ${usernameError ? 'border-[#FF8A8A] border-2' : 'border-white/10'}`}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    const res = isValidUsername(sanitizeText(text.trim().toLowerCase(), 20));
                    setUsernameError(res.valid ? '' : res.error);
                  }}
                  autoCapitalize="none"
                />
                {usernameError ? (
                  <Text className="text-[#FF8A8A] font-bold text-xs mt-1 ml-1">{usernameError}</Text>
                ) : null}
              </View>
            )}

            {/* MATRICULE */}
            {mode === 'signup' && (
              <View className="mb-4">
                <TextInput
                  placeholder="Matricule (e.g. IU2024)"
                  placeholderTextColor="#ffffff99"
                  className={`bg-black/20 text-white px-4 py-4 rounded-xl border ${matriculeError ? 'border-[#FF8A8A] border-2' : 'border-white/10'}`}
                  value={matricule}
                  onChangeText={(text) => {
                    setMatricule(text);
                    const normalized = text.trim().toUpperCase();
                    const res = isValidMatricule(normalized);
                    setMatriculeError(res.valid ? '' : res.error);
                  }}
                  autoCapitalize="characters"
                />
                {matriculeError ? (
                  <Text className="text-[#FF8A8A] font-bold text-xs mt-1 ml-1">{matriculeError}</Text>
                ) : null}
              </View>
            )}

            {/* EMAIL - BUG-6 FIX: validate on blur in both signup AND login */}
            {(mode === 'signup' || mode === 'login' || (mode === 'forgot_password' && forgotStep === 'request')) && (
              <View className="mb-4">
                <TextInput
                  placeholder="Email address"
                  placeholderTextColor="#ffffff99"
                  className={`bg-black/20 text-white px-4 py-4 rounded-xl border ${emailError ? 'border-[#FF8A8A] border-2' : 'border-white/10'}`}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    const res = isValidEmail(text.trim());
                    setEmailError(res.valid ? '' : res.error);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {emailError ? (
                  <Text className="text-[#FF8A8A] font-bold text-xs mt-1 ml-1">{emailError}</Text>
                ) : null}
              </View>
            )}

            {/* OTP CODE */}
            {mode === 'forgot_password' && forgotStep === 'verify' && (
              <View className="mb-4">
                <TextInput
                  placeholder="Verification code"
                  placeholderTextColor="#ffffff99"
                  className={`bg-black/20 text-white px-4 py-4 rounded-xl border ${otpError ? 'border-[#FF8A8A] border-2' : 'border-white/10'}`}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={8}
                />
                {otpError ? (
                  <Text className="text-[#FF8A8A] font-bold text-xs mt-1 ml-1">{otpError}</Text>
                ) : null}
              </View>
            )}

            {/* PASSWORD */}
            {(mode === 'signup' || mode === 'login' || (mode === 'forgot_password' && forgotStep === 'reset')) && (
              <View className="mb-4">
                <View className={`flex-row items-center bg-black/20 rounded-xl border ${passwordError ? 'border-[#FF8A8A] border-2' : 'border-white/10'}`}>
                  <TextInput
                    placeholder={mode === 'forgot_password' ? 'New Password' : 'Password'}
                    placeholderTextColor="#ffffff99"
                    className="flex-1 text-white px-4 py-4"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (mode === 'signup' || mode === 'forgot_password') {
                        if (text.length < 8) {
                          setPasswordError('Password must be at least 8 characters.');
                        } else {
                          setPasswordError('');
                        }
                        if (confirmPasswordError) {
                          if (text === confirmPassword) {
                            setConfirmPasswordError('');
                          } else {
                            setConfirmPasswordError('Passwords do not match.');
                          }
                        }
                      }
                    }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    className="px-4"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#ffffff99"
                    />
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <Text className="text-[#FF8A8A] font-bold text-xs mt-1 ml-1">{passwordError}</Text>
                ) : null}
              </View>
            )}

            {/* CONFIRM PASSWORD - CQ-7 FIX: own independent toggle */}
            {(mode === 'signup' || (mode === 'forgot_password' && forgotStep === 'reset')) && (
              <View className="mb-6">
                <View className={`flex-row items-center bg-black/20 rounded-xl border ${confirmPasswordError ? 'border-[#FF8A8A] border-2' : 'border-white/10'}`}>
                  <TextInput
                    placeholder={mode === 'forgot_password' ? 'Confirm new password' : 'Confirm password'}
                    placeholderTextColor="#ffffff99"
                    className="flex-1 text-white px-4 py-4"
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (text !== password) {
                        setConfirmPasswordError('Passwords do not match.');
                      } else {
                        setConfirmPasswordError('');
                      }
                    }}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="px-4"
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#ffffff99"
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError ? (
                  <Text className="text-[#FF8A8A] font-bold text-xs mt-1 ml-1">{confirmPasswordError}</Text>
                ) : null}
              </View>
            )}

            {/* FORGOT PASSWORD LINK (Only in Login Mode) */}
            {mode === 'login' && (
              <TouchableOpacity
                onPress={() => {
                  setMode('forgot_password');
                  setForgotStep('request');
                  setPassword('');
                  setConfirmPassword('');
                  setOtpCode('');
                  setOtpError('');
                }}
                className="self-end mb-4"
              >
                <Text className="text-white/80 font-medium">Forgot Password?</Text>
              </TouchableOpacity>
            )}

            {/* RESEND CODE LINK (Only in Verify step of Forgot Password) */}
            {mode === 'forgot_password' && forgotStep === 'verify' && (
              <TouchableOpacity
                onPress={handleRequestOtp}
                disabled={loading}
                className="self-center mb-4"
              >
                <Text className="text-white/90 font-medium underline">
                  Didn't receive a code? Resend Code
                </Text>
              </TouchableOpacity>
            )}

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              onPress={onSubmit}
              disabled={loading}
              className={`py-4 rounded-xl items-center mt-2 ${loading ? 'bg-white/50' : 'bg-white'}`}
            >
              {loading ? (
                <ActivityIndicator color="#1E3A8A" />
              ) : (
                <Text className="text-[#1E3A8A] font-bold text-lg">
                  {mode === 'signup'
                    ? 'Sign Up'
                    : mode === 'login'
                    ? 'Login'
                    : forgotStep === 'request'
                    ? 'Send Reset Code'
                    : forgotStep === 'verify'
                    ? 'Verify Code'
                    : 'Reset Password'}
                </Text>
              )}
            </TouchableOpacity>

            {/* TOGGLE LINK */}
            <TouchableOpacity onPress={toggleMode} className="mt-6 items-center">
              <Text className="text-white/90">
                {mode === 'signup'
                  ? 'Already have an account? Login'
                  : mode === 'login'
                  ? "Don't have an account? Sign Up"
                  : 'Back to Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
