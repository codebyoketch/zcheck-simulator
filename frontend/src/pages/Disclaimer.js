import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WaveBg from '../components/WaveBg';
import Navbar from '../components/Navbar';
import { getCheckpoints, getLanguages } from '../api/client';
import './Disclaimer.css';

const RULES = [
  'This is a simulated exam environment. Treat it as a real checkpoint.',
  'Exercises are assigned level by level — you must pass each level to advance.',
  'You are locked to the exercise you receive. No swapping — pass it or terminate.',
  'If you cannot pass a level, terminate the session and come back prepared.',
  'Some test cases are hidden. You only see pass/fail — no input or expected output revealed.',
  'Hardcoding expected outputs will fail on hidden test cases.',
  'Certain imports are restricted per exercise (e.g. fmt may be forbidden — use z01 instead).',
  'All submissions and session results are recorded.',
];

export default function Disclaimer() {
  const [step, setStep]           = useState('select'); // 'select' | 'rules'
  const [languages,  setLanguages]  = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [selectedLang,   setSelectedLang]   = useState('');
  const [selectedCp,     setSelectedCp]     = useState('');
  const [hours,   setHours]   = useState('');
  const [minutes, setMinutes] = useState('');
  const [agreed,  setAgreed]  = useState(false);
  const [fsErr,   setFsErr]   = useState('');
  const [loading, setLoading] = useState(true);

  const navigate  = useNavigate();
  const [params]  = useSearchParams();
  const cpFromUrl = params.get('checkpoint');

  useEffect(() => {
    Promise.all([getLanguages(), getCheckpoints()])
      .then(([l, c]) => {
        setLanguages(l.data);
        setCheckpoints(c.data);
        // Pre-select if coming from checkpoint map
        if (cpFromUrl) {
          setSelectedCp(cpFromUrl);
          const cp = c.data.find(x => x.slug === cpFromUrl);
          if (cp) setSelectedLang(cp.language?.slug || '');
        }
      })
      .finally(() => setLoading(false));
  }, [cpFromUrl]);

  // Filter checkpoints by selected language
  const filteredCheckpoints = selectedLang
    ? checkpoints.filter(c => c.language?.slug === selectedLang)
    : checkpoints;

  const canProceed = selectedLang !== '';

  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen)       return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.mozRequestFullScreen)    return el.mozRequestFullScreen();
    return Promise.reject('not supported');
  };

  const handleStart = async () => {
    if (!agreed) return;
    try { await enterFullscreen(); }
    catch { setFsErr('Could not enter fullscreen — continuing anyway.'); }

    const totalSeconds =
      (parseInt(hours   || '0') * 3600) +
      (parseInt(minutes || '0') * 60);

    const query = new URLSearchParams();
    if (selectedCp)       query.set('checkpoint', selectedCp);
    if (selectedLang)     query.set('language', selectedLang);
    if (totalSeconds > 0) query.set('timer', totalSeconds);

    navigate(`/practice?${query.toString()}`);
  };

  const timerSet = (parseInt(hours || '0') + parseInt(minutes || '0')) > 0;

  // ── Step 1: Selection ──────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <div className="page disclaimer-page">
        <WaveBg />
        <Navbar />
        <div className="disclaimer-center">
          <div className="disclaimer-card card">
            <div className="disclaimer-header">
              <div className="disclaimer-icon">◈</div>
              <div>
                <h1 className="disclaimer-title mono">Session Setup</h1>
                <p className="disclaimer-sub text-muted">
                  Choose what you want to practice
                </p>
              </div>
            </div>

            {loading
              ? <div className="text-muted mono" style={{ padding: '20px 0' }}>Loading...</div>
              : <>
                  {/* Language selector */}
                  <div className="select-section">
                    <div className="select-label mono">Language</div>
                    <div className="select-grid">
                      {languages.map(l => (
                        <button
                          key={l.slug}
                          className={`select-card ${selectedLang === l.slug ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedLang(l.slug);
                            setSelectedCp(''); // reset checkpoint on language change
                          }}
                        >
                          <span className="select-card-name mono">{l.name}</span>
                          <span className="select-card-sub text-muted">
                            {checkpoints.filter(c => c.language?.slug === l.slug).length} checkpoint{checkpoints.filter(c => c.language?.slug === l.slug).length !== 1 ? 's' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Checkpoint selector — only shown after language picked */}
                  {selectedLang && (
                    <div className="select-section">
                      <div className="select-label mono">
                        Checkpoint
                        <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                          (optional — leave blank for all levels)
                        </span>
                      </div>
                      {filteredCheckpoints.length === 0
                        ? <p className="text-muted mono" style={{ fontSize: 13 }}>
                            No checkpoints configured for this language yet.
                          </p>
                        : <div className="select-grid">
                            {/* "All" option */}
                            <button
                              className={`select-card ${selectedCp === '' ? 'active' : ''}`}
                              onClick={() => setSelectedCp('')}
                            >
                              <span className="select-card-name mono">All</span>
                              <span className="select-card-sub text-muted">every level</span>
                            </button>
                            {filteredCheckpoints.map(c => (
                              <button
                                key={c.slug}
                                className={`select-card ${selectedCp === c.slug ? 'active' : ''}`}
                                onClick={() => setSelectedCp(c.slug)}
                              >
                                <span className="select-card-name mono">{c.name}</span>
                                <span className="select-card-sub text-muted">
                                  {c.exercise_count} exercise{c.exercise_count !== 1 ? 's' : ''}
                                </span>
                              </button>
                            ))}
                          </div>
                      }
                    </div>
                  )}
                </>
            }

            <div className="disclaimer-actions">
              <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep('rules')}
                disabled={!canProceed}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Rules + timer ───────────────────────────────────────────────
  return (
    <div className="page disclaimer-page">
      <WaveBg />
      <Navbar />
      <div className="disclaimer-center">
        <div className="disclaimer-card card">

          <div className="disclaimer-header">
            <div className="disclaimer-icon">⚠</div>
            <div>
              <h1 className="disclaimer-title mono">Exam Environment</h1>
              <p className="disclaimer-sub text-muted">
                {selectedLang.toUpperCase()}
                {selectedCp
                  ? ` — ${checkpoints.find(c => c.slug === selectedCp)?.name}`
                  : ' — All levels'}
              </p>
            </div>
          </div>

          <div className="disclaimer-rules">
            {RULES.map((rule, i) => (
              <div key={i} className="disclaimer-rule">
                <span className="rule-num mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="rule-text">{rule}</span>
              </div>
            ))}
          </div>

          {/* Timer */}
          <div className="disclaimer-timer-section">
            <div className="disclaimer-timer-label mono">
              ⏱ Session timer
              <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                (optional — leave blank for untimed)
              </span>
            </div>
            <div className="disclaimer-timer-inputs">
              <div className="timer-input-wrap">
                <input className="input timer-input" type="number"
                  min="0" max="23" placeholder="0"
                  value={hours} onChange={e => setHours(e.target.value)} />
                <span className="timer-unit mono">hrs</span>
              </div>
              <span className="timer-sep mono">:</span>
              <div className="timer-input-wrap">
                <input className="input timer-input" type="number"
                  min="0" max="59" placeholder="0"
                  value={minutes} onChange={e => setMinutes(e.target.value)} />
                <span className="timer-unit mono">min</span>
              </div>
            </div>
            {timerSet && (
              <div className="timer-confirm mono">
                Session will auto-terminate after{' '}
                {hours && parseInt(hours) > 0 ? `${hours}h ` : ''}
                {minutes && parseInt(minutes) > 0 ? `${minutes}m` : ''}
              </div>
            )}
          </div>

          <div className="disclaimer-fs-note mono">
            <span className="text-teal">⬛</span>
            {' '}The session will enter fullscreen. Press <kbd>Esc</kbd> to exit at any time.
          </div>

          {fsErr && <div className="disclaimer-warn mono">{fsErr}</div>}

          <label className="disclaimer-agree">
            <input type="checkbox" checked={agreed}
              onChange={e => setAgreed(e.target.checked)} />
            <span>I understand the rules and I am ready to begin.</span>
          </label>

          <div className="disclaimer-actions">
            <button className="btn btn-ghost" onClick={() => setStep('select')}>
              ← Change selection
            </button>
            <button className="btn btn-primary disclaimer-start"
              onClick={handleStart} disabled={!agreed}>
              Enter Session →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
