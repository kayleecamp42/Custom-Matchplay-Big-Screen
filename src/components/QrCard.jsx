export default function QrCard({ label, src, alt }) {
  return (
    <div className="qr-card">
      <div className="qr-label">{label}</div>
      <img src={src} alt={alt || label} />
    </div>
  );
}
