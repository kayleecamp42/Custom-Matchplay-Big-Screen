export default function PanelHeader({ title, children }) {
  return (
    <div className="panel-header">
      <div className="panel-title">{title}</div>
      {children}
    </div>
  );
}
