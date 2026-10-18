import io
import os
import wave
import tempfile
import subprocess
import numpy as np
from scipy import signal
from typing import Tuple, Optional
from backend.core.logger import logger

class AcousticBusRouter:
    """
    Section 2: Dual-Bus Signal Pre-Processor & Normalizer.
    1. Decodes any input container (.m4a, .webm, .wav, .aac, .mp3) to 16kHz mono float32.
    2. Dynamic Range Normalization to target -20 dBFS RMS.
    3. Splits into:
       - Bus 1: High-Bandwidth Bus (High-Pass > 120Hz, up to 8kHz Nyquist) for Stream A & Stream C.
       - Bus 2: Vocal/Harmonic Bus (Bandpass 80Hz - 1200Hz + vocal formant emphasis) for Stream B & Stream D.
    """

    TARGET_SR = 16000
    TARGET_RMS = 0.1  # Approx -20 dBFS (where 1.0 peak = 0 dBFS)

    @classmethod
    def decode_and_normalize(cls, audio_bytes: bytes, mime_type: str = "audio/m4a") -> Optional[np.ndarray]:
        """Losslessly decodes audio bytes to 16kHz float32 PCM array in memory."""
        if not audio_bytes or len(audio_bytes) < 1000:
            logger.warning(f"AcousticBusRouter: Received audio bytes too small: {len(audio_bytes) if audio_bytes else 0} bytes")
            return None

        # Check for raw PCM stream
        if "pcm" in mime_type.lower():
            try:
                pcm = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                return cls._apply_drc_norm(pcm)
            except Exception:
                pass

        ext = ".m4a"
        if "webm" in mime_type.lower():
            ext = ".webm"
        elif "wav" in mime_type.lower() or audio_bytes.startswith(b"RIFF"):
            ext = ".wav"
        elif "mp3" in mime_type.lower():
            ext = ".mp3"
        elif "ogg" in mime_type.lower():
            ext = ".ogg"

        # 1. Primary decoder: Temporary file for full seekability (vital for MP4/M4A moov box at end)
        tmp_file = None
        try:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
                f.write(audio_bytes)
                tmp_path = f.name
                tmp_file = tmp_path

            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-y",
                "-i", tmp_path,
                "-f", "s16le",
                "-ac", "1",
                "-ar", str(cls.TARGET_SR),
                "pipe:1"
            ]
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, err = proc.communicate(timeout=15.0)
            if proc.returncode == 0 and out and len(out) > 0:
                pcm = np.frombuffer(out, dtype=np.int16).astype(np.float32) / 32768.0
                logger.info(f"AcousticBusRouter: Successfully decoded {len(pcm)} samples ({len(pcm)/cls.TARGET_SR:.2f}s) via seekable tempfile")
                return cls._apply_drc_norm(pcm)
            else:
                err_msg = err.decode(errors="ignore")[:200] if err else "empty output"
                logger.warning(f"AcousticBusRouter: FFmpeg tempfile decode (rc={proc.returncode}): {err_msg}")
        except Exception as e:
            logger.error(f"AcousticBusRouter: Exception in FFmpeg file decode: {e}")
        finally:
            if tmp_file and os.path.exists(tmp_file):
                try:
                    os.unlink(tmp_file)
                except Exception:
                    pass

        # 2. Secondary decoder: FFmpeg pipe (for streaming chunks)
        try:
            cmd = [
                "ffmpeg", "-hide_banner", "-loglevel", "error",
                "-i", "pipe:0",
                "-f", "s16le",
                "-ac", "1",
                "-ar", str(cls.TARGET_SR),
                "pipe:1"
            ]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, err = proc.communicate(input=audio_bytes, timeout=10.0)
            if proc.returncode == 0 and out and len(out) > 0:
                pcm = np.frombuffer(out, dtype=np.int16).astype(np.float32) / 32768.0
                logger.info(f"AcousticBusRouter: Decoded {len(pcm)} samples via pipe fallback")
                return cls._apply_drc_norm(pcm)
        except Exception as e:
            logger.debug(f"AcousticBusRouter: FFmpeg pipe decode failed: {e}")

        # 3. Wave fallback
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                sr = wf.getframerate()
                n_channels = wf.getnchannels()
                raw_frames = wf.readframes(wf.getnframes())
                pcm = np.frombuffer(raw_frames, dtype=np.int16).astype(np.float32) / 32768.0
                if n_channels > 1:
                    pcm = pcm.reshape(-1, n_channels).mean(axis=1)
                if sr != cls.TARGET_SR:
                    pcm = signal.resample_poly(pcm, cls.TARGET_SR, sr)
                return cls._apply_drc_norm(pcm)
        except Exception:
            pass

        return None

    @classmethod
    def _apply_drc_norm(cls, pcm: np.ndarray) -> np.ndarray:
        """Applies dynamic range compression and RMS normalization to -20 dBFS."""
        if len(pcm) == 0:
            return pcm
        rms = np.sqrt(np.mean(pcm ** 2)) + 1e-9
        gain = cls.TARGET_RMS / rms
        gain = np.clip(gain, 0.1, 15.0)  # Safe gain bounds
        normalized = pcm * gain
        # Soft-knee peak limiting
        return np.tanh(normalized)

    @classmethod
    def route_dual_buses(cls, pcm_normalized: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Splits normalized PCM into:
        - Bus 1: High-Pass > 120Hz (preserves full 8kHz bandwidth, transients, consonants)
        - Bus 2: Bandpass 80Hz - 1200Hz (vocal fundamental range, strips high-hats/sub-rumble)
        """
        sr = cls.TARGET_SR

        # Bus 1: Butterworth High-Pass at 120Hz (order 4)
        sos_hp = signal.butter(4, 120.0, btype="highpass", fs=sr, output="sos")
        bus_1 = signal.sosfilt(sos_hp, pcm_normalized)

        # Bus 2: Butterworth Bandpass 80Hz - 1200Hz (order 4)
        sos_bp = signal.butter(4, [80.0, 1200.0], btype="bandpass", fs=sr, output="sos")
        bus_2 = signal.sosfilt(sos_bp, pcm_normalized)

        return bus_1.astype(np.float32), bus_2.astype(np.float32)
