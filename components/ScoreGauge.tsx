"use client";

import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  title: string;
  location: string;
  propertyType: string;
  verdict: string;
}

export default function ScoreGauge({
  score,
  title,
  location,
  propertyType,
  verdict,
}: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1500;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color = score >= 75 ? "#2D8C5A" : score >= 50 ? "#D4872E" : "#B33A3A";
  const bgColor =
    score >= 75 ? "#E8F5EE" : score >= 50 ? "#FFF3E0" : "#FDECEC";

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (animatedScore / 100) * circumference;

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: "16px",
        border: "1px solid #E0E0E0",
        padding: "32px 24px",
        textAlign: "center",
        animation: "fadeSlideIn 0.6s ease-out",
      }}
    >
      {/* SVG Gauge */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <svg width="140" height="140" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#E0E0E0"
            strokeWidth="10"
          />
          {/* Score circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
          {/* Score text */}
          <text
            x="60"
            y="55"
            textAnchor="middle"
            style={{
              fontSize: "28px",
              fontWeight: 800,
              fontFamily: "'Raleway', sans-serif",
              fill: color,
            }}
          >
            {animatedScore}
          </text>
          <text
            x="60"
            y="74"
            textAnchor="middle"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              fontFamily: "'Raleway', sans-serif",
              fill: "#A0A0A0",
            }}
          >
            / 100
          </text>
        </svg>
      </div>

      {/* Score label */}
      <div
        style={{
          display: "inline-block",
          marginTop: "12px",
          padding: "6px 16px",
          borderRadius: "20px",
          backgroundColor: bgColor,
          color: color,
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.5px",
        }}
      >
        {score >= 75
          ? "Excellente annonce"
          : score >= 50
          ? "Annonce correcte, peut mieux faire"
          : "Annonce à optimiser d'urgence"}
      </div>

      {/* Listing info */}
      <h2
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "#1A1A1A",
          marginTop: "20px",
          lineHeight: 1.3,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: "#6B6B6B",
          marginTop: "8px",
        }}
      >
        📍 {location} &nbsp;•&nbsp; {propertyType}
      </p>
      <p
        style={{
          fontSize: "15px",
          fontStyle: "italic",
          color: "#2A2A2A",
          marginTop: "16px",
          lineHeight: 1.6,
        }}
      >
        &ldquo;{verdict}&rdquo;
      </p>
    </div>
  );
}
