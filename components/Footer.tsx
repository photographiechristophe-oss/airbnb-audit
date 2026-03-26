"use client";

export default function Footer() {
  return (
    <footer
      style={{
        textAlign: "center",
        padding: "32px 20px",
        marginTop: "40px",
        borderTop: "1px solid #E0E0E0",
      }}
    >
      <a
        href="https://www.votrephotographeimmo.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#C99A2E",
          textDecoration: "none",
        }}
      >
        votrephotographeimmo.com
      </a>
      <p
        style={{
          fontSize: "12px",
          color: "#A0A0A0",
          marginTop: "6px",
        }}
      >
        Photographe professionnel en hôtellerie & locations saisonnières — Provence
      </p>
    </footer>
  );
}
