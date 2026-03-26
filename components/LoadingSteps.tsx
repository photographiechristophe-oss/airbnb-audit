"use client";

import { useState, useEffect } from "react";

const STEPS = [
  { icon: "🔗", label: "Récupération de l'annonce" },
  { icon: "📸", label: "Analyse des visuels" },
  { icon: "✍️", label: "Titre & accroche" },
  { icon: "📝", label: "Description & storytelling" },
  { icon: "🏠", label: "Équipements & services" },
  { icon: "💰", label: "Positionnement tarifaire" },
  { icon: "⭐", label: "Avis & réputation" },
  { icon: "🔑", label: "Check-in & accueil" },
  { icon: "📊", label: "Calcul du score final" },
];

const STEP_INTERVAL = 3400;

export default function LoadingSteps() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, STEP_INTERVAL);

    return () => clearInterval(stepTimer);
  }, []);

  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const target = ((currentStep + 1) / STEPS.length) * 90;
        const diff = target - prev;
        return prev + diff * 0.1;
      });
    }, 100);

    return () => clearInterval(progressTimer);
  }, [currentStep]);

  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(dotsTimer);
  }, []);

  return (
    <div
      style={{
        animation: "fadeSlideIn 0.5s ease-out",
        padding: "40px 0",
      }}
    >
      {/* Percentage */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <span
          style={{
            fontSize: "48px",
            fontWeight: 800,
            color: "#EBBA4D",
            fontFamily: "'Raleway', sans-serif",
          }}
        >
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          height: "8px",
          backgroundColor: "#E0E0E0",
          borderRadius: "4px",
          overflow: "hidden",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: "4px",
            background:
              "linear-gradient(90deg, #EBBA4D, #F5D98A, #EBBA4D)",
            backgroundSize: "200% 100%",
            animation: "shimmer 2s linear infinite",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Steps list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {STEPS.map((step, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                backgroundColor: isCurrent ? "#FDF8EE" : "transparent",
                opacity: isPending ? 0.35 : 1,
                transition: "all 0.3s ease",
              }}
            >
              {/* Status circle */}
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  minWidth: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 700,
                  backgroundColor: isDone
                    ? "#2D8C5A"
                    : isCurrent
                    ? "#EBBA4D"
                    : "#E0E0E0",
                  color: isDone || isCurrent ? "#FFFFFF" : "#A0A0A0",
                  animation: isCurrent ? "pulse 1.5s ease-in-out infinite" : "none",
                }}
              >
                {isDone ? "✓" : ""}
              </div>

              {/* Step label */}
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: isCurrent ? 600 : 400,
                  color: isDone ? "#2D8C5A" : isCurrent ? "#1A1A1A" : "#A0A0A0",
                }}
              >
                {step.icon} {step.label}
                {isCurrent && (
                  <span style={{ color: "#EBBA4D" }}>{dots}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
