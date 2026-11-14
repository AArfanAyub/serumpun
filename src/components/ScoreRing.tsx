import type { JSX } from 'react';
import { clamp } from '@/domain/membership';

/** Hand-built SVG 0–100 score ring (Lovi pattern). No chart library. */
export function ScoreRing({ score, label }: { score: number; label?: string }): JSX.Element {
  const safeScore = clamp(Math.round(score), 0, 100);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const filled = (circumference * safeScore) / 100;
  return (
    <svg
      className="score-ring"
      viewBox="0 0 150 150"
      role="img"
      aria-label={`Suitability score ${safeScore} out of 100${label ? `, ${label}` : ''}`}
    >
      <title>{`Suitability score: ${safeScore} out of 100`}</title>
      <desc>Score shown as a circular gauge. It is decision support, not a yield prediction.</desc>
      <circle cx="75" cy="75" r={radius} fill="none" stroke="var(--sand)" strokeWidth="12" />
      <circle
        cx="75"
        cy="75"
        r={radius}
        fill="none"
        stroke="var(--green)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 75 75)"
      />
      <text
        x="75"
        y="80"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="46"
        fontWeight="800"
        fill="var(--green-dark)"
      >
        {safeScore}
      </text>
      <text x="75" y="106" textAnchor="middle" fontSize="13" fill="var(--muted)">
        out of 100
      </text>
    </svg>
  );
}
