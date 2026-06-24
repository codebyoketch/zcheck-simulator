import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WaveBg from '../components/WaveBg';
import Navbar from '../components/Navbar';
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
  const [agreed,    setAgreed]  = useState(false);
  const [hours,     setHours]   = useState('');
  const [minutes,   setMinutes] = useState('');
  const [fsErr,     setFsErr]   = useState('');
  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const checkpoint = params.get('checkpoint');

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

    // Calculate total seconds from timer inputs
    const totalSeconds =
      (parseInt(hours   || '0') * 3600) +
      (parseInt(minutes || '0') * 60);

    const query = new URLSearchParams();
    if (checkpoint)         query.set('checkpoint', checkpoint);
    if (totalSeconds > 0)   query.set('timer', totalSeconds);

    navigate(`/practice?${query.toString()}`);
  };

  const timerSet = (parseInt(hours || '0') + parseInt(minutes || '0')) > 0;

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
                Read carefully before starting your session
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

          {/* Timer setter */}
          <div className="disclaimer-timer-section">
            <div className="disclaimer-timer-label mono">
              ⏱ Session timer <span className="text-muted">(optional — leave blank for untimed)</span>
            </div>
            <div className="disclaimer-timer-inputs">
              <div className="timer-input-wrap">
                <input
                  className="input timer-input"
                  type="number"
                  min="0" max="23"
                  placeholder="0"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                />
                <span className="timer-unit mono">hrs</span>
              </div>
              <span className="timer-sep mono">:</span>
              <div className="timer-input-wrap">
                <input
                  className="input timer-input"
                  type="number"
                  min="0" max="59"
                  placeholder="0"
                  value={minutes}
                  onChange={e => setMinutes(e.target.value)}
                />
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
            <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
              ← Go back
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
