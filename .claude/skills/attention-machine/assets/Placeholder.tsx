import { AbsoluteFill } from "remotion";

// Stands in for footage or a picture the user doesn't have yet. Fills its parent.
export const Placeholder: React.FC<{ label: string }> = ({ label }) => (
  <AbsoluteFill
    style={{
      background: "repeating-linear-gradient(45deg, #262626 0 28px, #313131 28px 56px)",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: 48,
      fontFamily: "system-ui, sans-serif",
      color: "white",
    }}
  >
    <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "0.08em" }}>PLACEHOLDER</div>
    <div style={{ fontSize: 32, opacity: 0.8, marginTop: 14, maxWidth: 760 }}>{label}</div>
  </AbsoluteFill>
);
