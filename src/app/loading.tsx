export default function HomeLoading() {
  return (
    <main className="home-shell" aria-busy="true" aria-label="Loading">
      <div className="home-intro">
        <div className="skeleton skeleton-brand" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
      <div className="skeleton-list">
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </div>
    </main>
  );
}
