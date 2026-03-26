"use client";

import { useState } from "react";

interface AuditFormProps {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export default function AuditForm({ onSubmit, loading }: AuditFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Veuillez coller le lien de votre annonce Airbnb.");
      return;
    }

    if (!url.toLowerCase().includes("airbnb")) {
      setError("Le lien doit provenir d'Airbnb (contenir \"airbnb\" dans l'URL).");
      return;
    }

    onSubmit(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <input
          type="url"
          placeholder="https://www.airbnb.fr/rooms/..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          disabled={loading}
          style={{
            width: "100%",
            padding: "16px 20px",
            fontSize: "16px",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 500,
            border: `2px solid ${error ? "#B33A3A" : "#E0E0E0"}`,
            borderRadius: "12px",
            outline: "none",
            backgroundColor: "#FFFFFF",
            color: "#1A1A1A",
            transition: "border-color 0.2s ease",
          }}
          onFocus={(e) => {
            if (!error) e.currentTarget.style.borderColor = "#EBBA4D";
          }}
          onBlur={(e) => {
            if (!error) e.currentTarget.style.borderColor = "#E0E0E0";
          }}
        />
        {error && (
          <p
            style={{
              color: "#B33A3A",
              fontSize: "14px",
              fontWeight: 500,
              margin: 0,
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "16px 32px",
            fontSize: "16px",
            fontFamily: "'Raleway', sans-serif",
            fontWeight: 700,
            letterSpacing: "0.5px",
            color: "#1A1A1A",
            backgroundColor: loading ? "#E0E0E0" : "#EBBA4D",
            border: "none",
            borderRadius: "12px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = "#F5D98A";
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = "#EBBA4D";
          }}
        >
          {loading ? "Analyse en cours..." : "Analyser mon annonce"}
        </button>
      </div>
    </form>
  );
}
