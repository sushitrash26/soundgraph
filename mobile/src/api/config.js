import { Platform } from 'react-native';

// Auto-detected Host LAN IP for physical device connection on local Wi-Fi
export const LOCAL_HOST_IP = '192.168.0.6';
export const PORT = 8001;

// Use cloud URL in production or local IP during development
export const API_BASE = 
  process.env.EXPO_PUBLIC_API_BASE ||
  Platform.select({
    android: `http://${LOCAL_HOST_IP}:${PORT}`,
    ios: `http://${LOCAL_HOST_IP}:${PORT}`,
    default: `http://${LOCAL_HOST_IP}:${PORT}`
  });

