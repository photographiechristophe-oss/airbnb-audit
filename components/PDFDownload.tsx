"use client";

import { useState } from "react";

interface Category {
  name: string;
  icon: string;
  score: number;
  max: number;
  detail: string;
  suggestions: string[];
}

interface AuditData {
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

interface PDFDownloadProps {
  listingTitle: string;
  auditData: AuditData;
}

export default function PDFDownload({
  listingTitle,
  auditData,
}: PDFDownloadProps) {
  const [showModal, setShowModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [consent, setConsent] = useState(false);

  const handleDownload = async () => {
    setError("");

    if (!firstName.trim()) {
      setError("Veuillez indiquer votre prénom.");
      return;
    }
    if (!email.trim() || !email.includes("@") || !email.includes(".")) {
      setError("Veuillez indiquer un email valide.");
      return;
    }
    if (!consent) {
      setError("Veuillez accepter la politique de confidentialité.");
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

      // 2. Generate PDF with jsPDF directly
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      const checkPageBreak = (needed: number) => {
        if (y + needed > 280) {
          pdf.addPage();
          y = 20;
        }
      };

      // Helper: normalize accented characters + strip emojis for Helvetica
      const norm = (text: string): string => {
        return text
          // Strip all emoji characters (Unicode emoji ranges)
          .replace(/[\u{1F600}-\u{1F64F}]/gu, "")  // emoticons
          .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")  // misc symbols & pictographs
          .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")  // transport & map
          .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")  // flags
          .replace(/[\u{2600}-\u{26FF}]/gu, "")     // misc symbols
          .replace(/[\u{2700}-\u{27BF}]/gu, "")     // dingbats
          .replace(/[\u{FE00}-\u{FE0F}]/gu, "")     // variation selectors
          .replace(/[\u{200D}]/gu, "")               // zero width joiner
          .replace(/[\u{20E3}]/gu, "")               // combining enclosing keycap
          .replace(/[\u{E0020}-\u{E007F}]/gu, "")   // tags
          .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")   // supplemental symbols
          .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")   // chess symbols
          .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")   // symbols extended-A
          .replace(/[\u{231A}-\u{231B}]/gu, "")     // watch, hourglass
          .replace(/[\u{23E9}-\u{23F3}]/gu, "")     // misc technical
          .replace(/[\u{23F8}-\u{23FA}]/gu, "")     // misc technical
          .replace(/[\u{25AA}-\u{25AB}]/gu, "")     // squares
          .replace(/[\u{25B6}]/gu, "")               // play button
          .replace(/[\u{25C0}]/gu, "")               // reverse button
          .replace(/[\u{25FB}-\u{25FE}]/gu, "")     // squares
          .replace(/[\u{2934}-\u{2935}]/gu, "")     // arrows
          .replace(/[\u{2B05}-\u{2B07}]/gu, "")     // arrows
          .replace(/[\u{2B1B}-\u{2B1C}]/gu, "")     // squares
          .replace(/[\u{2B50}]/gu, "")               // star
          .replace(/[\u{2B55}]/gu, "")               // circle
          .replace(/[\u{3030}]/gu, "")               // wavy dash
          .replace(/[\u{303D}]/gu, "")               // part alternation mark
          .replace(/[\u{3297}]/gu, "")               // circled ideograph congratulation
          .replace(/[\u{3299}]/gu, "")               // circled ideograph secret
          // Clean up extra spaces left by stripped emojis
          .replace(/^\s+/, "")
          .replace(/\s{2,}/g, " ")
          // Smart quotes and dashes
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/\u2026/g, "...")
          .replace(/\u2013/g, "-")
          .replace(/\u2014/g, "-")
          // French accented characters
          .replace(/é/g, "e").replace(/É/g, "E")
          .replace(/è/g, "e").replace(/È/g, "E")
          .replace(/ê/g, "e").replace(/Ê/g, "E")
          .replace(/ë/g, "e").replace(/Ë/g, "E")
          .replace(/à/g, "a").replace(/À/g, "A")
          .replace(/â/g, "a").replace(/Â/g, "A")
          .replace(/ä/g, "a").replace(/Ä/g, "A")
          .replace(/ù/g, "u").replace(/Ù/g, "U")
          .replace(/û/g, "u").replace(/Û/g, "U")
          .replace(/ü/g, "u").replace(/Ü/g, "U")
          .replace(/ô/g, "o").replace(/Ô/g, "O")
          .replace(/ö/g, "o").replace(/Ö/g, "O")
          .replace(/î/g, "i").replace(/Î/g, "I")
          .replace(/ï/g, "i").replace(/Ï/g, "I")
          .replace(/ç/g, "c").replace(/Ç/g, "C")
          .replace(/ÿ/g, "y").replace(/Ÿ/g, "Y")
          .replace(/œ/g, "oe").replace(/Œ/g, "OE")
          .replace(/æ/g, "ae").replace(/Æ/g, "AE");
      };

      // Helper: add wrapped text
      const addWrappedText = (
        text: string,
        x: number,
        maxWidth: number,
        fontSize: number,
        color: [number, number, number] = [26, 26, 26],
        style: string = "normal"
      ) => {
        pdf.setFontSize(fontSize);
        pdf.setTextColor(...color);
        if (style === "bold") {
          pdf.setFont("helvetica", "bold");
        } else if (style === "italic") {
          pdf.setFont("helvetica", "italic");
        } else {
          pdf.setFont("helvetica", "normal");
        }
        const lines = pdf.splitTextToSize(norm(text), maxWidth);
        for (const line of lines) {
          checkPageBreak(fontSize * 0.5);
          pdf.text(line, x, y);
          y += fontSize * 0.45;
        }
      };

      // --- Header ---
      pdf.setFillColor(235, 186, 77); // gold
      pdf.rect(0, 0, pageWidth, 3, "F");

      y = 15;
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(26, 26, 26);
      pdf.text("Audit Annonce Airbnb", pageWidth / 2, y, {
        align: "center",
      });
      y += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(201, 154, 46); // gold dark
      pdf.text("par votrephotographeimmo.com", pageWidth / 2, y, {
        align: "center",
      });
      y += 12;

      // --- Score ---
      const score = auditData.score_global;
      const scoreColor: [number, number, number] =
        score >= 75 ? [45, 140, 90] : score >= 50 ? [212, 135, 46] : [179, 58, 58];

      // Score circle
      pdf.setDrawColor(...scoreColor);
      pdf.setLineWidth(1.5);
      pdf.circle(pageWidth / 2, y + 12, 15);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...scoreColor);
      pdf.text(String(score), pageWidth / 2, y + 15, { align: "center" });
      pdf.setFontSize(8);
      pdf.setTextColor(160, 160, 160);
      pdf.text("/ 100", pageWidth / 2, y + 20, { align: "center" });
      y += 32;

      // Score label
      const label =
        score >= 75
          ? "Excellente annonce"
          : score >= 50
            ? "Annonce correcte, peut mieux faire"
            : "Annonce a optimiser d'urgence";
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...scoreColor);
      pdf.text(label, pageWidth / 2, y, { align: "center" });
      y += 10;

      // Title & info
      addWrappedText(
        auditData.listing_title,
        pageWidth / 2 - contentWidth / 2,
        contentWidth,
        14,
        [26, 26, 26],
        "bold"
      );
      y += 3;
      addWrappedText(
        `${auditData.location} - ${auditData.property_type}`,
        margin,
        contentWidth,
        10,
        [107, 107, 107]
      );
      y += 3;
      addWrappedText(
        `"${auditData.verdict}"`,
        margin,
        contentWidth,
        10,
        [42, 42, 42],
        "italic"
      );
      y += 8;

      // --- Points forts / critiques ---
      checkPageBreak(40);
      pdf.setFillColor(232, 245, 238); // green bg
      pdf.roundedRect(margin, y, contentWidth / 2 - 3, 6, 1, 1, "F");
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(45, 140, 90);
      pdf.text("POINTS FORTS", margin + 3, y + 4.2);

      pdf.setFillColor(253, 236, 236); // red bg
      pdf.roundedRect(
        margin + contentWidth / 2 + 3,
        y,
        contentWidth / 2 - 3,
        6,
        1,
        1,
        "F"
      );
      pdf.setTextColor(179, 58, 58);
      pdf.text("POINTS A AMELIORER", margin + contentWidth / 2 + 6, y + 4.2);
      y += 10;

      const maxPoints = Math.max(
        auditData.points_forts.length,
        auditData.points_critiques.length
      );
      for (let i = 0; i < maxPoints; i++) {
        checkPageBreak(6);
        if (auditData.points_forts[i]) {
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(45, 140, 90);
          pdf.text("✓", margin + 2, y);
          pdf.setTextColor(26, 26, 26);
          const fLines = pdf.splitTextToSize(
            norm(auditData.points_forts[i]),
            contentWidth / 2 - 12
          );
          for (const fl of fLines) {
            pdf.text(fl, margin + 7, y);
            y += 4;
          }
          y -= 4; // reset for right column
        }
        if (auditData.points_critiques[i]) {
          pdf.setFontSize(8);
          pdf.setTextColor(179, 58, 58);
          pdf.text("✗", margin + contentWidth / 2 + 5, y);
          pdf.setTextColor(26, 26, 26);
          const cLines = pdf.splitTextToSize(
            norm(auditData.points_critiques[i]),
            contentWidth / 2 - 12
          );
          for (const cl of cLines) {
            pdf.text(cl, margin + contentWidth / 2 + 10, y);
            y += 4;
          }
        } else {
          y += 4;
        }
        y += 2;
      }
      y += 6;

      // --- Categories ---
      checkPageBreak(10);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(160, 160, 160);
      pdf.text("DETAIL PAR CATEGORIE", margin, y);
      y += 8;

      for (const cat of auditData.categories) {
        checkPageBreak(35);
        const pct = (cat.score / cat.max) * 100;
        const catColor: [number, number, number] =
          pct >= 70 ? [45, 140, 90] : pct >= 45 ? [212, 135, 46] : [179, 58, 58];

        // Category header
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(26, 26, 26);
        pdf.text(norm(`${cat.icon} ${cat.name}`), margin, y);

        // Score badge
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...catColor);
        pdf.text(`${cat.score}/${cat.max}`, pageWidth - margin, y, {
          align: "right",
        });
        y += 4;

        // Progress bar
        pdf.setFillColor(224, 224, 224);
        pdf.roundedRect(margin, y, contentWidth, 2.5, 1, 1, "F");
        pdf.setFillColor(...catColor);
        pdf.roundedRect(
          margin,
          y,
          contentWidth * (pct / 100),
          2.5,
          1,
          1,
          "F"
        );
        y += 6;

        // Detail
        addWrappedText(cat.detail, margin, contentWidth, 9, [42, 42, 42]);
        y += 3;

        // Suggestions
        for (const s of cat.suggestions) {
          checkPageBreak(8);
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(201, 154, 46);
          pdf.text("→", margin + 2, y);
          pdf.setTextColor(26, 26, 26);
          const sLines = pdf.splitTextToSize(norm(s), contentWidth - 8);
          for (const sl of sLines) {
            pdf.text(sl, margin + 7, y);
            y += 3.5;
          }
        }
        y += 6;
      }

      // --- CTA block ---
      checkPageBreak(30);
      pdf.setFillColor(26, 26, 26);
      pdf.roundedRect(margin, y, contentWidth, 30, 3, 3, "F");
      y += 8;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(235, 186, 77);
      pdf.text("Boostez vos reservations avec des visuels pro", pageWidth / 2, y, {
        align: "center",
      });
      y += 6;
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(200, 200, 200);
      const ctaLines = pdf.splitTextToSize(
        norm(auditData.recommandation_visuelle),
        contentWidth - 10
      );
      for (const cl of ctaLines.slice(0, 4)) {
        pdf.text(cl, margin + 5, y);
        y += 3.5;
      }
      y += 8;

      // --- Personal message ---
      checkPageBreak(25);
      y += 4;
      pdf.setDrawColor(235, 186, 77);
      pdf.setLineWidth(0.3);
      pdf.line(margin + 20, y, pageWidth - margin - 20, y);
      y += 8;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(42, 42, 42);
      const personalMsg = pdf.splitTextToSize(
        norm("Si vous souhaitez echanger plus sur le sujet ou demander un devis, n'hesitez pas a me consulter. Au plaisir, Christophe"),
        contentWidth - 20
      );
      for (const line of personalMsg) {
        pdf.text(line, pageWidth / 2, y, { align: "center" });
        y += 4;
      }
      y += 3;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(42, 42, 42);
      pdf.text("Tel : 06-19-46-36-05", pageWidth / 2, y, { align: "center" });
      y += 4;
      pdf.text("Mail : photographiechristophe@gmail.com", pageWidth / 2, y, { align: "center" });
      y += 8;

      // --- Footer ---
      checkPageBreak(10);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(201, 154, 46);
      pdf.text("votrephotographeimmo.com", pageWidth / 2, y, {
        align: "center",
      });
      y += 5;
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(160, 160, 160);
      pdf.text(
        norm("Photographe professionnel en hotellerie & locations saisonnieres - Provence"),
        pageWidth / 2,
        y,
        { align: "center" }
      );

      // Save
      const safeTitle = listingTitle
        .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .substring(0, 50);

      pdf.save(`audit-airbnb-${safeTitle}.pdf`);
      setDownloaded(true);
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
        Télécharger le rapport PDF
      </button>

      {downloaded && (
        <div
          style={{
            marginTop: "12px",
            padding: "14px 18px",
            backgroundColor: "#F0FAF0",
            border: "1px solid #27AE60",
            borderRadius: "10px",
            textAlign: "center",
            fontFamily: "'Raleway', sans-serif",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 600,
              color: "#27AE60",
            }}
          >
            ✅ Votre rapport PDF a bien été téléchargé !
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "12px",
              color: "#666",
            }}
          >
            Consultez votre dossier <strong>Téléchargements</strong> pour retrouver le fichier.
          </p>
        </div>
      )}

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
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
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
                Recevez votre audit complet et nos conseils personnalisés pour
                booster vos réservations.
              </p>
            </div>

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

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  fontSize: "11px",
                  color: "#6B6B6B",
                  lineHeight: 1.4,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{
                    marginTop: "2px",
                    accentColor: "#EBBA4D",
                    minWidth: "16px",
                    minHeight: "16px",
                  }}
                />
                <span>
                  J&apos;accepte que mes données soient utilisées pour recevoir mon rapport
                  et des conseils personnalisés.{" "}
                  <a
                    href="https://www.votrephotographeimmo.com/politique-de-confidentialite"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#EBBA4D", textDecoration: "underline" }}
                  >
                    Politique de confidentialité
                  </a>
                </span>
              </label>

              <button
                onClick={handleDownload}
                disabled={generating || !consent}
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

            <p
              style={{
                fontSize: "11px",
                color: "#A0A0A0",
                textAlign: "center",
                marginTop: "12px",
                lineHeight: 1.4,
              }}
            >
              Vos données sont traitées par votrephotographeimmo.com uniquement.
              Vous pouvez demander leur suppression à tout moment par email.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
