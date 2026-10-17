import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        }
      });
      streamRef.current = stream;

      // Web Audio API context for frequency data
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder configuration
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setIsRecording(false);
        cleanupStreams();
      };

      mediaRecorder.start(250); // Slice every 250ms
      setIsRecording(true);

      // Duration countdown / counter (supports up to 30.0 seconds of continuous listening)
      const startTimestamp = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimestamp) / 1000;
        setRecordingDuration(Math.min(elapsed, 30.0));
        if (elapsed >= 30.0) {
          stopRecording();
        }
      }, 100);

    } catch (err) {
      console.error('Audio recorder mic error:', err);
      setError(err.message || 'Microphone access denied. Please grant microphone permission.');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const getSnapshotBlob = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
        const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
        if (audioChunksRef.current.length > 0) {
          return new Blob(audioChunksRef.current, { type: mimeType });
        }
      } catch (e) {
        console.warn('requestData error:', e);
      }
    }
    return null;
  }, []);

  const cleanupStreams = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const getAudioFrequencyData = useCallback(() => {
    if (!analyserRef.current) return new Uint8Array(0);
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    return dataArray;
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cleanupStreams();
    };
  }, [cleanupStreams]);

  return {
    isRecording,
    recordingDuration,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    getAudioFrequencyData,
    getSnapshotBlob,
    reset: () => {
      setAudioBlob(null);
      setError(null);
      setRecordingDuration(0);
    }
  };
}
