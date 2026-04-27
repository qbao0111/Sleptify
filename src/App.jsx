import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import AuroraBackground from "./components/AuroraBackground";
import ThreePulseOrbs from "./components/ThreePulseOrbs";

const MUSIC_DIR = "/music";
const MAX_TRACKS_TO_SCAN = 100;
const COVER_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

const TRACK_THEMES = {
  1: {
    a: "#5cf4d2",
    b: "#37b5ff",
    c: "#0a2233",
  },
  2: {
    a: "#8df6ff",
    b: "#64dbc9",
    c: "#092a38",
  },
  3: {
    a: "#6af8ce",
    b: "#88c9ff",
    c: "#0d2338",
  },
};


const SONG_METADATA = {
  1: {
    title: " intro (end of the world)",
    artist: "Ariana Grande",
  },
  2: {
    title: "Guilty as Sin",
    artist: "Taylor Swift",
  },
  3: {
    title: "Back to friends",
    artist: "sombr",
  },
  4: {
    title: "Song Four",
    artist: "Unknown Artist",
  },
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

function MusicIcon({ type }) {
  if (type === "prev") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 5h2v14H6zM18 6.5 9.5 12 18 17.5z" fill="currentColor" />
      </svg>
    );
  }

  if (type === "next") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 5h2v14h-2zM6 6.5 14.5 12 6 17.5z" fill="currentColor" />
      </svg>
    );
  }

  if (type === "pause") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6v12l10-6z" fill="currentColor" />
    </svg>
  );
}

async function fileExists(url, expectedMimePrefix) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) return false;

    const contentType = response.headers.get("content-type") || "";
    if (!expectedMimePrefix) return true;

    return contentType.toLowerCase().startsWith(expectedMimePrefix);
  } catch {
    return false;
  }
}

async function resolveCover(index) {
  for (const ext of COVER_EXTENSIONS) {
    const candidate = `${MUSIC_DIR}/cover${index}.${ext}`;
    if (await fileExists(candidate, "image/")) return candidate;
  }

  return null;
}

async function discoverPlaylist() {
  const tracks = [];

  for (let index = 1; index <= MAX_TRACKS_TO_SCAN; index += 1) {
    const audio = `${MUSIC_DIR}/song${index}.mp3`;
    const audioExists = await fileExists(audio, "audio/");

    if (!audioExists) break;

    const cover = (await resolveCover(index)) || `${MUSIC_DIR}/cover1.png`;
    const metadata = SONG_METADATA[index] || {};

    tracks.push({
      id: index,
      title: metadata.title || `Song ${index}`,
      artist: metadata.artist || "Unknown Artist",
      audio,
      cover,
    });
  }

  return tracks;
}

function VinylDisc({ cover, isPlaying }) {
  return (
    <div className={`vinyl ${isPlaying ? "spinning" : ""}`} aria-hidden="true">
      <div className="vinyl-rings"></div>
      <div className="vinyl-sheen"></div>

      <div className="vinyl-center">
        <img src={cover} alt="" />
      </div>

      <div className="vinyl-hole"></div>
    </div>
  );
}

export default function App() {
  const audioRef = useRef(null);

  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [scanDone, setScanDone] = useState(false);

  const currentTrack = useMemo(
    () => playlist[currentIndex] ?? null,
    [playlist, currentIndex]
  );
  const theme = TRACK_THEMES[currentTrack?.id] || TRACK_THEMES[1];

  useEffect(() => {
    let mounted = true;

    async function loadPlaylist() {
      const tracks = await discoverPlaylist();

      if (!mounted) return;

      setPlaylist(tracks);
      setCurrentIndex(0);
      setScanDone(true);
    }

    loadPlaylist();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    setIsLoaded(false);
    setCurrentTime(0);
    setDuration(0);

    audio.load();

    if (isPlaying) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [currentTrack, currentIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoaded(true);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const onEnded = () => {
      if (!playlist.length) return;
      setCurrentIndex((prev) => (prev === playlist.length - 1 ? 0 : prev + 1));
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playlist.length]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Cannot play audio:", error);
      setIsPlaying(false);
    }
  }

  function handlePrev() {
    if (!playlist.length) return;
    setCurrentIndex((prev) => (prev === 0 ? playlist.length - 1 : prev - 1));
  }

  function handleNext() {
    if (!playlist.length) return;
    setCurrentIndex((prev) => (prev === playlist.length - 1 ? 0 : prev + 1));
  }

  function handleSeek(event) {
    const audio = audioRef.current;
    if (!audio) return;

    const nextTime = Number(event.target.value);

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="app-shell"
      style={{
        "--theme-a": theme.a,
        "--theme-b": theme.b,
        "--theme-c": theme.c,
      }}
    >
      <AuroraBackground isPlaying={isPlaying} />
      <ThreePulseOrbs isPlaying={isPlaying} />

      <div className="screen-vignette"></div>
      <div className="screen-grain"></div>

      {currentTrack ? (
        <audio ref={audioRef} preload="metadata">
          <source src={currentTrack.audio} type="audio/mpeg" />
        </audio>
      ) : null}

      <main className="player-layout single-layout">
        {!scanDone ? (
          <section className="main-card skeleton-card" aria-hidden="true"></section>
        ) : null}

        {scanDone && !playlist.length ? (
          <section className="main-card status-card empty-card">
            <h2>Không tìm thấy bài nhạc</h2>
            <p>
              Thêm file vào thư mục <strong>public/music</strong> theo dạng:
            </p>
            <p>song1.mp3, song2.mp3, cover1.png, cover2.png</p>
          </section>
        ) : null}

        {currentTrack ? (
          <section className="main-card">
            <div className="main-card-inner">
              <div className="artwork-stage">
                <div className="cover-wrap">
                  <img
                    className="cover-image"
                    src={currentTrack.cover}
                    alt={currentTrack.title}
                  />
                </div>

                <div className="disc-wrap">
                  <VinylDisc cover={currentTrack.cover} isPlaying={isPlaying} />
                </div>
              </div>

              <div className="control-stage">
                <div className="track-meta">
                  <span className="eyebrow">Now Playing</span>
                  <h1>{currentTrack.title}</h1>
                  <p>{currentTrack.artist}</p>
                  <div
                    className={`eq-bars ${isPlaying ? "is-playing" : ""}`}
                    aria-hidden="true"
                  >
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>

                <div className="progress-section">
                  <div className="progress-rail">
                    <div
                      className="progress-fill"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>

                  <input
                    className="progress-range"
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="1"
                    value={currentTime}
                    onChange={handleSeek}
                    aria-label="Seek track"
                  />

                  <div className="time-row">
                    <span>{formatTime(currentTime)}</span>
                    <span>{isLoaded ? formatTime(duration) : "--:--"}</span>
                  </div>
                </div>

                <div className="controls-row">
                  <button
                    className="control-button ghost-button"
                    onClick={handlePrev}
                    aria-label="Previous track"
                  >
                    <MusicIcon type="prev" />
                  </button>

                  <button
                    className="control-button play-button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    <MusicIcon type={isPlaying ? "pause" : "play"} />
                  </button>

                  <button
                    className="control-button ghost-button"
                    onClick={handleNext}
                    aria-label="Next track"
                  >
                    <MusicIcon type="next" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
