export default function ArticleLoading() {
  return (
    <div className="read-shell" aria-busy="true" aria-label="Loading">
      <header className="read-bar">
        <div className="skeleton skeleton-icon" />
        <div className="skeleton skeleton-title" />
        <div className="read-bar-actions">
          <div className="skeleton skeleton-icon" />
          <div className="skeleton skeleton-icon" />
        </div>
      </header>
      <main className="read-body">
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </main>
    </div>
  );
}
