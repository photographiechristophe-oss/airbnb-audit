"use client";

interface CTABlockProps {
  recommandation: string;
}

export default function CTABlock({ recommandation }: CTABlockProps) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)",
        borderRadius: "16px",
        padding: "36px 28px",
        textAlign: "center",
        animation: "fadeSlideIn 0.6s ease-out 0.8s both",
      }}
    >
      <h3
        style={{
          fontSize: "22px",
          fontWeight: 800,
          color: "#EBBA4D",
          marginBottom: "20px",
          lineHeight: 1.3,
        }}
      >
        Boostez vos réservations
        <br />
        avec des visuels pro
      </h3>

      <p
        style={{
          fontSize: "15px",
          color: "#d4d4d4",
          lineHeight: 1.8,
          marginBottom: "28px",
          maxWidth: "480px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {recommandation}
      </p>

      <a
        href="https://www.votrephotographeimmo.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "16px 36px",
          fontSize: "16px",
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 700,
          color: "#1A1A1A",
          backgroundColor: "#EBBA4D",
          borderRadius: "12px",
          textDecoration: "none",
          transition: "all 0.2s ease",
          letterSpacing: "0.3px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#F5D98A";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#EBBA4D";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        Demander un devis photo gratuit →
      </a>
    </div>
  );
}
