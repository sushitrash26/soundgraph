import os
import json
import tempfile
import subprocess
from typing import Optional, Dict, Any, Union
import numpy as np
from backend.core.logger import logger

class ShazamRecognizer:
    """
    Tier 1 Fast Acoustic Landmark Recognition Engine.
    Uses Shazam's constellation landmark hash algorithm via Node.js runtime.
    Identifies exact master tracks playing on speakers with 99% accuracy in ~1 second.
    """

    @classmethod
    def recognize(
        cls,
        audio_input: Union[bytes, np.ndarray],
        mime_type: str = "audio/m4a",
        timeout: float = 4.5
    ) -> Optional[Dict[str, Any]]:
        if audio_input is None:
            return None

        tmp_path = None
        try:
            if isinstance(audio_input, np.ndarray):
                if len(audio_input) < 16000:  # Less than 1 second of audio
                    return None
                # Convert float32 [-1.0, 1.0] to int16 PCM bytes
                pcm_s16 = (np.clip(audio_input, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes()
                with tempfile.NamedTemporaryFile(suffix=".pcm", delete=False) as tmp:
                    tmp.write(pcm_s16)
                    tmp.flush()
                    tmp_path = tmp.name
            elif isinstance(audio_input, bytes):
                if len(audio_input) < 4000:
                    return None
                ext = ".m4a"
                if "webm" in mime_type:
                    ext = ".webm"
                elif "wav" in mime_type:
                    ext = ".wav"
                elif "mp3" in mime_type:
                    ext = ".mp3"
                elif "pcm" in mime_type:
                    ext = ".pcm"

                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                    tmp.write(audio_input)
                    tmp.flush()
                    tmp_path = tmp.name
            else:
                return None

            script_path = os.path.join(os.path.dirname(__file__), "shazam_recognizer.js")
            backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

            res = subprocess.run(
                ["node", script_path, tmp_path],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=backend_dir
            )

            if res.returncode == 0 and res.stdout:
                out = res.stdout.strip()
                if out:
                    data = json.loads(out)
                    if data.get("status") == "match" and data.get("title"):
                        logger.info(
                            f"ShazamRecognizer: Exact match found -> '{data['title']}' by '{data.get('artist')}'"
                        )
                        return data
        except Exception as e:
            logger.warning(f"ShazamRecognizer: Recognition check note: {e}")
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
        return None
