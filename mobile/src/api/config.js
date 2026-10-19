import { Platform } from 'react-native';

export const PORT = 8001;
// 127.0.0.1 works seamlessly via ADB reverse USB, while 192.168.0.6 works over local Wi-Fi
export const LOCAL_HOST_IP = '127.0.0.1';
export const LAN_HOST_IP = '192.168.0.6';

export const API_BASE = 
  process.env.EXPO_PUBLIC_API_BASE || `http://${LOCAL_HOST_IP}:${PORT}`;

export const FALLBACK_API_BASE = `http://${LAN_HOST_IP}:${PORT}`;
