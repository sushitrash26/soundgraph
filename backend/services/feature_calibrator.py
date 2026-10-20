"""
Acoustic Feature Calibrator (Workstream W5 Part A).
Resolves F-06, F-21, F-31, F-32:
1. Multi-anchor ensemble projection (>= 5 bipolar anchor pairs per acoustic axis).
2. Percentile ranking across catalog to uncompress features into uniform [0.01, 0.99].
3. Rigorous validation against Spotify ground truth reporting Spearman rho and 95% bootstrap CIs.
4. Source and confidence tagging:
   - 'spotify': confidence = 1.0 (real audio features)
   - 'text_proxy': confidence = 0.65 (calibrated semantic differential)
   - 'audio': confidence = 0.90 (future Essentia extraction)
5. Non-circularity: raw scores and calibrated features stored separately.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
from scipy import stats
from backend.core.neo4j_driver import neo4j_conn
from backend.core.logger import logger
from backend.embeddings.gemini_embedder import GeminiEmbedder

# 5 curated bipolar anchor pairs per acoustic axis
ENSEMBLE_ANCHORS = {
    "energy": [
        ("intense loud explosive uptempo energetic high-bpm aggressive driving music",
         "quiet mellow gentle calm acoustic slow ambient peaceful relaxing music"),
        ("hard hitting powerful thunderous distorted wall of sound high energy",
         "soft delicate whisper quiet sparse soothing lullaby"),
        ("fast frenetic chaotic pounding beats stadium anthem high velocity",
         "slow laidback tranquil sleepy meditative drifting atmospheric soundscape"),
        ("electrifying punchy soaring adrenaline heavy bass drops",
         "muted subtle understated warm background acoustic piano"),
        ("blistering intense raw kinetic peak volume rock festival",
         "serene still peaceful hush intimate bedroom folk")
    ],
    "valence": [
        ("happy euphoric joyful cheerful optimistic vibrant sunny celebratory mood",
         "sad melancholic depressing sorrowful gloomy moody dark emotional heartache"),
        ("uplifting triumphant hopeful radiant smiling warm uplifting sunshine",
         "somber grieving desolate tragic hopeless heartbreak teardrop grief"),
        ("fun carefree playful breezy delightful ecstatic blissful groove",
         "crying agony despair brooding bleak agonizing loneliness"),
        ("bright energetic euphoria pure happiness feel-good dance celebration",
         "dark funeral mournful sorrowful weeping deep sorrow depression"),
        ("optimistic joyful smile uplifting pleasant sweet sunny afternoon",
         "pessimistic haunted regretful tearful painful grief-stricken dark thoughts")
    ],
    "danceability": [
        ("infectious danceable club rhythm groove regular beat syncopated dance music",
         "ambient freeform non-rhythmic abstract fluid unstructured drone soundscape"),
        ("driving four-on-the-floor disco funk beat strong rhythmic pulse dancing",
         "irregular floating rubato classical avant-garde shapeless tempo"),
        ("groovy syncopated hip hop dancehall bouncy drum groove dance floor",
         "slow atmospheric drone ambient wash no rhythm no percussion"),
        ("irresistible body movement steady tempo infectious groove club banger",
         "erratic unmetered experimental noise sound art without pulse"),
        ("tight rhythmic bassline crisp snare swing bouncy rhythm party dance",
         "static sustained drone tonal ambient meditation sound bath")
    ],
    "acousticness": [
        ("pure acoustic unplugged raw wooden instruments vocal acoustic guitar piano orchestra",
         "heavily synthesized electronic digital synthesizer computerized vocoder autotune distorted"),
        ("natural wooden resonance intimate acoustic guitar live upright bass chamber strings",
         "cyberpunk EDM synth bass synthetic drum machine electronic plugins"),
        ("organic live acoustic performance nylon string guitar unplugged upright piano",
         "futuristic synthetic arpeggiator dubstep wobble bass computerized beats"),
        ("authentic organic folk acoustic instrumentation wooden percussion fingers on strings",
         "techno industrial electronic processing synthesized leads digital glitch"),
        ("warm natural room acoustics unprocessed live acoustic guitar and grand piano",
         "heavily processed digital sound effects electronic virtual synths automated DAWs")
    ]
}


class FeatureCalibrator:
    """Service to calibrate, validate, and tag acoustic features across the catalog."""

    _cached_anchor_vectors: Optional[Dict[str, List[Tuple[np.ndarray, np.ndarray]]]] = None

    @classmethod
    def get_anchor_vectors(cls) -> Dict[str, List[Tuple[np.ndarray, np.ndarray]]]:
        """Precomputes and L2-normalizes anchor vector pairs across all axes."""
        if cls._cached_anchor_vectors is not None:
            return cls._cached_anchor_vectors

        anchors: Dict[str, List[Tuple[np.ndarray, np.ndarray]]] = {}
        for feat, pairs in ENSEMBLE_ANCHORS.items():
            feat_pairs: List[Tuple[np.ndarray, np.ndarray]] = []
            for pos_text, neg_text in pairs:
                pv = GeminiEmbedder.embed_text_sync(pos_text)
                nv = GeminiEmbedder.embed_text_sync(neg_text)
                if pv and nv:
                    p_arr = np.array(pv, dtype=np.float32)
                    p_arr /= (np.linalg.norm(p_arr) + 1e-9)
                    n_arr = np.array(nv, dtype=np.float32)
                    n_arr /= (np.linalg.norm(n_arr) + 1e-9)
                    feat_pairs.append((p_arr, n_arr))
            anchors[feat] = feat_pairs

        cls._cached_anchor_vectors = anchors
        return cls._cached_anchor_vectors

    @classmethod
    def compute_raw_scores(cls, vec: List[float]) -> Dict[str, float]:
        """
        Computes raw ensemble differential scores s_j = cos(e, pos_j) - cos(e, neg_j)
        averaged across all anchor pairs per feature.
        """
        if not vec or len(vec) != 768:
            return {f"{k}_raw": 0.0 for k in ENSEMBLE_ANCHORS.keys()}

        v = np.array(vec, dtype=np.float32)
        v_norm = np.linalg.norm(v)
        if v_norm == 0:
            return {f"{k}_raw": 0.0 for k in ENSEMBLE_ANCHORS.keys()}
        v /= v_norm

        anchors = cls.get_anchor_vectors()
        raw_scores: Dict[str, float] = {}
        for feat, pairs in anchors.items():
            if not pairs:
                raw_scores[f"{feat}_raw"] = 0.0
                continue
            diffs = [float(np.dot(v, p) - np.dot(v, n)) for p, n in pairs]
            raw_scores[f"{feat}_raw"] = float(np.mean(diffs))

        return raw_scores

    @classmethod
    def validate_ground_truth(cls, tracks_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validates proxy predictions against ground truth tracks (tempo IS NOT NULL).
        Reports Spearman rho and 1000-resample bootstrap 95% confidence intervals.
        """
        gt_tracks = [t for t in tracks_data if t.get("tempo") is not None and t.get("embedding")]
        report: Dict[str, Any] = {
            "n_ground_truth": len(gt_tracks),
            "features": {}
        }

        if len(gt_tracks) < 5:
            logger.warning(f"Too few ground truth tracks for validation: {len(gt_tracks)}")
            return report

        for feat in ["energy", "valence", "danceability", "acousticness"]:
            proxy_raws = []
            true_vals = []
            for t in gt_tracks:
                raw = t.get(f"{feat}_raw")
                true_val = t.get(feat)
                if raw is not None and true_val is not None:
                    proxy_raws.append(float(raw))
                    true_vals.append(float(true_val))

            if len(proxy_raws) >= 5:
                rho, pval = stats.spearmanr(proxy_raws, true_vals)
                # 1000 bootstrap resamples for 95% CI
                np.random.seed(42)
                boot_rhos = []
                n = len(proxy_raws)
                for _ in range(1000):
                    idx = np.random.choice(n, size=n, replace=True)
                    r_b, _ = stats.spearmanr(np.array(proxy_raws)[idx], np.array(true_vals)[idx])
                    if not np.isnan(r_b):
                        boot_rhos.append(float(r_b))
                ci_low = float(np.percentile(boot_rhos, 2.5)) if boot_rhos else float(rho)
                ci_high = float(np.percentile(boot_rhos, 97.5)) if boot_rhos else float(rho)

                report["features"][feat] = {
                    "spearman_rho": round(float(rho), 3),
                    "p_value": round(float(pval), 5),
                    "ci_95": [round(ci_low, 3), round(ci_high, 3)],
                    "sample_size": n
                }

        return report

    @classmethod
    def calibrate_and_persist_catalog(cls) -> Dict[str, Any]:
        """
        Main pipeline execution:
        1. Query all tracks from Neo4j.
        2. Compute raw ensemble differentials for all tracks with embeddings.
        3. Validate against ground truth.
        4. Compute empirical percentile ranking across catalog to map into [0.01, 0.99].
        5. Tag feature_source and feature_confidence:
           - Ground truth (tempo is present): feature_source='spotify', feature_confidence=1.0
           - Others: feature_source='text_proxy', feature_confidence=0.65
        6. Persist updates to Neo4j.
        """
        logger.info("Starting Catalog Acoustic Calibration (W5 Part A)...")
        # 1. Fetch tracks
        query = """
        MATCH (t:Track)
        RETURN t.id as id, t.name as name, t.tempo as tempo,
               t.energy as energy, t.valence as valence,
               t.danceability as danceability, t.acousticness as acousticness,
               t.embedding as embedding
        """
        rows = neo4j_conn.query(query)
        logger.info(f"Retrieved {len(rows)} tracks from Neo4j.")

        tracks: List[Dict[str, Any]] = []
        for r in rows:
            t = dict(r)
            if t.get("embedding"):
                raws = cls.compute_raw_scores(t["embedding"])
                t.update(raws)
            tracks.append(t)

        # 2. Validate ground truth
        val_report = cls.validate_ground_truth(tracks)
        logger.info(f"Ground truth validation report: {val_report}")

        # 3. Percentile ranking across catalog for each feature
        features = ["energy", "valence", "danceability", "acousticness"]
        valid_tracks = [t for t in tracks if t.get("embedding")]
        n_valid = len(valid_tracks)

        for feat in features:
            raw_key = f"{feat}_raw"
            # Sort tracks by raw score
            valid_tracks.sort(key=lambda x: x.get(raw_key, 0.0))
            for rank_idx, t in enumerate(valid_tracks):
                # Fractional rank normalized to [0.01, 0.99]
                pct = (rank_idx + 0.5) / n_valid
                pct = float(np.clip(pct, 0.01, 0.99))
                t[f"{feat}_calibrated"] = round(pct, 3)

        # 4. Prepare batch updates for Neo4j
        updates = []
        for t in tracks:
            is_spotify = t.get("tempo") is not None
            source = "spotify" if is_spotify else "text_proxy"
            confidence = 1.0 if is_spotify else 0.65

            update_item = {
                "id": t["id"],
                "feature_source": source,
                "feature_confidence": confidence,
                "energy_raw": t.get("energy_raw"),
                "valence_raw": t.get("valence_raw"),
                "danceability_raw": t.get("danceability_raw"),
                "acousticness_raw": t.get("acousticness_raw"),
            }

            if is_spotify:
                # Keep original ground truth values
                update_item["energy"] = t.get("energy")
                update_item["valence"] = t.get("valence")
                update_item["danceability"] = t.get("danceability")
                update_item["acousticness"] = t.get("acousticness")
            else:
                # Use calibrated percentile values
                update_item["energy"] = t.get("energy_calibrated", 0.50)
                update_item["valence"] = t.get("valence_calibrated", 0.50)
                update_item["danceability"] = t.get("danceability_calibrated", 0.50)
                update_item["acousticness"] = t.get("acousticness_calibrated", 0.50)

            updates.append(update_item)

        # 5. Persist to Neo4j in batches of 100
        batch_size = 100
        update_cypher = """
        UNWIND $batch as row
        MATCH (t:Track {id: row.id})
        SET t.feature_source = row.feature_source,
            t.feature_confidence = row.feature_confidence,
            t.energy_raw = row.energy_raw,
            t.valence_raw = row.valence_raw,
            t.danceability_raw = row.danceability_raw,
            t.acousticness_raw = row.acousticness_raw,
            t.energy = row.energy,
            t.valence = row.valence,
            t.danceability = row.danceability,
            t.acousticness = row.acousticness
        """

        total_updated = 0
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]
            neo4j_conn.query(update_cypher, {"batch": batch})
            total_updated += len(batch)

        logger.info(f"Successfully calibrated and updated {total_updated} tracks in Neo4j.")

        # Compute summary distribution stats for verification
        calibrated_stats = {}
        for feat in features:
            cal_vals = [u[feat] for u in updates if u.get(feat) is not None]
            if cal_vals:
                calibrated_stats[feat] = {
                    "min": round(float(np.min(cal_vals)), 3),
                    "p25": round(float(np.percentile(cal_vals, 25)), 3),
                    "mean": round(float(np.mean(cal_vals)), 3),
                    "median": round(float(np.median(cal_vals)), 3),
                    "p75": round(float(np.percentile(cal_vals, 75)), 3),
                    "max": round(float(np.max(cal_vals)), 3)
                }

        return {
            "total_tracks": len(tracks),
            "updated_tracks": total_updated,
            "spotify_ground_truth_count": len([u for u in updates if u["feature_source"] == "spotify"]),
            "text_proxy_count": len([u for u in updates if u["feature_source"] == "text_proxy"]),
            "validation_report": val_report,
            "calibrated_distributions": calibrated_stats
        }
