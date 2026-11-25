export function Lockup({ size = 18 }: { size?: number }) {
  return (
    <span className="as-lockup" style={{ fontSize: size }}>
      <span className="as-glyph">⦃</span>param<span className="as-glyph">⦄</span>{' '}
      <span className="as-lockup__product">ai/Studio</span>
    </span>
  );
}
