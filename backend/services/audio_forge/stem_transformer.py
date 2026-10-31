import os
import re
import json
import httpx
import numpy as np
import scipy.io.wavfile as wavfile
from scipy.signal import butter, sosfilt
import librosa
from typing import Dict, Any, Tuple, Optional
from backend.core.config import settings
from backend.core.logger import logger
from backend.services.audio_forge.taste_styler import TasteStyler
from backend.models.audio_forge import StemTransformResponse

GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"

class StemTransformer:
    """
    Phase 4B: DSP Audio Transformation Engine (100% Free, Zero GPU, CPU-Optimized).
    Applies pitch shifts, non-linear analog saturation, multi-band parametric filters,
    spatial reverb, and delay based on user taste centroid or natural language prompts.
    """

    @classmethod
    async def transform_stem(
        cls,
        stem_path: str,
        output_path: str,
        mode: str = "taste",
        user_id: Optional[str] = None,
        prompt: Optional[str] = None,
        instrument: str = "other",
        stem_energy: float = 0.5
    ) -> StemTransformResponse:
        """Transforms an audio stem file according to user taste or a text prompt."""
        if not os.path.exists(stem_path):
            raise FileNotFoundError(f"Source stem not found at {stem_path}")

        # Derive DSP parameters based on mode
        if mode == "taste":
            resolved_uid = user_id or "guest_user"
            dsp_params, desc = TasteStyler.derive_dsp_parameters_from_taste(
                user_id=resolved_uid,
                instrument=instrument,
                stem_energy=stem_energy
            )
        else:
            dsp_params, desc = await cls._prompt_to_dsp_params(prompt or "warm analog tone", instrument)

        # Apply DSP pipeline in memory
        cls._apply_dsp_pipeline(stem_path, output_path, dsp_params)

        stem_id = os.path.splitext(os.path.basename(stem_path))[0]
        out_id = os.path.splitext(os.path.basename(output_path))[0]

        return StemTransformResponse(
            original_stem_id=stem_id,
            transformed_stem_id=out_id,
            transformed_file_url=output_path,
            applied_parameters=dsp_params,
            description=desc
        )

    @classmethod
    async def _prompt_to_dsp_params(cls, prompt: str, instrument: str) -> Tuple[Dict[str, Any], str]:
        """Translates user text prompt into exact deterministic DSP parameters via Gemini or rule mapping."""
        api_key = settings.GEMINI_API_KEY
        if api_key and len(api_key) > 5:
            try:
                system_prompt = (
                    "You are a master audio DSP engineer. "
                    "Map the user's music transformation prompt into exact audio DSP parameters for this instrument. "
                    "Output ONLY valid JSON matching this schema: "
                    "{"
                    "  \"pitch_shift_semitones\": 0,"
                    "  \"lowpass_cutoff_hz\": 0,"
                    "  \"highshelf_gain_db\": 0.0,"
                    "  \"saturation_gain_db\": 0.0,"
                    "  \"reverb_wet\": 0.2,"
                    "  \"delay_time_ms\": 0,"
                    "  \"description\": \"brief summary of changes\""
                    "}"
                )
                payload = {
                    "contents": [
                        {"parts": [{"text": f"Instrument: {instrument}\nUser prompt: {prompt}"}]}
                    ],
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2}
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(f"{GEMINI_GENERATE_URL}?key={api_key}", json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        raw_json = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        parsed = json.loads(raw_json)
                        desc = parsed.pop("description", f"Transformed according to prompt: '{prompt}'")
                        return parsed, desc
            except Exception as e:
                logger.warning(f"StemTransformer: Gemini prompt translation failed: {e}")

        # Deterministic rule fallback based on prompt keywords
        p = prompt.lower()
        params = {
            "pitch_shift_semitones": 0,
            "lowpass_cutoff_hz": 0,
            "highshelf_gain_db": 0.0,
            "saturation_gain_db": 0.0,
            "reverb_wet": 0.15,
            "delay_time_ms": 0
        }
        
        desc_parts = []
        if "electric" in p or "distort" in p or "rock" in p or "drive" in p:
            params["saturation_gain_db"] = 6.0
            params["lowpass_cutoff_hz"] = 3800  # Guitar cabinet simulation filter
            params["reverb_wet"] = 0.25
            desc_parts.append("Applied overdriven tube saturation (+6dB) and guitar cabinet response.")
        
        if "warm" in p or "acoustic" in p or "vintage" in p or "lofi" in p:
            params["lowpass_cutoff_hz"] = 4200
            params["saturation_gain_db"] = 2.5
            params["reverb_wet"] = 0.30
            desc_parts.append("Added vintage warmth with gentle tape saturation and low-pass roll-off.")

        if "reverb" in p or "ambient" in p or "dreamy" in p or "space" in p:
            params["reverb_wet"] = 0.50
            params["delay_time_ms"] = 300
            desc_parts.append("Created lush spatial depth with 50% wet plate reverb and stereo echo.")

        if "bright" in p or "crisp" in p:
            params["highshelf_gain_db"] = 4.0
            desc_parts.append("Boosted high frequencies for crisp presence.")

        if not desc_parts:
            desc_parts.append(f"Customized stem characteristics based on: '{prompt}'.")

        return params, " ".join(desc_parts)

    @classmethod
    def _apply_dsp_pipeline(cls, in_wav: str, out_wav: str, p: Dict[str, Any]):
        """Executes DSP modifications in-memory and writes out the processed WAV."""
        y, sr = librosa.load(in_wav, sr=44100, mono=False)
        is_stereo = (y.ndim == 2)
        if not is_stereo:
            y = np.stack([y, y])

        # 1. Pitch shift if requested
        semitones = p.get("pitch_shift_semitones", 0)
        if semitones != 0:
            for ch in range(y.shape[0]):
                y[ch] = librosa.effects.pitch_shift(y[ch], sr=sr, n_steps=semitones)

        # 2. Non-linear analog saturation / overdrive (tanh soft clipping)
        drive_db = float(p.get("saturation_gain_db", 0.0))
        if drive_db > 0.1:
            drive_linear = 10.0 ** (drive_db / 20.0)
            y = np.tanh(y * drive_linear) / np.tanh(drive_linear)

        # 3. Low-pass filter (warmth / cabinet roll-off)
        lp_cutoff = float(p.get("lowpass_cutoff_hz", 0))
        if 200 < lp_cutoff < (sr / 2 - 500):
            sos_lp = butter(4, lp_cutoff, 'low', fs=sr, output='sos')
            for ch in range(y.shape[0]):
                y[ch] = sosfilt(sos_lp, y[ch])

        # 4. High-shelf presence boost
        hs_gain_db = float(p.get("highshelf_gain_db", 0.0))
        if abs(hs_gain_db) > 0.2:
            # High-shelf emulation via highpass split and gain
            sos_hs = butter(2, 6000, 'high', fs=sr, output='sos')
            gain_factor = (10.0 ** (hs_gain_db / 20.0)) - 1.0
            for ch in range(y.shape[0]):
                highs = sosfilt(sos_hs, y[ch])
                y[ch] = y[ch] + highs * gain_factor

        # 5. Spatial Reverb & Delay emulation
        reverb_wet = float(p.get("reverb_wet", 0.0))
        delay_ms = float(p.get("delay_time_ms", 0.0))

        if delay_ms > 10.0:
            delay_samples = int(sr * (delay_ms / 1000.0))
            if delay_samples < y.shape[1]:
                delayed = np.zeros_like(y)
                delayed[:, delay_samples:] = y[:, :-delay_samples] * 0.4
                y = y + delayed

        if reverb_wet > 0.05:
            # Multi-tap comb filter reverb emulation
            delays = [int(sr * 0.029), int(sr * 0.037), int(sr * 0.041), int(sr * 0.043)]
            rev_signal = np.zeros_like(y)
            for d in delays:
                if d < y.shape[1]:
                    rev_signal[:, d:] += y[:, :-d] * 0.25
            y = (1.0 - reverb_wet) * y + reverb_wet * rev_signal

        # Normalize to prevent digital clipping
        peak = np.max(np.abs(y))
        if peak > 0.98:
            y = (y / peak) * 0.95

        # Write output WAV (samples, channels)
        y_out = y.T
        y_int16 = (np.clip(y_out, -1.0, 1.0) * 32767.0).astype(np.int16)
        os.makedirs(os.path.dirname(out_wav), exist_ok=True)
        wavfile.write(out_wav, sr, y_int16)
