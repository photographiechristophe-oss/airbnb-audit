"use client";

import { useState, useRef } from "react";

interface PDFDownloadProps {
  listingTitle: string;
  reportRef: React.RefObject<HTMLDivElement | null>;
}

export default function PDFDownload({
  listingTitle,
  reportRef,
}: PDFDownloadProps) {
  const [showModal, setShowModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    setError("");

    if (!firstName.trim()) {
      setError("Veuillez indiquer votre prénom.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Veuillez indiquer un email valide.");
      return;
    }

    setGenerating(true);

    try {
      // 1. Collect email
      await fetch("/api/collect-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          listingTitle,
        }),
      });

      // 2. Generate PDF
      if (!reportRef.current) {
        setError("Rapport introuvable.");
        setGenerating(false);
        return;
      }

      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      // Temporarily expand all categories for the PDF
      const categoryCards = reportRef.current.querySelectorAll(
        "[data-category-card]"
      );
      categoryCards.forEach((card) => {
        card.setAttribute("data-was-closed", "true");
        card.dispatchEvent(new CustomEvent("expand-for-pdf"));
      });

      // Small delay to let React re-render
      await new Promise((r) => setTimeout(r, 300));

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#FAFAF8",
        logging: false,
        windowWidth: 650,
      });

      // Collapse categories back
      categoryCards.forEach((card) => {
        card.dispatchEvent(new CustomEvent("collapse-after-pdf"));
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF("p", "mm", "a4");
      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= 297; // A4 height

      // Additional pages if needed
      while (heightLeft > 0) {
        position -= 297;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      // Sanitize filename
      const safeTitle = listingTitle
        .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .substring(0, 50);

      pdf.save(`audit-airbnb-${safeTitle}.pdf`);
      setShowModal(false);
      setFirstName("");
      setEmail("");
    } catch (e) {
      console.error("PDF generation error:", e);
      setError("Erreur lors de la génération du PDF. Réessayez.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {/* Download button */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          width: "100%",
          padding: "14px 24px",
          fontSize: "15px",
          fontFamily: "'Raleway', sans-serif",
          fontWeight: 600,
          color: "#C99A2E",
          backgroundColor: "transparent",
          border: "2px solid #EBBA4D",
          borderRadius: "12px",
          cursor: "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#FDF8EE";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        📄 Télécharger le rapport PDF
      </button>

      {/* Modal overlay */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
            animation: "fadeSlideIn 0.2s ease-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            ref={modalRef}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "#FDF8EE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px auto",
                  fontSize: "22px",
                }}
              >
                📄
              </div>
              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#1A1A1A",
                  marginBottom: "8px",
                }}
              >
                Votre rapport en PDF
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6B6B6B",
                  lineHeight: 1.5,
                }}
              >
                Recevez votre audit complet et nos conseils
                personnalisés pour booster vos réservations.
              </p>
            </div>

            {/* Form */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <input
                type="text"
                placeholder="Votre prénom"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setError("");
                }}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  fontSize: "15px",
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 500,
                  border: "2px solid #E0E0E0",
                  borderRadius: "10px",
                  outline: "none",
                  backgroundColor: "#FFFFFF",
                  color: "#1A1A1A",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#EBBA4D";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E0E0E0";
                }}
              />
              <input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDownload();
                }}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  fontSize: "15px",
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 500,
                  border: "2px solid #E0E0E0",
                  borderRadius: "10px",
                  outline: "none",
                  backgroundColor: "#FFFFFF",
                  color: "#1A1A1A",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#EBBA4D";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E0E0E0";
                }}
              />

              {error && (
                <p
                  style={{
                    color: "#B33A3A",
                    fontSize: "13px",
                    fontWeight: 500,
                    margin: 0,
                  }}
                >
                  {error}
                </p>
              )}

              <button
                onClick={handleDownload}
                disabled={generating}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "15px",
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 700,
                  color: "#1A1A1A",
                  backgroundColor: generating ? "#E0E0E0" : "#EBBA4D",
                  border: "none",
                  borderRadius: "10px",
                  cursor: generating ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!generating)
                    e.currentTarget.style.backgroundColor = "#F5D98A";
                }}
                onMouseLeave={(e) => {
                  if (!generating)
                    e.currentTarget.style.backgroundColor = "#EBBA4D";
                }}
              >
                {generating
                  ? "Génération en cours..."
                  : "Télécharger mon rapport"}
              </button>

              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "13px",
                  fontFamily: "'Raleway', sans-serif",
                  fontWeight: 500,
                  color: "#A0A0A0",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Non merci
              </button>
            </div>

            {/* Privacy note */}
            <p
              style={{
                fontSize: "11px",
                color: "#A0A0A0",
                textAlign: "center",
                marginTop: "12px",
                lineHeight: 1.4,
              }}
            >
              Vos données restent confidentielles. Pas de spam, promis.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
