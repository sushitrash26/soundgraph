import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8001";

type IconProps = {
  name: "arrow" | "share" | "spark" | "headphones" | "route" | "user" | "home" | "compass" | "transfer" | "close";
  className?: string;
};

const defaultArtists = [
  {
    rank: "01",
    name: "Kendrick Lamar",
    genre: "Hip Hop",
    image: "https://cdn-images.dzcdn.net/images/artist/be0a7c550567f4af0ed202d7235b74d6/500x500-000000-80-0-0.jpg",
  },
  {
    rank: "02",
    name: "The Weeknd",
    genre: "R&B / Synthpop",
    image: "https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/500x500-000000-80-0-0.jpg",
  },
  {
    rank: "03",
    name: "Kanye West",
    genre: "Art Pop",
    image: "https://cdn-images.dzcdn.net/images/artist/bb76c2ee3b068726ab4c37b0aabdb57a/500x500-000000-80-0-0.jpg",
  },
  {
    rank: "04",
    name: "Daft Punk",
    genre: "Electronic",
    image: "https://cdn-images.dzcdn.net/images/artist/638e69b9caaf9f9f3f8826febea7b543/500x500-000000-80-0-0.jpg",
  },
];

function Icon({ name, className = "size-5" }: IconProps) {
  const paths = {
    arrow: <path d="m15 18-6-6 6-6" />,
    share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4" /></>,
    spark: <><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z" /><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14ZM5 14l.6 1.8L7.5 17l-1.9.6L5 19.5l-.6-1.9L2.5 17l1.9-1.2L5 14Z" /></>,
    headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M18 19h-1a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h3v3a3 3 0 0 1-3 3ZM6 19H5a3 3 0 0 1-3-3v-3h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2Z" /></>,
    route: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 6h5a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
    transfer: <><path d="M7 7h13l-3-3M17 17H4l3 3" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function ShareSheet({ onClose, profileData }: { onClose: () => void; profileData: any }) {
  const [copied, setCopied] = useState(false);

  const userName = profileData?.user?.name || "Sound Explorer";
  const archetype = profileData?.passport?.archetype || "Midnight Explorer";
  const shareUrl = profileData?.passport?.share_url || window.location.href;
  const artists = profileData?.top_artists || defaultArtists;
  const artistsStr = artists.slice(0, 3).map((a: any) => a.name).join(" · ");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard access can be unavailable in embedded previews.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Share music passport">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close share sheet" />
      <div className="glass-panel glass-strong relative w-full max-w-md rounded-[2rem] p-3 shadow-2xl animate-sheet">
        <div className="relative overflow-hidden rounded-[1.55rem] bg-[#d7ff64] p-6 text-[#11120e]">
          <div className="absolute -right-12 -top-16 size-48 rounded-full bg-[#8b5cf6] blur-[2px] opacity-90" />
          <div className="absolute -bottom-20 -left-12 size-48 rounded-full bg-[#ff7557] blur-[2px] opacity-90" />
          <div className="relative">
            <div className="mb-16 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.22em]">Music passport</span>
              <span className="rounded-full bg-black/10 px-3 py-1 text-[10px] font-bold">2025</span>
            </div>
            <p className="text-sm font-semibold opacity-70">{userName}’s sound is</p>
            <h2 className="mt-1 max-w-[12ch] text-5xl font-semibold leading-[0.9] tracking-[-0.055em]">A {archetype.toLowerCase()}.</h2>
            <div className="mt-10 flex items-end justify-between border-t border-black/15 pt-4">
              <p className="max-w-[18ch] text-xs font-semibold leading-relaxed">{artistsStr}</p>
              <p className="text-right text-[10px] font-bold uppercase tracking-wider">made with<br />SoundGraph</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-2 pt-4">
          <button onClick={copyLink} className="h-12 flex-1 rounded-full bg-white font-semibold text-black transition hover:bg-[#d7ff64]">
            {copied ? "Link copied" : "Copy profile link"}
          </button>
          <button onClick={onClose} className="grid size-12 place-items-center rounded-full border border-white/10 text-white transition hover:bg-white/10" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileScreen({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [shareOpen, setShareOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLiveProfile() {
      try {
        const res = await fetch(`${API_BASE}/profile/me`);
        const json = await res.json();
        if (json?.status === "success") {
          setProfileData(json);
        }
      } catch (err) {
        console.warn("Could not fetch real-time profile from API:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLiveProfile();
  }, []);

  const user = profileData?.user || {
    name: "Sound Explorer",
    avatar_url: defaultArtists[0].image,
    connected_platforms: ["spotify", "youtube"],
    updated_at: "Updated today"
  };

  const passport = profileData?.passport || {
    archetype: "Midnight Explorer",
    tagline: "Dreamy vocals, late-night R&B and a little beautiful chaos.",
    share_url: window.location.href
  };

  const topArtists = profileData?.top_artists && profileData.top_artists.length >= 2
    ? profileData.top_artists
    : defaultArtists;

  const signature = profileData?.signature;
  const currentSignature = signature ? signature[period] : null;
  const discoveryScore = currentSignature ? currentSignature.discovery_score : (period === "month" ? 82 : 76);
  const discoveryTag = currentSignature ? currentSignature.tag : "Explorer";
  const sliders = currentSignature ? currentSignature.sliders.map((s: any) => [s.start, s.end, s.value]) : [
    ["Analog Strings", "Digital Synths", period === "month" ? 75 : 70],
    ["Introspective Calm", "Kinetic Rapture", period === "month" ? 65 : 59],
    ["Underground Crates", "Stadium Anthems", period === "month" ? 95 : 90],
  ];

  const migration = profileData?.migration || {
    tracks_moved: 0,
    hours_preserved: "0 hrs",
    perfect_transfers: 0,
    has_migrated: false
  };

  const featuredBadge = profileData?.featured_badge || {
    title: "Bridge Builder",
    rarity_tag: "TOP 8% RARE",
    description: "Moved over 1,000 tracks between worlds."
  };

  return (
    <div className="app-shell min-h-screen text-[#f4f3ee] selection:bg-[#d7ff64] selection:text-black">
      <div className="ambient-orb ambient-orb-one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-two" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-three" aria-hidden="true" />
      <div className="noise-layer" aria-hidden="true" />
      <main className="relative z-10 mx-auto min-h-screen max-w-md overflow-hidden pb-28">
        <header className="flex items-center justify-between px-5 pb-4 pt-6">
          <button onClick={onBack} className="glass-control grid size-11 place-items-center rounded-full transition hover:-translate-y-0.5" aria-label="Go back">
            <Icon name="arrow" />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">Your profile</p>
          <button onClick={() => setShareOpen(true)} className="grid size-11 place-items-center rounded-full bg-[#d7ff64] text-black transition hover:scale-105" aria-label="Share profile">
            <Icon name="share" />
          </button>
        </header>

        <section className="px-5 pt-4">
          <div className="glass-panel glass-hero glass-shimmer relative min-h-[490px] overflow-hidden rounded-[2rem] p-5">
            <div className="aurora absolute -right-16 top-0 size-72 rounded-full opacity-80" />
            <div className="absolute -bottom-36 -left-20 size-72 rounded-full bg-[#b8f23d]/25 blur-3xl" />
            <div className="relative flex items-start justify-between">
              <div className="relative">
                <img
                  src={user.avatar_url || topArtists[0]?.image}
                  alt={`${user.name}'s profile`}
                  className="size-20 rounded-2xl object-cover object-top grayscale-[15%]"
                />
                <span className="profile-spark absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-full border-4 border-[#252521] bg-[#d7ff64] text-black">
                  <Icon name="spark" className="size-4" />
                </span>
              </div>
              <span className="rounded-full border border-white/15 bg-black/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 backdrop-blur-md">
                {user.updated_at || "Updated today"}
              </span>
            </div>

            <div className="relative mt-16">
              <p className="mb-2 text-sm font-medium text-white/55">{user.name}’s music passport</p>
              <h1 className="max-w-[10ch] text-[3.4rem] font-semibold leading-[0.9] tracking-[-0.06em]">
                {passport.archetype}
              </h1>
              <p className="mt-6 max-w-[28ch] text-sm leading-relaxed text-white/60">
                {passport.tagline}
              </p>
            </div>

            <div className="relative mt-8 flex items-center justify-between border-t border-white/10 pt-5">
              <div className="flex items-center gap-2">
                {user.connected_platforms?.includes("spotify") && (
                  <span className="grid size-8 place-items-center rounded-full bg-[#1ed760] text-[10px] font-black text-black">S</span>
                )}
                {user.connected_platforms?.includes("youtube") && (
                  <span className="grid size-8 place-items-center rounded-full bg-[#ff0033] text-[10px] font-black text-white">▶</span>
                )}
                <span className="text-xs text-white/50">
                  {user.connected_platforms?.length || 1} platform{user.connected_platforms?.length === 1 ? "" : "s"} connected
                </span>
              </div>
              <button onClick={() => setShareOpen(true)} className="text-xs font-semibold text-[#d7ff64] transition hover:underline">
                View passport
              </button>
            </div>
          </div>
        </section>

        <section className="px-5 pt-10">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="eyebrow">On repeat</p>
              <h2 className="section-title">Your artists</h2>
            </div>
            <button className="text-xs font-semibold text-white/50 transition hover:text-white">See all</button>
          </div>

          <div className="grid grid-cols-[1.55fr_1fr_1fr] gap-2">
            <article className="glass-image group relative row-span-2 min-h-72 overflow-hidden rounded-[1.5rem]">
              <img
                src={topArtists[0]?.image || defaultArtists[0].image}
                alt=""
                className="absolute inset-0 size-full object-cover object-top transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
              <span className="absolute left-4 top-4 text-4xl font-semibold tracking-tighter">01</span>
              <div className="absolute bottom-4 left-4">
                <h3 className="text-xl font-semibold">{topArtists[0]?.name}</h3>
                <p className="text-[11px] text-white/60">{topArtists[0]?.genre}</p>
              </div>
            </article>

            {topArtists.slice(1, 4).map((artist: any, index: number) => (
              <article key={artist.name || index} className="glass-image group relative aspect-square overflow-hidden rounded-[1.35rem]">
                <img
                  src={artist.image || defaultArtists[index + 1]?.image}
                  alt=""
                  className="absolute inset-0 size-full object-cover object-top grayscale-[20%] transition duration-500 group-hover:scale-105 group-hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                <span className="absolute left-3 top-3 text-xs font-bold">0{index + 2}</span>
                <p className="absolute bottom-3 left-3 max-w-[90%] truncate text-xs font-semibold">{artist.name}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-white/25">Verified artist portraits cached from Deezer & graph</p>
        </section>

        <section className="px-5 pt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="eyebrow">Your pulse</p>
              <h2 className="section-title">Music signature</h2>
            </div>
            <div className="flex rounded-full bg-white/[0.06] p-1 text-[10px] font-semibold">
              <button onClick={() => setPeriod("month")} className={`rounded-full px-3 py-1.5 transition ${period === "month" ? "bg-white text-black" : "text-white/45"}`}>Month</button>
              <button onClick={() => setPeriod("year")} className={`rounded-full px-3 py-1.5 transition ${period === "year" ? "bg-white text-black" : "text-white/45"}`}>Year</button>
            </div>
          </div>

          <div className="glass-panel glass-depth rounded-[1.75rem] p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-white/50">Discovery score</p>
                <p className="mt-1 text-5xl font-semibold tracking-[-0.06em]">{discoveryScore}<span className="text-xl text-white/35">%</span></p>
              </div>
              <span className="rounded-full bg-[#d7ff64]/10 px-3 py-1.5 text-xs font-semibold text-[#d7ff64]">{discoveryTag}</span>
            </div>
            <div className="mt-7 space-y-5">
              {sliders.map(([start, end, value]: [string, string, number]) => (
                <div key={start}>
                  <div className="mb-2 flex justify-between text-[10px] font-medium text-white/40">
                    <span>{start}</span><span>{end}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] via-[#fa7185] to-[#d7ff64] transition-all duration-500" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pt-12">
          <p className="eyebrow">Across the universe</p>
          <h2 className="section-title">Your migration story</h2>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="lime-glass col-span-2 flex flex-col justify-between rounded-[1.6rem] p-5 text-black">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-55">Tracks moved</p>
                  <p className="mt-1 text-5xl font-semibold tracking-[-0.06em]">{migration.tracks_moved.toLocaleString()}</p>
                </div>
                <div className="grid size-16 place-items-center rounded-full border border-black/15">
                  <Icon name="route" className="size-7" />
                </div>
              </div>

              {!migration.has_migrated && (
                <div className="mt-4 pt-3 border-t border-black/10">
                  <button
                    onClick={() => window.alert("Navigate to the Move tab to transfer your playlists between Spotify and YouTube Music!")}
                    className="rounded-full bg-black px-4 py-2 text-xs font-bold text-[#d7ff64] transition hover:scale-105"
                  >
                    Migrate your first playlist ➔
                  </button>
                </div>
              )}
            </div>

            <div className="glass-panel glass-depth glass-hover rounded-[1.5rem] p-4">
              <Icon name="headphones" className="mb-7 size-5 text-[#fa7185]" />
              <p className="text-2xl font-semibold tracking-tight">{migration.hours_preserved}</p>
              <p className="mt-1 text-[11px] text-white/40">Music preserved</p>
            </div>
            <div className="glass-panel glass-depth glass-hover rounded-[1.5rem] p-4">
              <Icon name="transfer" className="mb-7 size-5 text-[#8b5cf6]" />
              <p className="text-2xl font-semibold tracking-tight">{migration.perfect_transfers}</p>
              <p className="mt-1 text-[11px] text-white/40">Perfect transfers</p>
            </div>
          </div>
        </section>

        <section className="px-5 pt-12">
          <p className="eyebrow">Rare find</p>
          <h2 className="section-title">Featured badge</h2>
          <div className="glass-panel glass-depth mt-5 flex items-center gap-5 rounded-[1.75rem] p-4">
            <div className="badge-shine floating-badge grid size-24 shrink-0 place-items-center rounded-[1.4rem] text-black">
              <Icon name="route" className="size-10" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7ff64]">{featuredBadge.rarity_tag}</span>
              <h3 className="mt-1 text-xl font-semibold">{featuredBadge.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{featuredBadge.description}</p>
            </div>
          </div>
        </section>

        <button onClick={() => setShareOpen(true)} className="mx-5 mt-10 flex w-[calc(100%-2.5rem)] items-center justify-between rounded-full bg-white px-5 py-4 font-semibold text-black transition hover:bg-[#d7ff64]">
          Share your music passport
          <span className="grid size-9 place-items-center rounded-full bg-black text-white"><Icon name="share" className="size-4" /></span>
        </button>
      </main>

      <nav className="glass-nav fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-[416px] -translate-x-1/2 items-center justify-around rounded-full px-3 py-2 shadow-2xl" aria-label="Main navigation">
        {[
          ["home", "Home"],
          ["compass", "Lens"],
          ["transfer", "Move"],
          ["user", "Profile"],
        ].map(([icon, label]) => (
          <button key={label} className={`flex min-w-16 flex-col items-center gap-1 rounded-full py-2 text-[9px] font-medium transition ${label === "Profile" ? "bg-white text-black" : "text-white/40 hover:text-white"}`}>
            <Icon name={icon as IconProps["name"]} className="size-[18px]" />
            {label}
          </button>
        ))}
      </nav>

      {shareOpen && <ShareSheet onClose={() => setShareOpen(false)} profileData={profileData} />}
    </div>
  );
}

function PlatformMark({ platform }: { platform: "spotify" | "youtube" }) {
  if (platform === "spotify") {
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#1ed760] text-black shadow-[0_8px_24px_rgba(30,215,96,.2)]">
        <svg className="size-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.58 14.43a.62.62 0 0 1-.85.2c-2.33-1.43-5.27-1.75-8.73-.96a.62.62 0 1 1-.28-1.2c3.8-.87 7.07-.5 9.66 1.08.3.18.4.57.2.88Zm1.22-2.7a.78.78 0 0 1-1.07.25c-2.67-1.64-6.74-2.11-9.9-1.16a.78.78 0 0 1-.45-1.49c3.61-1.09 8.1-.56 11.17 1.33.37.22.48.7.25 1.07Zm.1-2.81C14.7 9.02 9.4 8.85 6.35 9.77a.93.93 0 1 1-.54-1.78c3.5-1.06 9.37-.85 13.04 1.33a.93.93 0 0 1-.95 1.6Z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#ff0033] text-white shadow-[0_8px_24px_rgba(255,0,51,.2)]">
      <svg className="ml-0.5 size-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21.58 7.19a2.76 2.76 0 0 0-1.94-1.95C17.93 4.78 12 4.78 12 4.78s-5.93 0-7.64.46a2.76 2.76 0 0 0-1.94 1.95A28.7 28.7 0 0 0 1.96 12c0 1.63.16 3.25.46 4.81a2.76 2.76 0 0 0 1.94 1.95c1.71.46 7.64.46 7.64.46s5.93 0 7.64-.46a2.76 2.76 0 0 0 1.94-1.95c.3-1.56.46-3.18.46-4.81s-.16-3.25-.46-4.81ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z" />
      </svg>
    </span>
  );
}

function LandingScreen({ onConnect }: { onConnect: () => void }) {
  const [connecting, setConnecting] = useState<"spotify" | "youtube" | null>(null);

  const connect = (platform: "spotify" | "youtube") => {
    setConnecting(platform);
    window.setTimeout(onConnect, 650);
  };

  return (
    <div className="app-shell landing-shell min-h-screen text-[#f4f3ee] selection:bg-[#d7ff64] selection:text-black">
      <div className="ambient-orb ambient-orb-one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-two" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-three" aria-hidden="true" />
      <div className="noise-layer" aria-hidden="true" />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col overflow-hidden px-5 pb-7 pt-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="brand-mark grid size-10 place-items-center rounded-xl text-black">
              <Icon name="route" className="size-5" />
            </span>
            <span className="text-sm font-bold tracking-[-0.02em]">SoundGraph</span>
          </div>
          <span className="glass-control rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
            Your music, anywhere
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10">
          <div className="landing-visual relative mx-auto mb-10 h-52 w-full max-w-[350px]" aria-hidden="true">
            <div className="cover-card cover-card-left">
              <img src={defaultArtists[1].image} alt="" />
            </div>
            <div className="cover-card cover-card-center">
              <img src={defaultArtists[0].image} alt="" />
              <span className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/20 bg-black/25 p-2.5 text-[9px] font-semibold backdrop-blur-xl">
                Your sound, in one place
              </span>
            </div>
            <div className="cover-card cover-card-right">
              <img src={defaultArtists[2].image} alt="" />
            </div>
            <div className="music-orbit music-orbit-one"><span /></div>
            <div className="music-orbit music-orbit-two"><span /></div>
          </div>

          <div className="text-center">
            <p className="eyebrow justify-center">One profile. Every platform.</p>
            <h1 className="mx-auto mt-3 max-w-[9ch] text-[3.55rem] font-semibold leading-[0.88] tracking-[-0.07em]">
              Your music has no borders.
            </h1>
            <p className="mx-auto mt-5 max-w-[32ch] text-sm leading-relaxed text-white/50">
              Connect a music account to discover your taste, get better recommendations, and move playlists freely.
            </p>
          </div>
        </section>

        <section className="glass-panel glass-depth rounded-[2rem] p-3">
          <button
            onClick={() => connect("spotify")}
            disabled={connecting !== null}
            className="connect-button group flex w-full items-center gap-3 rounded-[1.35rem] p-3 text-left"
          >
            <PlatformMark platform="spotify" />
            <span className="flex-1">
              <span className="block text-sm font-semibold">
                {connecting === "spotify" ? "Connecting..." : "Continue with Spotify"}
              </span>
              <span className="mt-0.5 block text-[10px] text-white/38">Sign in with Spotify account</span>
            </span>
            <span className="grid size-8 place-items-center rounded-full border border-white/10 text-white/45 transition group-hover:translate-x-0.5 group-hover:border-white/25 group-hover:text-white">
              <Icon name="arrow" className="size-4 rotate-180" />
            </span>
          </button>

          <div className="my-1 flex items-center gap-3 px-3">
            <span className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25">or</span>
            <span className="h-px flex-1 bg-white/[0.07]" />
          </div>

          <button
            onClick={() => connect("youtube")}
            disabled={connecting !== null}
            className="connect-button group flex w-full items-center gap-3 rounded-[1.35rem] p-3 text-left"
          >
            <PlatformMark platform="youtube" />
            <span className="flex-1">
              <span className="block text-sm font-semibold">
                {connecting === "youtube" ? "Connecting..." : "Continue with YouTube"}
              </span>
              <span className="mt-0.5 block text-[10px] text-white/38">Sign in with Google / YouTube</span>
            </span>
            <span className="grid size-8 place-items-center rounded-full border border-white/10 text-white/45 transition group-hover:translate-x-0.5 group-hover:border-white/25 group-hover:text-white">
              <Icon name="arrow" className="size-4 rotate-180" />
            </span>
          </button>
        </section>

        <div className="mt-5 flex items-center justify-center gap-2 text-center text-[10px] leading-relaxed text-white/30">
          <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Your personal taste graph is encrypted and decentralized.
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<"landing" | "profile">("profile");

  return screen === "landing" ? (
    <LandingScreen onConnect={() => setScreen("profile")} />
  ) : (
    <ProfileScreen onBack={() => setScreen("landing")} />
  );
}
