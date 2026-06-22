import React from 'react';

export default function WaveBg() {
  return (
    <div className="wave-bg">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        {/* flowing contour lines matching zone01 aesthetic */}
        {[...Array(18)].map((_, i) => (
          <path
            key={i}
            d={`M${-200 + i * 20},${100 + i * 40}
               C${200 + i * 15},${-50 + i * 35}
                ${600 + i * 10},${300 + i * 30}
                ${900 + i * 8},${200 + i * 25}
               S${1300 + i * 5},${500 + i * 20}
                ${1700 + i * 3},${400 + i * 18}`}
            fill="none"
            stroke="#e8e8f0"
            strokeWidth="0.8"
            strokeOpacity={0.4 - i * 0.015}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <path
            key={`b${i}`}
            d={`M${1600 - i * 25},${800 - i * 30}
               C${1200 - i * 20},${950 - i * 25}
                ${800 - i * 15},${650 - i * 20}
                ${500 - i * 10},${750 - i * 15}
               S${100 - i * 5},${500 - i * 10}
                ${-200 - i * 3},${600 - i * 8}`}
            fill="none"
            stroke="#e8e8f0"
            strokeWidth="0.6"
            strokeOpacity={0.25 - i * 0.012}
          />
        ))}
      </svg>
    </div>
  );
}
