import { useEffect, useMemo, useRef, useState } from "react"

type Tab = "deck" | "lens" | "move" | "profile"
type Platform = "youtube" | "spotify"
type Source = Platform | "deck"
type IconName = "cards" | "lens" | "move" | "heart" | "close" | "play" | "pause" | "spark" | "mic" | "waves" | "check" | "arrow" | "chevron" | "user"

type Track = {
  title: string
  artist: string
  image: string
  match: number
  tags: string[]
  color: string
}

type UserDeck = {
  name: string
  tracks: Track[]
}

const tracks: Track[] = [
  {
    title: "After Dark",
    artist: "Luna Vale",
    image:
      "https://images.unsplash.com/photo-1770335435091-75e3f07cd5e8?auto=format&fit=crop&w=900&q=88",
    match: 96,
    tags: ["Alt pop", "Nocturnal"],
    color: "#b263ff",
  },
  {
    title: "Slow Motion",
    artist: "The Marías",
    image:
      "https://images.unsplash.com/photo-1760800185627-12eb152aaca4?auto=format&fit=crop&w=900&q=88",
    match: 92,
    tags: ["Dream pop", "Velvet"],
    color: "#ff645f",
  },
  {
    title: "Soft Static",
    artist: "Amaya Blue",
    image:
      "https://images.unsplash.com/photo-1543868849-ca832301484f?auto=format&fit=crop&w=900&q=88",
    match: 89,
    tags: ["R&B", "Airy"],
    color: "#62a7ff",
  },
  {
    title: "Night Drive",
    artist: "Milo Grey",
    image:
      "https://images.unsplash.com/photo-1608649443926-1e224443ef88?auto=format&fit=crop&w=900&q=88",
    match: 87,
    tags: ["Indie", "Warm"],
    color: "#d7ff64",
  },
]

const playlists = {
  spotify: [
    { name: "Liked Songs", count: 348, color: "from-[#5747d7] to-[#b9a9ff]" },
    { name: "night bus", count: 46, color: "from-[#392f59] to-[#f86f72]" },
    { name: "soft focus", count: 82, color: "from-[#597c8c] to-[#d7ff64]" },
    { name: "Sunday reset", count: 31, color: "from-[#965c3f] to-[#f4d0a0]" },
  ],
  youtube: [
    { name: "My Supermix", count: 100, color: "from-[#4b1729] to-[#ff4c5d]" },
    {
      name: "late night finds",
      count: 64,
      color: "from-[#25325f] to-[#aa7cff]",
    },
    { name: "Discoveries", count: 118, color: "from-[#254e48] to-[#6fffc1]" },
    { name: "On repeat", count: 25, color: "from-[#7a3c21] to-[#ffbd73]" },
  ],
}

function Icon({
  name,
  className = "size-5",
}: {
  name: IconName
  className?: string
}) {
  const paths: Record<IconName, React.ReactNode> = {
    cards: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="3" />
        <path d="M9 7h6M9 11h6M9 15h3" />
      </>
    ),
    lens: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
      </>
    ),
    move: (
      <>
        <path d="M5 7h14l-3-3M19 17H5l3 3" />
      </>
    ),
    heart: (
      <path d="M20.8 4.7a5.4 5.4 0 0 0-7.6 0L12 5.9l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.6Z" />
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    play: <path d="m9 6 9 6-9 6Z" />,
    pause: (
      <>
        <path d="M9 7v10M15 7v10" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.3 4.3L17 9l-3.7 1.7L12 15l-1.3-4.3L7 9l3.7-1.7L12 3Z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
      </>
    ),
    waves: (
      <>
        <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="m8 5 7 7-7 7" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function PlatformMark({
  platform,
  small = false,
}: {
  platform: Platform
  small?: boolean
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${
        small ? "size-7" : "size-10"
      } ${
        platform === "spotify"
          ? "bg-[#1ed760] text-black"
          : "bg-[#ff0033] text-white"
      }`}
    >
      {platform === "spotify" ? (
        <svg
          className={small ? "size-4" : "size-5"}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.58 14.43a.62.62 0 0 1-.85.2c-2.33-1.43-5.27-1.75-8.73-.96a.62.62 0 1 1-.28-1.2c3.8-.87 7.07-.5 9.66 1.08.3.18.4.57.2.88Zm1.22-2.7a.78.78 0 0 1-1.07.25c-2.67-1.64-6.74-2.11-9.9-1.16a.78.78 0 0 1-.45-1.49c3.61-1.09 8.1-.56 11.17 1.33.37.22.48.7.25 1.07Zm.1-2.81C14.7 9.02 9.4 8.85 6.35 9.77a.93.93 0 1 1-.54-1.78c3.5-1.06 9.37-.85 13.04 1.33a.93.93 0 0 1-.95 1.6Z" />
        </svg>
      ) : (
        <svg
          className={`${small ? "size-4" : "size-5"} ml-0.5`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.9 4.8 12 4.8 12 4.8s-5.9 0-7.6.4a2.8 2.8 0 0 0-2 2A28 28 0 0 0 2 12c0 1.6.1 3.2.4 4.8a2.8 2.8 0 0 0 2 2c1.7.4 7.6.4 7.6.4s5.9 0 7.6-.4a2.8 2.8 0 0 0 2-2c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z" />
        </svg>
      )}
    </span>
  )
}

function Header({ eyebrow, title }: { eyebrow: string title: string }) {
  return (
    <header className="flex items-start justify-between px-5 pb-5 pt-7">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7ff64]">
          {eyebrow}
        </p>
        <h1 className="text-[2rem] font-semibold leading-none tracking-[-0.055em]">
          {title}
        </h1>
      </div>
      <button
        className="glass-control grid size-11 place-items-center rounded-full"
        aria-label="Open profile"
      >
        <Icon name="user" className="size-5" />
      </button>
    </header>
  )
}

function DeckPage({
  decks,
  onAddToDeck,
}: {
  decks: UserDeck[]
  onAddToDeck: (deckIndex: number | null, name: string, track: Track) => void
}) {
  const [index, setIndex] = useState(0)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newDeckName, setNewDeckName] = useState("")
  const startX = useRef(0)
  const current = tracks[index % tracks.length]

  const finishSwipe = (direction: -1 | 1) => {
    if (direction === 1) {
      setDragging(false)
      setOffset(0)
      setSaveOpen(true)
      return
    }
    setDragging(false)
    setOffset(direction * 480)
    window.setTimeout(() => {
      setIndex((value) => value + 1)
      setOffset(0)
      setPlaying(false)
    }, 260)
  }

  const saveTrack = (deckIndex: number | null, name = "") => {
    onAddToDeck(deckIndex, name, current)
    setSaveOpen(false)
    setCreating(false)
    setNewDeckName("")
    setOffset(480)
    window.setTimeout(() => {
      setIndex((value) => value + 1)
      setOffset(0)
      setPlaying(false)
    }, 260)
  }

  const pointerUp = () => {
    if (Math.abs(offset) > 90) {
      finishSwipe(offset > 0 ? 1 : -1)
    } else {
      setDragging(false)
      setOffset(0)
    }
  }

  return (
    <main className="page-content">
      <Header eyebrow="Made for Maya" title="Your daily deck" />
      <section className="px-5">
        <div className="mb-4 flex items-center justify-between text-xs text-white/45">
          <span>{index + 1} discovered today</span>
          <span className="flex items-center gap-1.5 text-[#d7ff64]">
            <span className="size-1.5 rounded-full bg-[#d7ff64] shadow-[0_0_10px_#d7ff64]" />
            Deck refreshes endlessly
          </span>
        </div>

        <div className="deck-stage relative h-[31rem]">
          {[2, 1].map((depth) => {
            const item = tracks[(index + depth) % tracks.length]
            return (
              <div
                key={`${index}-${depth}`}
                className={`deck-card deck-card-${depth} absolute inset-0 overflow-hidden rounded-[2rem]`}
              >
                <img
                  src={item.image}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            )
          })}

          <article
            className={`deck-card active-card absolute inset-0 touch-none overflow-hidden rounded-[2rem] ${
              dragging ? "is-dragging" : ""
            }`}
            style={{
              transform: `translateX(${offset}px) rotate(${offset / 18}deg)`,
              ["--card-accent" as string]: current.color,
            }}
            onPointerDown={(event) => {
              startX.current = event.clientX
              setDragging(true)
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (dragging) setOffset(event.clientX - startX.current)
            }}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
          >
            <img
              src={current.image}
              alt={`${current.artist} artwork`}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/95" />
            <div className="card-glow absolute inset-x-0 bottom-0 h-1/2" />

            <div
              className={`swipe-stamp left-5 rotate-[-8deg] text-[#d7ff64] ${
                offset > 45 ? "opacity-100" : "opacity-0"
              }`}
            >
              KEEP
            </div>
            <div
              className={`swipe-stamp right-5 rotate-[8deg] text-[#ff817a] ${
                offset < -45 ? "opacity-100" : "opacity-0"
              }`}
            >
              SKIP
            </div>

            <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
              <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[10px] font-semibold backdrop-blur-xl">
                {current.match}% taste match
              </span>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  setPlaying((value) => !value)
                }}
                className="grid size-11 place-items-center rounded-full border border-white/25 bg-white/15 backdrop-blur-xl"
                aria-label={playing ? "Pause preview" : "Play preview"}
              >
                <Icon name={playing ? "pause" : "play"} className="size-5" />
              </button>
            </div>

            {playing && (
              <div
                className="absolute inset-x-0 top-24 flex h-12 items-center justify-center gap-1"
                aria-label="Playing preview"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                  <span
                    key={bar}
                    className="preview-bar"
                    style={{ animationDelay: `${bar * 80}ms` }}
                  />
                ))}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="mb-3 flex gap-2">
                {current.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium backdrop-blur-lg"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="text-[2.65rem] font-semibold leading-[0.94] tracking-[-0.06em]">
                {current.title}
              </h2>
              <p className="mt-2 text-sm text-white/60">{current.artist}</p>
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  setSaveOpen(true)
                }}
                className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black"
              >
                <Icon name="cards" className="size-4" />
                Add to a deck
              </button>
              <div className="mt-5 h-0.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className={`h-full bg-white ${
                    playing ? "preview-progress" : "w-0"
                  }`}
                />
              </div>
              <div className="mt-2 flex justify-between text-[9px] text-white/35">
                <span>0:12 PREVIEW</span>
                <span>FROM YOUR ALT MIX</span>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-6 flex items-center justify-center gap-5">
          <button
            onClick={() => finishSwipe(-1)}
            className="action-button grid size-16 place-items-center rounded-full text-[#ff817a]"
            aria-label="Skip track"
          >
            <Icon name="close" className="size-7" />
          </button>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-white/35">
            <Icon name="arrow" className="size-3 rotate-180" />
            Swipe
            <Icon name="arrow" className="size-3" />
          </div>
          <button
            onClick={() => finishSwipe(1)}
            className="action-button like-button grid size-16 place-items-center rounded-full text-black"
            aria-label="Save track"
          >
            <Icon name="heart" className="size-7 fill-current" />
          </button>
        </div>
      </section>
      {saveOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 backdrop-blur-md">
          <button
            className="absolute inset-0"
            onClick={() => {
              setSaveOpen(false)
              setCreating(false)
            }}
            aria-label="Close deck picker"
          />
          <section className="result-sheet relative w-full max-w-md rounded-[2rem] p-5">
            <div className="mb-5 flex items-center gap-3">
              <img
                src={current.image}
                alt=""
                className="size-14 rounded-xl object-cover"
              />
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7ff64]">
                  Save song
                </p>
                <h2 className="mt-1 text-lg font-semibold">{current.title}</h2>
                <p className="text-xs text-white/40">{current.artist}</p>
              </div>
              <button
                onClick={() => setSaveOpen(false)}
                className="grid size-9 place-items-center rounded-full bg-white/10"
                aria-label="Close"
              >
                <Icon name="close" className="size-4" />
              </button>
            </div>

            {creating ? (
              <div>
                <label className="mb-2 block text-xs font-medium text-white/50">
                  Deck name
                </label>
                <input
                  autoFocus
                  value={newDeckName}
                  onChange={(event) => setNewDeckName(event.target.value)}
                  placeholder="e.g. Late night drive"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm outline-none placeholder:text-white/25 focus:border-[#d7ff64]/50"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setCreating(false)}
                    className="flex-1 rounded-full bg-white/10 py-3 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    onClick={() =>
                      newDeckName.trim() && saveTrack(null, newDeckName.trim())
                    }
                    disabled={!newDeckName.trim()}
                    className="flex-1 rounded-full bg-[#d7ff64] py-3 text-xs font-semibold text-black disabled:opacity-40"
                  >
                    Create & add
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setCreating(true)}
                  className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 p-3 text-left hover:border-white/30"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-[#d7ff64] text-xl text-black">
                    +
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      New deck
                    </span>
                    <span className="mt-0.5 block text-[10px] text-white/35">
                      Start a new collection
                    </span>
                  </span>
                </button>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                  Your decks
                </p>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {decks.map((deck, deckIndex) => (
                    <button
                      key={deck.name}
                      onClick={() => saveTrack(deckIndex)}
                      className="playlist-row flex w-full items-center gap-3 rounded-2xl p-3 text-left"
                    >
                      <span className="grid size-11 place-items-center rounded-xl bg-white/10">
                        <Icon name="cards" className="size-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">
                          {deck.name}
                        </span>
                        <span className="text-[10px] text-white/35">
                          {deck.tracks.length} songs
                        </span>
                      </span>
                      <Icon name="chevron" className="size-4 text-white/25" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function LensPage() {
  const [status, setStatus] = useState<"idle" | "listening" | "found">("idle")

  useEffect(() => {
    if (status !== "listening") return
    const timer = window.setTimeout(() => setStatus("found"), 3200)
    return () => window.clearTimeout(timer)
  }, [status])

  return (
    <main className="page-content">
      <Header eyebrow="Soundport Lens" title="Name that sound" />
      <section className="flex min-h-[38rem] flex-col px-5">
        <div className="mb-8 flex rounded-full border border-white/10 bg-white/[0.04] p-1">
          <button className="flex-1 rounded-full bg-white py-2.5 text-xs font-semibold text-black">
            Listen
          </button>
          <button className="flex-1 rounded-full py-2.5 text-xs font-semibold text-white/40">
            Your history
          </button>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center">
          <div
            className={`lens-orbit orbit-outer ${
              status === "listening" ? "is-listening" : ""
            }`}
          />
          <div
            className={`lens-orbit orbit-inner ${
              status === "listening" ? "is-listening" : ""
            }`}
          />
          <div className="absolute size-72 rounded-full bg-[#8b5cf6]/10 blur-3xl" />
          <button
            onClick={() =>
              setStatus(status === "listening" ? "idle" : "listening")
            }
            className={`listen-core relative z-10 grid size-44 place-items-center rounded-full ${
              status === "listening" ? "is-listening" : ""
            }`}
            aria-label={
              status === "listening" ? "Stop listening" : "Start listening"
            }
          >
            <div className="text-center">
              <Icon
                name={status === "listening" ? "waves" : "mic"}
                className="mx-auto size-10"
              />
              <span className="mt-3 block text-xs font-bold uppercase tracking-[0.18em]">
                {status === "listening" ? "Listening" : "Tap to listen"}
              </span>
            </div>
          </button>
          {status === "listening" && (
            <div className="absolute z-20 flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  className="listen-bar"
                  style={{ animationDelay: `${bar * 110}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mb-8 mt-10 text-center">
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">
            {status === "listening"
              ? "Hold that sound…"
              : "Play it. Hum it. Find it."}
          </h2>
          <p className="mx-auto mt-2 max-w-[28ch] text-sm leading-relaxed text-white/40">
            {status === "listening"
              ? "Lens is separating melody from the noise."
              : "Soundport Lens identifies music around you or the tune stuck in your head."}
          </p>
        </div>

        <div className="glass-panel rounded-[1.6rem] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-[#d7ff64]/10 text-[#d7ff64]">
              <Icon name="spark" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold">Better humming matches</p>
              <p className="mt-1 text-[10px] text-white/35">
                Hum for at least 8 seconds in a quiet space.
              </p>
            </div>
            <Icon name="chevron" className="size-4 text-white/25" />
          </div>
        </div>
      </section>

      {status === "found" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-md">
          <button
            className="absolute inset-0"
            onClick={() => setStatus("idle")}
            aria-label="Close result"
          />
          <article className="result-sheet relative w-full max-w-md overflow-hidden rounded-[2rem] p-3">
            <img
              src={tracks[1].image}
              alt="Slow Motion cover"
              className="aspect-[1.15] w-full rounded-[1.45rem] object-cover"
            />
            <div className="p-4 pb-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7ff64]">
                <Icon name="check" className="size-4" />
                Match found
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.05em]">
                    Slow Motion
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
                    The Marías · Submarine
                  </p>
                </div>
                <button className="grid size-12 place-items-center rounded-full bg-[#d7ff64] text-black">
                  <Icon name="play" />
                </button>
              </div>
              <button
                onClick={() => setStatus("idle")}
                className="mt-5 w-full rounded-full bg-white py-3.5 text-sm font-semibold text-black"
              >
                Add to my liked songs
              </button>
            </div>
          </article>
        </div>
      )}
    </main>
  )
}

function SourceMark({ source }: { source: Source }) {
  if (source === "deck") {
    return (
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#d7ff64] text-black">
        <Icon name="cards" className="size-5" />
      </span>
    )
  }
  return <PlatformMark platform={source} />
}

function MovePage({ decks }: { decks: UserDeck[] }) {
  const [source, setSource] = useState<Source>("youtube")
  const [destination, setDestination] = useState<Platform>("spotify")
  const [selected, setSelected] = useState<number[]>([0])
  const [moving, setMoving] = useState(false)
  const [complete, setComplete] = useState(false)
  const currentPlaylists =
    source === "deck"
      ? decks.map((deck, index) => ({
          name: deck.name,
          count: deck.tracks.length,
          color: [
            "from-[#4c5841] to-[#d7ff64]",
            "from-[#49345e] to-[#aa7cff]",
            "from-[#5f3438] to-[#ff817a]",
          ][index % 3],
        }))
      : playlists[source]
  const selectedTracks = useMemo(
    () => selected.reduce((sum, item) => sum + currentPlaylists[item].count, 0),
    [currentPlaylists, selected],
  )

  const swapSource = (nextSource: Source) => {
    setSource(nextSource)
    if (nextSource === "youtube") setDestination("spotify")
    if (nextSource === "spotify") setDestination("youtube")
    setSelected([0])
    setComplete(false)
  }

  const migrate = () => {
    if (!selected.length || moving) return
    setMoving(true)
    window.setTimeout(() => {
      setMoving(false)
      setComplete(true)
    }, 1800)
  }

  return (
    <main className="page-content">
      <Header eyebrow="Playlist porter" title="Move your music" />
      <section className="px-5">
        <div className="platform-switch mb-7 grid grid-cols-3 rounded-full p-1">
          {(["youtube", "spotify", "deck"] as Source[]).map((item) => (
            <button
              key={item}
              onClick={() => swapSource(item)}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[11px] font-semibold capitalize transition ${
                source === item
                  ? "bg-white text-black shadow-xl"
                  : "text-white/40"
              }`}
            >
              {item === "deck" ? (
                <Icon name="cards" className="size-4" />
              ) : (
                <PlatformMark platform={item} small />
              )}
              {item}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-white/40">
              Choose from{" "}
              {source === "youtube"
                ? "YouTube"
                : source === "spotify"
                  ? "Spotify"
                  : "your Soundport decks"}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">
              {source === "deck" ? "Your decks" : "Your playlists"}
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-[#d7ff64]">
            {selected.length} selected
          </span>
        </div>

        <div className="space-y-2">
          {currentPlaylists.map((playlist, index) => {
            const isSelected = selected.includes(index)
            return (
              <button
                key={playlist.name}
                onClick={() =>
                  setSelected((items) =>
                    isSelected
                      ? items.filter((item) => item !== index)
                      : [...items, index],
                  )
                }
                className={`playlist-row flex w-full items-center gap-3 rounded-[1.35rem] p-2.5 text-left ${
                  isSelected ? "is-selected" : ""
                }`}
              >
                {source === "deck" && decks[index]?.tracks[0] ? (
                  <img
                    src={decks[index].tracks[0].image}
                    alt=""
                    className="size-14 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span
                    className={`grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${playlist.color}`}
                  >
                    <Icon
                      name={source === "deck" ? "cards" : "waves"}
                      className="size-5 text-black/65"
                    />
                  </span>
                )}
                <span className="flex-1">
                  <span className="block text-sm font-semibold">
                    {playlist.name}
                  </span>
                  <span className="mt-1 block text-[10px] text-white/35">
                    {playlist.count} tracks
                  </span>
                </span>
                <span
                  className={`grid size-6 place-items-center rounded-full border ${
                    isSelected
                      ? "border-[#d7ff64] bg-[#d7ff64] text-black"
                      : "border-white/15 text-transparent"
                  }`}
                >
                  <Icon name="check" className="size-3.5" />
                </span>
              </button>
            )
          })}
        </div>

        <div className="migration-route relative my-6 flex items-center justify-between rounded-[1.5rem] p-4">
          <div className="flex items-center gap-2">
            <SourceMark source={source} />
            <div>
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/30">
                From
              </p>
              <p className="text-xs font-semibold capitalize">{source}</p>
            </div>
          </div>
          <div className="route-line flex flex-1 items-center px-4">
            <span className="h-px flex-1 bg-gradient-to-r from-white/10 via-[#d7ff64] to-white/10" />
            <Icon name="arrow" className="size-4 text-[#d7ff64]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/30">
                To
              </p>
              <p className="text-xs font-semibold capitalize">{destination}</p>
            </div>
            <PlatformMark platform={destination} />
          </div>
        </div>

        {source === "deck" && (
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
              Send deck to
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["spotify", "youtube"] as Platform[]).map((platform) => (
                <button
                  key={platform}
                  onClick={() => {
                    setDestination(platform)
                    setComplete(false)
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-xs font-semibold capitalize ${
                    destination === platform
                      ? "border-[#d7ff64]/40 bg-[#d7ff64]/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/40"
                  }`}
                >
                  <PlatformMark platform={platform} small />
                  {platform}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={migrate}
          disabled={!selected.length || moving}
          className={`move-cta flex w-full items-center justify-between rounded-full px-5 py-3.5 text-sm font-bold text-black ${
            complete ? "is-complete" : ""
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name={complete ? "check" : "move"} className="size-5" />
            {moving
              ? `Moving ${selectedTracks} tracks…`
              : complete
                ? "Migration complete"
                : `Move ${selectedTracks} tracks to ${
                    destination === "spotify" ? "Spotify" : "YouTube"
                  }`}
          </span>
          <span className="grid size-9 place-items-center rounded-full bg-black/10">
            <Icon name={complete ? "check" : "arrow"} className="size-4" />
          </span>
          {moving && (
            <span className="move-progress absolute bottom-0 left-0 h-1 rounded-full bg-black/35" />
          )}
        </button>

        <p className="mt-3 text-center text-[10px] leading-relaxed text-white/30">
          We’ll match every track and flag anything that needs your review.
        </p>
      </section>
    </main>
  )
}

function ProfilePage({ decks }: { decks: UserDeck[] }) {
  const totalDeckTracks = decks.reduce(
    (sum, deck) => sum + deck.tracks.length,
    0,
  )

  return (
    <main className="page-content">
      <Header eyebrow="Music passport" title="Your profile" />
      <section className="space-y-8 px-5">
        <div className="passport-card relative overflow-hidden rounded-[2rem] p-5">
          <div className="absolute -right-16 -top-12 size-48 rounded-full bg-[#8b5cf6]/60 blur-3xl" />
          <div className="absolute -bottom-16 -left-12 size-44 rounded-full bg-[#d7ff64]/25 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <img
              src={tracks[0].image}
              alt="Maya"
              className="size-16 rounded-2xl object-cover"
            />
            <span className="rounded-full border border-white/15 bg-black/15 px-3 py-1.5 text-[10px] text-white/60">
              Updated today
            </span>
          </div>
          <div className="relative mt-16">
            <p className="text-sm text-white/45">Maya’s sound is</p>
            <h2 className="mt-2 max-w-[8ch] text-[3.4rem] font-semibold leading-[0.88] tracking-[-0.07em]">
              Midnight Explorer
            </h2>
            <p className="mt-5 max-w-[28ch] text-sm leading-relaxed text-white/50">
              Dreamy vocals, left-field R&B and songs made for the last train
              home.
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7ff64]">
            This month
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
            Your listening
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["82%", "Discovery"],
              [String(decks.length), "Decks"],
              [String(totalDeckTracks), "Saved"],
            ].map(([value, label]) => (
              <div key={label} className="glass-panel rounded-[1.3rem] p-3">
                <p className="text-2xl font-semibold tracking-[-0.05em]">
                  {value}
                </p>
                <p className="mt-1 text-[10px] text-white/35">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7ff64]">
                On repeat
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">
                Top artists
              </h2>
            </div>
            <span className="text-xs text-white/35">Last 30 days</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tracks.map((track, index) => (
              <div key={track.artist}>
                <div className="relative aspect-square overflow-hidden rounded-2xl">
                  <img
                    src={track.image}
                    alt=""
                    className="size-full object-cover"
                  />
                  <span className="absolute left-2 top-2 text-[10px] font-bold">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-2 truncate text-[10px] font-medium">
                  {track.artist}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel flex items-center gap-4 rounded-[1.5rem] p-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#d7ff64] text-black">
            <Icon name="move" className="size-6" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Bridge Builder</p>
            <p className="mt-1 text-[10px] text-white/35">
              Moved music between both worlds.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase text-[#d7ff64]">
            Rare
          </span>
        </div>
      </section>
    </main>
  )
}

function Navigation({
  active,
  onChange,
}: {
  active: Tab
  onChange: (tab: Tab) => void
}) {
  const items: { id: Tab icon: IconName label: string }[] = [
    { id: "deck", icon: "cards", label: "Deck" },
    { id: "lens", icon: "lens", label: "Lens" },
    { id: "move", icon: "move", label: "Move" },
    { id: "profile", icon: "user", label: "Profile" },
  ]

  return (
    <nav className="glass-nav fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-[416px] -translate-x-1/2 items-center rounded-full p-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`relative flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-xs font-semibold transition ${
            active === item.id
              ? "bg-white text-black"
              : "text-white/40 hover:text-white"
          }`}
        >
          <Icon name={item.icon} className="size-[18px]" />
          {item.label}
          {item.id === "lens" && active !== "lens" && (
            <span className="absolute right-[22%] top-2 size-1.5 rounded-full bg-[#d7ff64]" />
          )}
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const [active, setActive] = useState<Tab>("deck")
  const [decks, setDecks] = useState<UserDeck[]>([
    { name: "Night drive", tracks: [tracks[1], tracks[3]] },
    { name: "Soft focus", tracks: [tracks[2]] },
  ])

  const addToDeck = (deckIndex: number | null, name: string, track: Track) => {
    setDecks((currentDecks) => {
      if (deckIndex === null) {
        return [...currentDecks, { name, tracks: [track] }]
      }
      return currentDecks.map((deck, index) =>
        index === deckIndex &&
        !deck.tracks.some((item) => item.title === track.title)
          ? { ...deck, tracks: [...deck.tracks, track] }
          : deck,
      )
    })
  }

  return (
    <div className={`app-shell min-h-screen text-[#f4f3ee] tab-${active}`}>
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="noise-layer" />
      <div className="relative z-10 mx-auto min-h-screen max-w-md overflow-hidden pb-28">
        {active === "deck" && (
          <DeckPage decks={decks} onAddToDeck={addToDeck} />
        )}
        {active === "lens" && <LensPage />}
        {active === "move" && <MovePage decks={decks} />}
        {active === "profile" && <ProfilePage decks={decks} />}
      </div>
      <Navigation active={active} onChange={setActive} />
    </div>
  )
}
