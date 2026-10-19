import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AmbientGlassBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Base warm espresso gradient */}
      <LinearGradient
        colors={['#18120F', '#0E0C0B', '#140E0A']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Warm Golden Hour Top-Right Bokeh */}
      <View style={styles.topRightGlow} />

      {/* Soft Terracotta Center Bokeh */}
      <View style={styles.centerLeftGlow} />

      {/* Deep Amber Bottom Right Bokeh */}
      <View style={styles.bottomGlow} />
    </View>
  );
}

const styles = StyleSheet.create({
  topRightGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    filter: 'blur(80px)'
  },
  centerLeftGlow: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.35,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    filter: 'blur(90px)'
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -40,
    right: 20,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(217, 119, 6, 0.16)',
    filter: 'blur(80px)'
  }
});
