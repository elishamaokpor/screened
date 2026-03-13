'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

const STAMPS = {
  'The Criterionist': '/stamps/aplus.png',
  'The Completionist': '/stamps/bplus.png',
  'The New Romantic':  '/stamps/bminus.png',
  'The Horehead':      '/stamps/cplus.png',
  'The Contrarian':    '/stamps/f.png',
};

const LOADING_MSGS = [
  'counting your watches...',
  'developing the film...',
  'rolling the credits...',
  'cross-referencing cannes...',
  'consulting the auteurs...',
  'reading your diary...',
];

export default function Home() {
  const [view, setView] = useState('landing');
  const [username, setUsername] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get('u');
    if (u) generate(u);
  }, []);

  async function generate(user) {
    const u = (user || username).trim();
    if (!u) return;
    setError(null);
    setView('loading');

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

      setData(json);
      setView('receipt');
      window.history.pushState({}, '', `?u=${encodeURIComponent(u)}`);
    } catch (err) {
      clearInterval(interval);
      setError('Something went wrong. Try again.');
      setView('landing');
    }
  }

  function goBack() {
    setView('landing');
    setData(null);
    window.history.pushState({}, '', '/');
  }

  const share = () => {
    const url = `${window.location.origin}?u=${data.username}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.bg}>
        <video
          className={styles.bgVideo}
          src="https://res.cloudinary.com/dt8kyoh6k/video/upload/v1773330742/12294617_3840_2160_30fps_wekwfx.mp4"
          autoPlay muted loop playsInline
        />
        <div className={styles.bgOverlay} />
      </div>

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

      {view === 'loading' && (
        <div className={styles.loading}>
          <LoadingFrames />
          <div className={styles.loadingMsg}>{loadingMsg}</div>
        </div>
      )}

      {view === 'receipt' && data && (
        <div className={styles.receiptView}>
          <div className={styles.receiptNav}>
            <button className={styles.backBtn} onClick={goBack}>← back</button>
            <button className={styles.shareBtn} onClick={share}>
              {copied ? 'COPIED!' : 'SHARE'}
            </button>
          </div>

          <div className={styles.receipt}>
            <img className={styles.texture} src="/texture.png" alt="" />
            <img className={styles.stamp} src={STAMPS[data.personality]} alt={data.grade} />

            <div className={styles.receiptInner}>
              <div className={styles.rHeader}>
                <div className={styles.rStore}>Scree<em>ned</em></div>
                <div className={styles.rTagline}>your letterboxd in film.</div>
              </div>

              <div className={styles.rBody}>
                <div className={styles.rMeta}>
                  <div>order #{String(Math.floor(Math.random()*900)+1).padStart(3,'0')} for @{data.username.toUpperCase()}</div>
                  <div>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</div>
                </div>

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

                <div className={styles.rStats}>
                  <StatRow label="total films" value={`${data.totalFilms} films`} />
                  <StatRow label="total runtime" value={data.totalRuntime} />
                  <StatRow label="top director" value={data.topDirector} />
                  <StatRow label="top genre" value={data.topGenre} />
                </div>

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
      <span className={styles.rDots}></span>
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