export default function MockModeBanner() {
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#f97316",
      color: "white",
      textAlign: "center",
      padding: "0.3em",
      fontSize: "0.75em",
      fontWeight: 900,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      zIndex: 9999,
    }}>
      Test Mode — Mock API Active
    </div>
  );
}
