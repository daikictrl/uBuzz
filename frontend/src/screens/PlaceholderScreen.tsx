import React from 'react';
import { View, Text } from 'react-native';

interface PlaceholderScreenProps {
  screenName?: string;
}

/**
 * CQ-3 FIX: Single shared placeholder used by all stub screens during
 * development. Replace each import with the real implementation when ready.
 */
export default function PlaceholderScreen({ screenName }: PlaceholderScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold">
        {screenName ? `${screenName} — ` : ''}Coming soon
      </Text>
    </View>
  );
}
