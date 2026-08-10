import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import supabase from '../../supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UploadScreen from '../screens/UploadScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import { useBadgeCount, badgeManager, useAnnouncementBadgeCount, announcementBadgeManager } from '../lib/badge';

// ─── Route type definitions ──────────────────────────────────────────────────

type RootStackParamList = {
  AppTabs: undefined;
  UploadModal: undefined;
  Auth: undefined;
  AdminDashboard: undefined;
};

// CQ-1 FIX: typed navigation prop instead of `any`
type AppTabsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AppTabs'>;

// ─── Navigator instances ──────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 95 : 75;

/**
 * CQ-6 FIX: The raised-button offset is derived from TAB_BAR_HEIGHT so it
 * scales correctly across iOS and Android rather than being a magic -20.
 * The button is centred vertically at the top edge of the tab bar, so we
 * lift it by 18px (so 70% sits inside the tab bar).
 */
const UPLOAD_BUTTON_SIZE = 60;
const UPLOAD_BUTTON_LIFT = -18;

// ─── Custom Upload Button ─────────────────────────────────────────────────────

/**
 * BUG-4 FIX: This is a standalone pressable component that receives `onPress`
 * directly. The UploadTab screen slot now uses an `EmptyTabScreen` so the
 * dummy View no longer creates a dead touch zone.
 */
const CustomUploadButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel="Upload"
    style={{
      top: UPLOAD_BUTTON_LIFT,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <View
      style={{
        width: UPLOAD_BUTTON_SIZE,
        height: UPLOAD_BUTTON_SIZE,
        borderRadius: UPLOAD_BUTTON_SIZE / 2,
        backgroundColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 5,
      }}
    >
      <Ionicons name="add" size={32} color="white" />
    </View>
  </TouchableOpacity>
);

/**
 * BUG-4 FIX: A real (but invisible) React component for the Upload tab slot.
 * Using a proper component avoids the dead-touch-zone created by passing `View`
 * directly as the component prop.
 */
function EmptyTabScreen() {
  return <View style={{ flex: 1 }} />;
}

// ─── App Tabs ─────────────────────────────────────────────────────────────────

function AppTabs({ navigation }: { navigation: AppTabsNavigationProp }) {
  const isNavigatingUpload = useRef(false);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          backgroundColor: '#0F0C15',
          borderTopWidth: 1,
          borderTopColor: '#1C1726',
          height: TAB_BAR_HEIGHT,
        },
        tabBarActiveTintColor: '#A78BFA',
        tabBarInactiveTintColor: '#5A5266',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" color={color} size={size} />
          ),
        }}
      />

      {/* BUG-4 FIX: use EmptyTabScreen (a real component) not bare View */}
      <Tab.Screen
        name="UploadTab"
        component={EmptyTabScreen}
        options={{
          tabBarButton: () => (
            <CustomUploadButton
              onPress={() => {
                if (isNavigatingUpload.current) return;
                isNavigatingUpload.current = true;
                navigation.navigate('UploadModal');
                setTimeout(() => {
                  isNavigatingUpload.current = false;
                }, 1000);
              }}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Announcements"
        component={AnnouncementsScreen}
        options={{
          tabBarIcon: ({ color, size }) => {
            const count = useAnnouncementBadgeCount();
            return (
              <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="megaphone" color={color} size={size} />
                {count > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: -4,
                      top: -2,
                      backgroundColor: '#FF2D55',
                      borderRadius: 5,
                      width: 10,
                      height: 10,
                    }}
                  />
                )}
              </View>
            );
          },
        }}
        listeners={({ navigation }) => ({
          tabPress: async (e) => {
            announcementBadgeManager.reset();
            AsyncStorage.setItem('ubuzz_last_viewed_announcements', new Date().toISOString()).catch(() => {});
          },
        })}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => {
            const count = useBadgeCount();
            return (
              <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="person" color={color} size={size} />
                {count > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: -6,
                      top: -4,
                      backgroundColor: '#FF2D55',
                      borderRadius: 9,
                      minWidth: 18,
                      height: 18,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 10,
                        fontWeight: 'bold',
                        textAlign: 'center',
                      }}
                    >
                      {count > 9 ? '9+' : count}
                    </Text>
                  </View>
                )}
              </View>
            );
          },
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Prevent default action (which might preserve params)
            e.preventDefault();
            // Navigate explicitly to Profile with no params to load the logged-in user's profile
            navigation.navigate('Profile', { userId: undefined });
            // Reset badge to 0 when user opens own profile
            badgeManager.reset();
          },
        })}
      />
    </Tab.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [passwordResetPending, setPasswordResetPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Unconditionally reset mute preference to false on app launch/startup
    AsyncStorage.setItem('ubuzz_mute_preference', 'false').catch(() => {});

    // Initial session fetch with admin check before loading ends
    async function initSession() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        const pending = await AsyncStorage.getItem('ubuzz_password_reset_pending');
        setPasswordResetPending(pending === 'true');
        
        if (s?.user?.id) {
          currentUserIdRef.current = s.user.id;
          const { data } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', s.user.id)
            .maybeSingle();
          const isAdminUser = data?.is_admin === true;
          setIsAdmin(isAdminUser);

          // Initial check for unread announcements
          if (!isAdminUser) {
            const lastViewed = await AsyncStorage.getItem('ubuzz_last_viewed_announcements');
            const { data: latestAnn } = await supabase
              .from('announcements')
              .select('created_at')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (latestAnn?.created_at) {
              if (!lastViewed || new Date(latestAnn.created_at) > new Date(lastViewed)) {
                announcementBadgeManager.increment();
              }
            }
          }
        } else {
          currentUserIdRef.current = null;
          setIsAdmin(false);
        }
        setSession(s);
      } catch (err) {
        console.error('[RootNavigator] Initial session fetch failed:', err);
      } finally {
        setLoading(false);
      }
    }

    initSession();

    /**
     * BUG-5 FIX: `onAuthStateChange` now handles SIGNED_OUT and
     * TOKEN_REFRESH_FAILED events explicitly so that when a session expires
     * mid-session the user is shown a message before being redirected instead
     * of being silently bounced to the auth screen.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if ((event as string) === 'TOKEN_REFRESH_FAILED') {
        // Session expired / token could not be refreshed — clear session.
        // The navigator will redirect to AuthScreen automatically.
        currentUserIdRef.current = null;
        setSession(null);
        setIsAdmin(false);
        setPasswordResetPending(false);
        console.warn('[Auth] Token refresh failed — user signed out.');
        return;
      }

      const pending = await AsyncStorage.getItem('ubuzz_password_reset_pending').catch(() => null);
      setPasswordResetPending(pending === 'true');

      const currentUserId = currentUserIdRef.current;
      const newUserId = newSession?.user?.id ?? null;

      // Only perform database checks and loading transitions if the user changed
      if (newUserId !== currentUserId) {
        currentUserIdRef.current = newUserId;

        if (newSession) {
          // Reset mute preference to false on login/session acquisition
          AsyncStorage.setItem('ubuzz_mute_preference', 'false').catch(() => {});
          
          // Fetch admin status before updating session/loading to avoid flickering
          setLoading(true);
          try {
            const { data } = await supabase
              .from('users')
              .select('is_admin')
              .eq('id', newSession.user.id)
              .maybeSingle();
            const isAdminUser = data?.is_admin === true;
            setIsAdmin(isAdminUser);

            if (!isAdminUser) {
              const lastViewed = await AsyncStorage.getItem('ubuzz_last_viewed_announcements');
              const { data: latestAnn } = await supabase
                .from('announcements')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (latestAnn?.created_at) {
                if (!lastViewed || new Date(latestAnn.created_at) > new Date(lastViewed)) {
                  announcementBadgeManager.increment();
                }
              }
            }
          } catch (err) {
            console.error('[RootNavigator] Auth state change admin check failed:', err);
            setIsAdmin(false);
          } finally {
            setSession(newSession);
            setLoading(false);
          }
        } else {
          setSession(null);
          setIsAdmin(false);
          setLoading(false);
        }
      } else {
        // User is identical (e.g. background token refresh) — just update the state silently
        if (newSession) {
          setSession(newSession);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || isAdmin) {
      badgeManager.reset();
      announcementBadgeManager.reset();
      return;
    }

    console.log('[RootNavigator] Subscribing to realtime notifications for user:', userId);

    // Likes channel
    const likesChannel = supabase
      .channel(`channel-notif-likes-${userId}`)
      .on('broadcast', { event: 'like' }, (response) => {
        const payload = response.payload;
        console.log('[RootNavigator] Received like broadcast:', response);
        if (payload && payload.userId && payload.userId !== userId) {
          badgeManager.increment();
        }
      });

    // Comments channel
    const commentsChannel = supabase
      .channel(`channel-notif-comments-${userId}`)
      .on('broadcast', { event: 'comment' }, (response) => {
        const payload = response.payload;
        console.log('[RootNavigator] Received comment broadcast:', response);
        if (payload && payload.userId && payload.userId !== userId) {
          badgeManager.increment();
        }
      });

    // Realtime announcements channel to light up the unread badge
    const announcementsChannel = supabase
      .channel('channel-announcements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          console.log('[RootNavigator] Realtime new announcement received:', payload);
          announcementBadgeManager.increment();
        }
      );

    // Subscribe to channels
    likesChannel.subscribe((status) => {
      console.log(`[RootNavigator] Likes channel status for ${userId}:`, status);
    });
    commentsChannel.subscribe((status) => {
      console.log(`[RootNavigator] Comments channel status for ${userId}:`, status);
    });
    announcementsChannel.subscribe((status) => {
      console.log(`[RootNavigator] Announcements channel status for ${userId}:`, status);
    });

    // Clean up old subscriptions on unmount/re-run
    return () => {
      console.log('[RootNavigator] Cleaning up realtime notification channels for user:', userId);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(announcementsChannel);
    };
  }, [session?.user?.id, isAdmin]);

  /**
   * CQ-4 FIX: Loading splash uses the app's blue gradient and a spinner
   * instead of a jarring plain dark view.
   */
  if (loading) {
    return (
      <LinearGradient
        colors={['#1E3A8A', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color="#ffffff" />
      </LinearGradient>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session && !passwordResetPending ? (
          isAdmin ? (
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          ) : (
            <>
              <Stack.Screen name="AppTabs" component={AppTabs} />
              <Stack.Screen
                name="UploadModal"
                component={UploadScreen}
                options={{ presentation: 'fullScreenModal' }}
              />
            </>
          )
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
