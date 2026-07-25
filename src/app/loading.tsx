export default function HomeLoading() {
  return (
    <main className="site-shell" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton-brand" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
      <div className="skeleton-list">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </div>
    </main>
  );
}
