export default function WorkspaceLoading() {
  return (
    <div
      className="fixed left-0 right-0 z-10 flex items-center justify-center bg-white"
      style={{ top: 56, bottom: 0 }}
      aria-busy="true"
      aria-label="Loading map"
    >
      <p className="m3-body-muted text-sm">Loading journey map…</p>
    </div>
  );
}