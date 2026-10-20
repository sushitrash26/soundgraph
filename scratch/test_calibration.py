import numpy as np
from scipy import stats
from backend.core.neo4j_driver import neo4j_conn
from backend.embeddings.gemini_embedder import GeminiEmbedder

# 5 anchor pairs per feature
ANCHOR_PAIRS = {
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

def precompute_anchors():
    anchor_vecs = {}
    for feat, pairs in ANCHOR_PAIRS.items():
        feat_pairs = []
        for pos_txt, neg_txt in pairs:
            pv = GeminiEmbedder.embed_text_sync(pos_txt)
            nv = GeminiEmbedder.embed_text_sync(neg_txt)
            if pv and nv:
                p_arr = np.array(pv, dtype=np.float32)
                p_arr /= (np.linalg.norm(p_arr) + 1e-9)
                n_arr = np.array(nv, dtype=np.float32)
                n_arr /= (np.linalg.norm(n_arr) + 1e-9)
                feat_pairs.append((p_arr, n_arr))
        anchor_vecs[feat] = feat_pairs
    return anchor_vecs

def compute_raw_score(vec, feat_pairs):
    v = np.array(vec, dtype=np.float32)
    v /= (np.linalg.norm(v) + 1e-9)
    diffs = [float(np.dot(v, p) - np.dot(v, n)) for p, n in feat_pairs]
    return float(np.mean(diffs))

def run_test():
    anchors = precompute_anchors()
    print("Precomputed anchor pairs for:", list(anchors.keys()))
    
    # Fetch ground truth tracks
    gt_rows = neo4j_conn.query('''
        MATCH (t:Track) WHERE t.tempo IS NOT NULL AND t.embedding IS NOT NULL
        RETURN t.id as id, t.name as name, t.energy as energy, t.valence as valence,
               t.danceability as danceability, t.acousticness as acousticness, t.embedding as embedding
    ''')
    print(f"Fetched {len(gt_rows)} ground truth tracks.")

    for feat in ["energy", "valence", "danceability", "acousticness"]:
        proxy_raws = []
        true_vals = []
        for r in gt_rows:
            raw = compute_raw_score(r['embedding'], anchors[feat])
            true_val = r[feat]
            if true_val is not None:
                proxy_raws.append(raw)
                true_vals.append(true_val)
        
        # Spearman correlation
        rho, pval = stats.spearmanr(proxy_raws, true_vals)
        # 1000 bootstrap resamples for 95% CI
        n = len(proxy_raws)
        boot_rhos = []
        np.random.seed(42)
        for _ in range(1000):
            idx = np.random.choice(n, size=n, replace=True)
            r_b, _ = stats.spearmanr(np.array(proxy_raws)[idx], np.array(true_vals)[idx])
            if not np.isnan(r_b):
                boot_rhos.append(r_b)
        ci_low = np.percentile(boot_rhos, 2.5) if boot_rhos else 0.0
        ci_high = np.percentile(boot_rhos, 97.5) if boot_rhos else 0.0
        print(f"Feature: {feat:<12} | Spearman rho: {rho:+.3f} (p={pval:.4f}) | 95% CI: [{ci_low:+.3f}, {ci_high:+.3f}]")

if __name__ == "__main__":
    run_test()
