export default function Skeleton({ lines = 3 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: lines }).map((_, index) => <div className="skeleton" key={index} />)}
    </div>
  );
}
