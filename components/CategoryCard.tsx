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

interface CategoryCardProps {
  category: Category;
  index: number;
}

export default function CategoryCard({ category, index }: CategoryCardProps) {
  const [open, setOpen] = useState(false);

  const percent = (category.score / category.max) * 100;
  const color = percent >= 70 ? "#2D8C5A" : percent >= 45 ? "#D4872E" : "#B33A3A";
  const bgColor =
    percent >= 70 ? "#E8F5EE" : percent >= 45 ? "#FFF3E0" : "#FDECEC";

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: "12px",
        border: "1px solid #E0E0E0",
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow 0.2s ease",
        animation: `fadeSlideIn 0.5s ease-out ${0.3 + index * 0.1}s both`,
      }}
      onClick={() => setOpen(!open)}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 20px",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flex: 1,
          }}
        >
          <span style={{ fontSize: "22px" }}>{category.icon}</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#1A1A1A",
                }}
              >
                {category.name}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: color,
                  backgroundColor: bgColor,
                  padding: "3px 10px",
                  borderRadius: "12px",
                }}
              >
                {category.score}/{category.max}
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
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  backgroundColor: color,
                  borderRadius: "3px",
                  transition: "width 0.8s ease-out",
                }}
              />
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: "14px",
            color: "#A0A0A0",
            transition: "transform 0.2s ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          ▶
        </span>
      </div>

      {/* Detail (collapsible) */}
      {open && (
        <div
          style={{
            padding: "0 20px 20px 20px",
            animation: "fadeSlideIn 0.3s ease-out",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              color: "#2A2A2A",
              lineHeight: 1.7,
              marginBottom: "16px",
            }}
          >
            {category.detail}
          </p>

          {/* Suggestions */}
          <div
            style={{
              backgroundColor: "#FDF8EE",
              borderLeft: "3px solid #EBBA4D",
              borderRadius: "0 8px 8px 0",
              padding: "16px",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase" as const,
                color: "#C99A2E",
                marginBottom: "10px",
              }}
            >
              Suggestions
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {category.suggestions.map((s, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: "14px",
                    color: "#1A1A1A",
                    lineHeight: 1.6,
                    paddingLeft: "18px",
                    position: "relative",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      color: "#EBBA4D",
                      fontWeight: 700,
                    }}
                  >
                    →
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
