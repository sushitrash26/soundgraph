import { Platform } from 'react-native';

export const PORT = 8001;
// 192.168.0.6 connects physical phones over local Wi-Fi, while 127.0.0.1 works on local PC/ADB
export const LAN_HOST_IP = '192.168.0.6';
export const LOCAL_HOST_IP = '127.0.0.1';

export const API_BASE = 
  process.env.EXPO_PUBLIC_API_BASE || `http://${LAN_HOST_IP}:${PORT}`;

export const FALLBACK_API_BASE = `http://${LOCAL_HOST_IP}:${PORT}`;
