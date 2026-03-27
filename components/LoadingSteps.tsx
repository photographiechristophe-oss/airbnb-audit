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
        padding: "20px 0",
      }}
    >
      {/* Percentage */}
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <span
          style={{
            fontSize: "40px",
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
          height: "6px",
          backgroundColor: "#E0E0E0",
          borderRadius: "3px",
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: "3px",
            background:
              "linear-gradient(90deg, #EBBA4D, #F5D98A, #EBBA4D)",
            backgroundSize: "200% 100%",
            animation: "shimmer 2s linear infinite",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Patience message when nearing the end */}
      {progress > 75 && (
        <p
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "#999",
            margin: "0 0 12px 0",
            fontStyle: "italic",
            animation: "fadeSlideIn 0.5s ease-out",
          }}
        >
          L&apos;analyse est en cours de finalisation, encore quelques secondes...
        </p>
      )}

      {/* Steps list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
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
                gap: "10px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: isCurrent ? "#FDF8EE" : "transparent",
                opacity: isPending ? 0.35 : 1,
                transition: "all 0.3s ease",
              }}
            >
              {/* Status circle */}
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  minWidth: "22px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
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
                  fontSize: "13px",
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
