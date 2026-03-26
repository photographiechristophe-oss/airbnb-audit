"use client";

interface ResultCardProps {
  pointsForts: string[];
  pointsCritiques: string[];
}

export default function ResultCard({
  pointsForts,
  pointsCritiques,
}: ResultCardProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
        animation: "fadeSlideIn 0.6s ease-out 0.2s both",
      }}
    >
      {/* Points forts */}
      <div
        style={{
          backgroundColor: "#E8F5EE",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #c3e6d1",
        }}
      >
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase" as const,
            color: "#2D8C5A",
            marginBottom: "12px",
          }}
        >
          Points forts
        </h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {pointsForts.map((point, i) => (
            <li
              key={i}
              style={{
                fontSize: "14px",
                color: "#1A1A1A",
                lineHeight: 1.6,
                paddingLeft: "20px",
                position: "relative",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  color: "#2D8C5A",
                  fontWeight: 700,
                }}
              >
                ✓
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Points critiques */}
      <div
        style={{
          backgroundColor: "#FDECEC",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid #f0c4c4",
        }}
      >
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase" as const,
            color: "#B33A3A",
            marginBottom: "12px",
          }}
        >
          Points à améliorer
        </h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {pointsCritiques.map((point, i) => (
            <li
              key={i}
              style={{
                fontSize: "14px",
                color: "#1A1A1A",
                lineHeight: 1.6,
                paddingLeft: "20px",
                position: "relative",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  color: "#B33A3A",
                  fontWeight: 700,
                }}
              >
                ✗
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
