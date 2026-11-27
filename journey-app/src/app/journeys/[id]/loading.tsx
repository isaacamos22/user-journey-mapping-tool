export default function JourneyRouteLoading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-4 animate-pulse px-2 sm:px-4 pt-2"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="h-8 w-48 rounded-lg bg-surface-container" />
      <div className="h-4 w-full max-w-xl rounded bg-surface-container" />
      <div className="h-4 w-2/3 rounded bg-surface-container" />
      <div className="mt-6 h-64 rounded-xl bg-surface-container" />
    </div>
  );
}