"use client";

import { useState, useEffect } from "react";

interface BarData {
  label: string;
  currentValue: number;
  projectedValue: number;
  unit: string;
  gain: string;
  color: string;
}

const BARS: BarData[] = [
  {
    label: "Réservations",
    currentValue: 55,
    projectedValue: 85,
    unit: "%",
    gain: "+30%",
    color: "#4CAF50",
  },
  {
    label: "Tarif / nuitée",
    currentValue: 60,
    projectedValue: 80,
    unit: "%",
    gain: "+20%",
    color: "#EBBA4D",
  },
  {
    label: "Visibilité Airbnb",
    currentValue: 45,
    projectedValue: 75,
    unit: "%",
    gain: "+30%",
    color: "#5B9BD5",
  },
];

export default function PhotoImpactChart() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        background: "linear-gradient(160deg, #1A1A1A 0%, #111 50%, #1A1A1A 100%)",
        borderRadius: "20px",
        overflow: "hidden",
        border: "1px solid rgba(235, 186, 77, 0.12)",
        animation: "fadeSlideIn 0.6s ease-out 0.6s both",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "24px 32px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, rgba(235, 186, 77, 0.2), rgba(235, 186, 77, 0.05))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            📊
          </div>
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 800,
                color: "#FFFFFF",
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              Impact estimé avec des photos pro
            </h3>
            <p
              style={{
                fontSize: "12px",
                color: "#888",
                margin: "2px 0 0 0",
              }}
            >
              Basé sur les statistiques Airbnb moyennes
            </p>
          </div>
        </div>
      </div>

      {/* Bars */}
      <div style={{ padding: "24px 32px 28px" }}>
        {BARS.map((bar, i) => (
          <div key={bar.label} style={{ marginBottom: i < BARS.length - 1 ? "24px" : "0" }}>
            {/* Label row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#CCC" }}>
                {bar.label}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 800,
                  color: bar.color,
                  background: `${bar.color}18`,
                  padding: "3px 10px",
                  borderRadius: "6px",
                }}
              >
                {bar.gain}
              </span>
            </div>

            {/* Bar container */}
            <div style={{ position: "relative", height: "32px" }}>
              {/* Background track */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                }}
              />

              {/* Current bar (darker) */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "32px",
                  borderRadius: "8px",
                  width: animated ? `${bar.currentValue}%` : "0%",
                  background: `${bar.color}40`,
                  transition: `width 1s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.2}s`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    right: "10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: `${bar.color}CC`,
                    opacity: animated ? 1 : 0,
                    transition: `opacity 0.5s ease ${i * 0.2 + 0.8}s`,
                  }}
                >
                  Actuel
                </span>
              </div>

              {/* Projected bar (brighter, on top) */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "32px",
                  borderRadius: "8px",
                  width: animated ? `${bar.projectedValue}%` : "0%",
                  background: `linear-gradient(90deg, ${bar.color}20, ${bar.color}90)`,
                  transition: `width 1.4s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.2 + 0.3}s`,
                  borderRight: `3px solid ${bar.color}`,
                  boxShadow: animated ? `0 0 20px ${bar.color}30` : "none",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#FFF",
                    opacity: animated ? 1 : 0,
                    transition: `opacity 0.5s ease ${i * 0.2 + 1.2}s`,
                    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                  }}
                >
                  Avec photos pro
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 32px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#EBBA4D",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <p style={{ fontSize: "12px", color: "#777", margin: 0, fontStyle: "italic" }}>
          Les annonces avec photos professionnelles se classent mieux dans les résultats de recherche Airbnb
        </p>
      </div>
    </div>
  );
}
