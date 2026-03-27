"use client";

interface CTABlockProps {
  recommandation: string;
  score: number;
}

// Parse **bold** markdown into React elements
function renderBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "#EBBA4D", fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function CTABlock({
  recommandation,
  score,
}: CTABlockProps) {
  const getScoreLabel = () => {
    if (score >= 85) return "Excellente annonce !";
    if (score >= 75) return "Bonne annonce";
    if (score >= 60) return "Annonce correcte, peut mieux faire";
    if (score >= 40) return "Annonce à améliorer";
    return "Annonce à retravailler en profondeur";
  };

  // Split recommandation into paragraphs by \n\n or \n
  const paragraphs = recommandation
    .split(/\n\n|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

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

      {/* Texte de recommandation */}
      <div style={{ padding: "32px 36px" }}>
        {paragraphs.map((paragraph, i) => (
          <p
            key={i}
            style={{
              fontSize: "15px",
              color: "#D4D4D4",
              lineHeight: 1.9,
              marginBottom: i < paragraphs.length - 1 ? "18px" : "0",
              marginTop: 0,
            }}
          >
            {renderBoldText(paragraph)}
          </p>
        ))}
      </div>

      {/* Séparateur */}
      <div
        style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(235, 186, 77, 0.3), transparent)",
          margin: "0 32px",
        }}
      />

      {/* CTA */}
      <div
        style={{
          padding: "28px 32px 32px 32px",
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
