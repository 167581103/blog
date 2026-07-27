export default function EditLoading() {
  return (
    <div className="editor-shell" aria-busy="true" aria-label="Loading editor">
      <header className="editor-bar">
        <div className="skeleton skeleton-icon" />
        <div className="skeleton skeleton-title" />
        <div className="editor-bar-actions">
          <div className="skeleton skeleton-icon" />
          <div className="skeleton skeleton-icon" />
        </div>
      </header>
      <div className="editor-body">
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  );
}
