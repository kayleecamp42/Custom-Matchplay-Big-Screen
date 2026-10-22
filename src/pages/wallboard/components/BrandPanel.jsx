import { useState } from "react";
import QrCard from "../../../components/QrCard.jsx";

export default function BrandPanel({ brandTitle, tournamentName, qrLabel, tournamentQrUrl, discordQrUrl, onAdjustFont }) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="panel brand-panel">
      <div>
        <div className="brand-title" dangerouslySetInnerHTML={{ __html: brandTitle }} />
        <div className="brand-subtitle">{tournamentName}</div>
      </div>

      <div className="qr-stack">
        <QrCard label={qrLabel} src={tournamentQrUrl} alt="Tournament QR" />
      </div>

      <div className="logo-box">
        {logoError ? (
          <span>Logo file:<br /><strong>super-abari-logo.png</strong></span>
        ) : (
          <img src="/super-abari-logo.png" alt="Super Abari Logo" onError={() => setLogoError(true)} />
        )}
      </div>

      <div className="qr-stack">
        <QrCard label="Super Abari Discord" src={discordQrUrl} alt="Discord QR" />
      </div>

      <div className="font-controls">
        <button onClick={() => onAdjustFont(-0.05)}>−</button>
        <button onClick={() => onAdjustFont(0.05)}>+</button>
      </div>
    </div>
  );
}
