export default function Card({ title, subtitle, children, wide }) {
  return (
    <section className={"card" + (wide ? " wide" : "")}>
      {(title || subtitle) && (
        <div className="card-head">
          <h2>{title}</h2>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
