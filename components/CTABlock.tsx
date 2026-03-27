"use client";

interface CTABlockProps {
  recommandation: string;
  score: number;
  pointsForts: string[];
  pointsCritiques: string[];
}

export default function CTABlock({
  recommandation,
  score,
  pointsForts,
  pointsCritiques,
}: CTABlockProps) {
  const getScoreColor = () => {
    if (score >= 75) return "#4CAF50";
    if (score >= 50) return "#EBBA4D";
    return "#E74C3C";
  };

  const getScoreLabel = () => {
    if (score >= 85) return "Excellente annonce !";
    if (score >= 75) return "Bonne annonce";
    if (score >= 60) return "Annonce correcte, peut mieux faire";
    if (score >= 40) return "Annonce à améliorer";
    return "Annonce à retravailler en profondeur";
  };

  return (
    <div
      style={{
        background: "linear-gradient(160deg, #1A1A1A 0%, #0D0D0D 50%, #1A1A1A 100%)",
        borderRadius: "20px",
        padding: "0",
        overflow: "hidden",
        animation: "fadeSlideIn 0.6s ease-out 0.8s both",
        border: "1px solid rgba(235, 186, 77, 0.15)",
      }}
    >
      {/* Header doré */}
      <div
        style={{
          background: "linear-gradient(135deg, #EBBA4D 0%, #D4A43A 100%)",
          padding: "24px 32px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "#1A1A1A",
            margin: "0 0 8px 0",
            opacity: 0.7,
          }}
        >
          Résumé de votre audit
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
          }}
        >
          <span
            style={{
              fontSize: "48px",
              fontWeight: 900,
              color: "#1A1A1A",
              lineHeight: 1,
            }}
          >
            {score}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "rgba(26, 26, 26, 0.6)",
              lineHeight: 1,
            }}
          >
            / 100
          </span>
        </div>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#1A1A1A",
            margin: "8px 0 0 0",
          }}
        >
          {getScoreLabel()}
        </p>
      </div>

      {/* Bilan rapide */}
      <div style={{ padding: "28px 32px 0 32px" }}>
        {/* Points forts et critiques côte à côte */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginBottom: "28px",
          }}
        >
          {/* Points forts */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#4CAF50",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "#4CAF50",
                }}
              >
                Points forts
              </span>
            </div>
            {pointsForts.slice(0, 3).map((point, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <span style={{ color: "#4CAF50", fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>✓</span>
                <span style={{ fontSize: "13px", color: "#B0B0B0", lineHeight: 1.5 }}>
                  {point}
                </span>
              </div>
            ))}
          </div>

          {/* Points critiques */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#E74C3C",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "#E74C3C",
                }}
              >
                À améliorer
              </span>
            </div>
            {pointsCritiques.slice(0, 3).map((point, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <span style={{ color: "#E74C3C", fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>✗</span>
                <span style={{ fontSize: "13px", color: "#B0B0B0", lineHeight: 1.5 }}>
                  {point}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Séparateur */}
        <div
          style={{
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(235, 186, 77, 0.3), transparent)",
            marginBottom: "24px",
          }}
        />

        {/* Recommandation */}
        <p
          style={{
            fontSize: "15px",
            color: "#D4D4D4",
            lineHeight: 1.8,
            textAlign: "center",
            marginBottom: "28px",
            fontStyle: "italic",
            maxWidth: "520px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          &ldquo;{recommandation}&rdquo;
        </p>
      </div>

      {/* CTA */}
      <div
        style={{
          padding: "0 32px 32px 32px",
          textAlign: "center",
        }}
      >
        <a
          href="https://www.votrephotographeimmo.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "18px 40px",
            fontSize: "16px",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 700,
            color: "#1A1A1A",
            background: "linear-gradient(135deg, #EBBA4D 0%, #F5D98A 50%, #EBBA4D 100%)",
            backgroundSize: "200% 200%",
            borderRadius: "14px",
            textDecoration: "none",
            transition: "all 0.3s ease",
            letterSpacing: "0.3px",
            boxShadow: "0 4px 20px rgba(235, 186, 77, 0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 8px 30px rgba(235, 186, 77, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(235, 186, 77, 0.3)";
          }}
        >
          Demander un devis photo gratuit
          <span style={{ fontSize: "20px" }}>→</span>
        </a>
        <p
          style={{
            fontSize: "12px",
            color: "#666",
            marginTop: "14px",
          }}
        >
          votrephotographeimmo.com · Photographe spécialisé en Provence
        </p>
      </div>
    </div>
  );
}
