import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Aspect Ratio Sizing (Option 3) ───────────────────────────────────────────
const SCREEN_RATIO = SCREEN_HEIGHT / SCREEN_WIDTH;
const TARGET_RATIO = 16 / 9;

let VIDEO_WIDTH = SCREEN_WIDTH;
let VIDEO_HEIGHT = SCREEN_HEIGHT;

if (SCREEN_RATIO > TARGET_RATIO) {
  // Screen is taller than 9:16 (modern vertical screens) -> fit width
  VIDEO_HEIGHT = SCREEN_WIDTH * TARGET_RATIO;
  VIDEO_WIDTH = SCREEN_WIDTH;
} else {
  // Screen is wider than 9:16 (tablets, landscape) -> fit height
  VIDEO_WIDTH = SCREEN_HEIGHT / TARGET_RATIO;
  VIDEO_HEIGHT = SCREEN_HEIGHT;
}


export default function SkeletonCard() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {/* simulated video area background */}
      <Animated.View style={[styles.shimmerBg, { opacity: pulseAnim }]} />

      {/* Action buttons (bottom right) */}
      <View style={styles.actionsColumn}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.actionItem}>
            <Animated.View style={[styles.actionButtonCircle, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.actionCountLine, { opacity: pulseAnim }]} />
          </View>
        ))}
      </View>

      {/* Info area (bottom left) */}
      <View style={styles.infoArea}>
        <View style={styles.userRow}>
          <Animated.View style={[styles.avatarPlaceholder, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.usernamePlaceholder, { opacity: pulseAnim }]} />
        </View>
        <Animated.View style={[styles.captionLine1, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.captionLine2, { opacity: pulseAnim }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#0a0a0a',
    position: 'relative',
  },
  shimmerBg: {
    position: 'absolute',
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    left: (SCREEN_WIDTH - VIDEO_WIDTH) / 2,
    top: (SCREEN_HEIGHT - VIDEO_HEIGHT) / 2,
    backgroundColor: '#1a1a1a',
  },
  actionsColumn: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    alignItems: 'center',
    gap: 24,
  },
  actionItem: {
    alignItems: 'center',
    gap: 6,
  },
  actionButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
  },
  actionCountLine: {
    width: 24,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2a2a2a',
  },
  infoArea: {
    position: 'absolute',
    bottom: 90,
    left: 12,
    right: 80,
    gap: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2a2a2a',
  },
  usernamePlaceholder: {
    width: 100,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2a2a2a',
  },
  captionLine1: {
    width: '70%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
  },
  captionLine2: {
    width: '45%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
  },
});
