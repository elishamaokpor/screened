'use client';

import { useState } from 'react';
import styles from './page.module.css';

const STAMPS = {
  'The Criterionist': '/stamps/aplus.png',
  'The Completionist': '/stamps/bplus.png',
  'The New Romantic':  '/stamps/bminus.png',
  'The Horehead':      '/stamps/cplus.png',
  'The Contrarian':    '/stamps/f.png',
};

const ROASTS = {
  'The Criterionist': [
    "You sat through three hours of cinema just to prove you're unimpressed. Incredible use of time. Clap for yourself.",
    "Your watchlist looks like a film syllabus nobody asked for.",
    "Rates every 3-hour black-and-white Lithuanian film 4.5 stars and calls it meditative.",
    "You've seen 400 films. Zero of them were fun on purpose.",
    "Nobody asked what Tarkovsky would think. You told them anyway.",
  ],
  'The Contrarian': [
    "Watched the most hyped film of the year just to call it mid. You're so brave.",
    "Your Letterboxd is a graveyard of 2-star reviews for films everyone else enjoyed.",
    "Popular opinion found dead. You were the last one seen with it.",
    "If a film has over 50k ratings, you immediately develop critical standards.",
    "You sat through three hours of cinema just to prove you're unimpressed. Revolutionary thinking.",
  ],
  'The Completionist': [
    "At this point you're not watching films, you're haunting them.",
    "Your hobby is pressing play. Your other hobby is also pressing play.",
    "You watch films the way other people eat — constantly, joylessly, out of habit.",
    "You've seen everything. Absorbed nothing.",
    "Somehow every single one is pretty good.",
  ],
  'The Horehead': [
    "Still waiting for one of these to actually scare you. It won't.",
    "Every review is just 'not scary but fun' with slight variations.",
    "You rate slashers and Bergman on the same scale and feel nothing about that.",
    "You don't watch movies. You watch people make terrible decisions in the dark.",
    "Knows the entire Friday the 13th timeline but couldn't tell you their best friend's birthday.",
  ],
  'The New Romantic': [
    "You're not watching films. You're curating a heartbreak playlist.",
    "Logged 47 films about yearning. You doing okay?",
    "Your Letterboxd is just beautiful people staring out windows while sad music plays.",
    "You gave it 5 stars because it made you cry. That's not a review. That's a symptom.",
    "One A24 film and it became your entire interior life.",
  ],
};

const LOADING_MSGS = [
  'counting your watches...',
  'developing the film...',
  'rolling the credits...',
  'cross-referencing cannes...',
  'consulting the auteurs...',
  'reading your diary...',
];

function pickRoast(type) {
  const pool = ROASTS[type] || ROASTS['The Criterionist'];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function Home() {
  const [view, setView] = useState('landing'); // landing | loading | receipt
  const [username, setUsername] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function generate(user) {
    const u = user || username.trim();
    if (!u) return;
    setError(null);
    setView('loading');

    // cycle loading messages
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[i]);
    }, 700);

    try {
      const res = await fetch(`/api/scrape?username=${encodeURIComponent(u)}`);
      const json = await res.json();
      clearInterval(interval);

      if (json.error) {
        setError(json.error);
        setView('landing');
        return;
      }

      setData({ ...json, roast: pickRoast(json.personality) });
      setView('receipt');
    } catch (err) {
      clearInterval(interval);
      setError('Something went wrong. Try again.');
      setView('landing');
    }
  }

  function goBack() {
    setView('landing');
    setData(null);
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: 'Screened', text: `my letterboxd receipt — screened.film` });
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Link copied!');
      });
    }
  }

  return (
    <div className={styles.root}>
      {/* Background video */}
      <div className={styles.bg}>
        <video
          className={styles.bgVideo}
          src="https://res.cloudinary.com/dt8kyoh6k/video/upload/v1773330742/12294617_3840_2160_30fps_wekwfx.mp4"
          autoPlay muted loop playsInline
        />
        <div className={styles.bgOverlay} />
      </div>

      {/* LANDING */}
      {view === 'landing' && (
        <div className={styles.landing}>
          <div className={styles.topbarCredit}>
            Made by <a href="https://x.com/0xjaju" target="_blank" rel="noreferrer">elishama</a> &lt;3 Not Affiliated with Letterboxd
          </div>

          <div className={styles.landingModal}>
            <div className={styles.landingTop}>
              <div className={styles.titleBlock}>
                <div className={styles.title}>Scree<em>ned</em></div>
                <div className={styles.subtitle}>letterboxd · receipt generator</div>
              </div>

              <div className={styles.form}>
                <div className={styles.inputRow}>
                  <div className={styles.inputPrefix}>letterboxd.com/</div>
                  <input
                    className={styles.input}
                    placeholder="yourusername"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generate()}
                  />
                </div>
                <button className={styles.btnPrimary} onClick={() => generate()}>
                  PRINT MY RECEIPT
                </button>
                {error && <div className={styles.errorMsg}>{error}</div>}
                <button className={styles.demoLink} onClick={() => generate('elishamaaaaa')}>
                  or try the demo
                </button>
              </div>
            </div>

            <div className={styles.about}>
              <div className={styles.aboutLabel}>ABOUT</div>
              <p>You&apos;ve logged the films. Now see what they say about you. Enter your Letterboxd username and get a receipt of your highest rated films — plus a diagnosis of your taste.</p>
            </div>
          </div>
        </div>
      )}

      {/* LOADING */}
      {view === 'loading' && (
        <div className={styles.loading}>
          <LoadingFrames />
          <div className={styles.loadingMsg}>{loadingMsg}</div>
        </div>
      )}

      {/* RECEIPT */}
      {view === 'receipt' && data && (
        <div className={styles.receiptView}>
          <div className={styles.receiptNav}>
            <button className={styles.backBtn} onClick={goBack}>← back</button>
            <button className={styles.shareBtn} onClick={share}>SHARE</button>
          </div>

          <div className={styles.receipt}>
            <img
              className={styles.texture}
              src="/texture.png"
              alt=""
            />
            <img
              className={styles.stamp}
              src={STAMPS[data.personality]}
              alt={data.grade}
            />

            <div className={styles.receiptInner}>
              {/* Header */}
              <div className={styles.rHeader}>
                <div className={styles.rStore}>Scree<em>ned</em></div>
                <div className={styles.rTagline}>your letterboxd in film.</div>
              </div>

              <div className={styles.rBody}>
                {/* Order meta */}
                <div className={styles.rMeta}>
                  <div>order #{String(Math.floor(Math.random()*900)+1).padStart(3,'0')} for @{data.username.toUpperCase()}</div>
                  <div>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</div>
                </div>

                {/* Film table */}
                <div className={styles.rColSection}>
          
                  <div className={styles.rColHeader}>
                    <span>film</span>
                    <div className={styles.rColRight}>
                      <span>runtime</span>
                      <span>★</span>
                    </div>
                  </div>
              
                </div>

                <div className={styles.rFilms}>
                  {data.films.map((f, i) => (
                    <div key={i} className={styles.rFilmRow}>
                      <span className={styles.rFilmTitle}>{f.title}</span>
                      <div className={styles.rFilmRight}>
                        <span className={styles.rFilmRuntime}>{f.runtime}</span>
                        <span className={styles.rFilmStars}>{f.stars}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className={styles.rStats}>
                  <StatRow label="total films" value={`${data.totalFilms} films`} />
                  <StatRow label="total runtime" value={data.totalRuntime} />
                  <StatRow label="top director" value={data.topDirector} />
                  <StatRow label="top genre" value={data.topGenre} />
                </div>

                {/* Diagnosis */}
                <div className={styles.rDiagnosis}>
                  <div className={styles.rDiagLabel}>your diagnosis</div>
                  <div className={styles.rDiagType}>{data.personality}</div>
                  <div className={styles.rDiagRoast}>{data.roast}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className={styles.rRow}>
      <span className={styles.rLabel}>{label}</span>
      <span className={styles.rDots}>
        
      </span>
      <span className={styles.rVal}>{value}</span>
    </div>
  );
}

function LoadingFrames() {
  return (
    <div className={styles.loadingFrames}>
      {[0,1,2,3,4].map(i => (
        <div key={i} className={styles.lf} />
      ))}
    </div>
  );
}