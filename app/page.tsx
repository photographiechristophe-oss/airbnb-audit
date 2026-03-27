"use client";

import { useState } from "react";
import AuditForm from "../components/AuditForm";
import LoadingSteps from "../components/LoadingSteps";
import ScoreGauge from "../components/ScoreGauge";
import ResultCard from "../components/ResultCard";
import CategoryCard from "../components/CategoryCard";
import CTABlock from "../components/CTABlock";
import PDFDownload from "../components/PDFDownload";
import Footer from "../components/Footer";

interface Category {
  name: string;
  icon: string;
  score: number;
  max: number;
  detail: string;
  suggestions: string[];
}

interface AuditResult {
  listing_title: string;
  location: string;
  property_type: string;
  score_global: number;
  verdict: string;
  points_forts: string[];
  points_critiques: string[];
  categories: Category[];
  recommandation_visuelle: string;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      setResult(data);
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError("");
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      {/* Header */}
      <header style={{ textAlign: "center", paddingTop: "40px", paddingBottom: "8px" }}>
        {/* Gold decorative bar */}
        <div
          style={{
            width: "60px",
            height: "4px",
            backgroundColor: "#EBBA4D",
            borderRadius: "2px",
            margin: "0 auto 24px auto",
          }}
        />
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#1A1A1A",
            marginBottom: "8px",
          }}
        >
          Audit Annonce Airbnb
        </h1>
        <p style={{ fontSize: "15px", color: "#6B6B6B", marginBottom: "4px" }}>
          par{" "}
          <a
            href="https://www.votrephotographeimmo.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#C99A2E",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            votrephotographeimmo.com
          </a>
        </p>
        <p
          style={{
            fontSize: "13px",
            color: "#A0A0A0",
            lineHeight: 1.6,
            marginTop: "16px",
            marginBottom: "32px",
          }}
        >
          Photos • Titre • Description • Équipements • Tarif • Avis • Check-in
        </p>
      </header>

      {/* Form (hidden when showing results) */}
      {!result && !loading && (
        <div style={{ animation: "fadeSlideIn 0.5s ease-out" }}>
          <AuditForm onSubmit={handleAnalyze} loading={loading} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            backgroundColor: "#FDECEC",
            border: "1px solid #f0c4c4",
            borderRadius: "12px",
            padding: "20px",
            marginTop: "20px",
            animation: "fadeSlideIn 0.3s ease-out",
          }}
        >
          <p
            style={{
              fontSize: "15px",
              color: "#B33A3A",
              lineHeight: 1.6,
            }}
          >
            ⚠️ {error}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#6B6B6B",
              marginTop: "8px",
            }}
          >
            Vérifiez que le lien est correct et réessayez. Si le problème persiste,
            l&apos;annonce est peut-être privée ou indisponible.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSteps />}

      {/* Results */}
      {result && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            paddingBottom: "20px",
          }}
        >
          <ScoreGauge
            score={result.score_global}
            title={result.listing_title}
            location={result.location}
            propertyType={result.property_type}
            verdict={result.verdict}
          />

          <ResultCard
            pointsForts={result.points_forts}
            pointsCritiques={result.points_critiques}
          />

          {/* Category header */}
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase" as const,
              color: "#A0A0A0",
              marginTop: "8px",
            }}
          >
            Détail par catégorie
          </h3>

          {result.categories.map((cat, i) => (
            <CategoryCard key={cat.name} category={cat} index={i} />
          ))}

          <CTABlock
            recommandation={result.recommandation_visuelle}
            score={result.score_global}
            pointsForts={result.points_forts}
            pointsCritiques={result.points_critiques}
          />

          {/* PDF Download button */}
          <PDFDownload
            listingTitle={result.listing_title}
            auditData={result}
          />

          {/* Reset button */}
          <button
            onClick={handleReset}
            style={{
              width: "100%",
              padding: "14px 24px",
              fontSize: "15px",
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              color: "#6B6B6B",
              backgroundColor: "transparent",
              border: "2px solid #E0E0E0",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              marginTop: "4px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#EBBA4D";
              e.currentTarget.style.color = "#C99A2E";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E0E0E0";
              e.currentTarget.style.color = "#6B6B6B";
            }}
          >
            Analyser une autre annonce
          </button>

          <Footer />
        </div>
      )}

      {/* Footer when no results */}
      {!result && !loading && <Footer />}
    </div>
  );
}
