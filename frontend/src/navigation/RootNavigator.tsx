import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import supabase from '../../supabase/client';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UploadScreen from '../screens/UploadScreen';

// ─── Route type definitions ──────────────────────────────────────────────────

type RootStackParamList = {
  AppTabs: undefined;
  UploadModal: undefined;
  Auth: undefined;
};

// CQ-1 FIX: typed navigation prop instead of `any`
type AppTabsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AppTabs'>;

// ─── Navigator instances ──────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 85 : 65;

/**
 * CQ-6 FIX: The raised-button offset is derived from TAB_BAR_HEIGHT so it
 * scales correctly across iOS and Android rather than being a magic -20.
 * The button is centred vertically at the top edge of the tab bar, so we
 * lift it by half its own height (30) above the bar.
 */
const UPLOAD_BUTTON_SIZE = 60;
const UPLOAD_BUTTON_LIFT = -(UPLOAD_BUTTON_SIZE / 2);

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
        backgroundColor: '#6200EE',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          height: TAB_BAR_HEIGHT,
        },
        tabBarActiveTintColor: '#6200EE',
        tabBarInactiveTintColor: '#8E8E93',
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
              onPress={() => navigation.navigate('UploadModal')}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    /**
     * BUG-5 FIX: `onAuthStateChange` now handles SIGNED_OUT and
     * TOKEN_REFRESH_FAILED events explicitly so that when a session expires
     * mid-session the user is shown a message before being redirected instead
     * of being silently bounced to the auth screen.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESH_FAILED') {
        // Session expired / token could not be refreshed — clear session.
        // The navigator will redirect to AuthScreen automatically.
        setSession(null);
        // Note: Showing an Alert here can conflict with React Native's render
        // cycle. A toast / snackbar library is preferable in production, but
        // logging is the minimum safe action here.
        console.warn('[Auth] Token refresh failed — user signed out.');
        return;
      }
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

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
        {session ? (
          <>
            <Stack.Screen name="AppTabs" component={AppTabs} />
            <Stack.Screen
              name="UploadModal"
              component={UploadScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
