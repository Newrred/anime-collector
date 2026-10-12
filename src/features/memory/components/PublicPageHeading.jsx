export default function PublicPageHeading({ title, base = '/', breadcrumb = 'MOEMOA' }) {
  return <header className="public-page-heading">
    <div className="public-page-heading__path">
      <a href={base}>{breadcrumb}</a><span aria-hidden="true">/</span><h1>{title}</h1>
    </div>
  </header>;
}
