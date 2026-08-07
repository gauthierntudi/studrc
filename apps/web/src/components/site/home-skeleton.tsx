import "./home-skeleton.css";

function Bone({ className = "" }: { className?: string }) {
  return <span className={`opt-home-skel__bone ${className}`.trim()} />;
}

function TopSkel() {
  return (
    <section className="opt-home-skel__top" aria-hidden>
      <div className="opt-home-skel__top-inner">
        <div className="opt-home-skel__featured">
          <Bone className="opt-home-skel__featured-media" />
          <div className="opt-home-skel__featured-body">
            <Bone className="opt-home-skel__line opt-home-skel__line--lg" />
            <Bone className="opt-home-skel__line" />
            <Bone className="opt-home-skel__line opt-home-skel__line--sm" />
            <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
          </div>
        </div>
        <div className="opt-home-skel__top-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <Bone key={i} className="opt-home-skel__card" />
          ))}
        </div>
      </div>
    </section>
  );
}

function KiosqueSkel() {
  return (
    <section className="opt-home-skel__kiosque" aria-hidden>
      <div className="opt-home-skel__wrap">
        <div className="opt-home-skel__kiosque-head">
          <Bone className="opt-home-skel__line opt-home-skel__line--title" />
          <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
        </div>
        <div className="opt-home-skel__kiosque-rail">
          {Array.from({ length: 6 }, (_, i) => (
            <Bone key={i} className="opt-home-skel__mag" />
          ))}
        </div>
      </div>
    </section>
  );
}

function DossiersSkel() {
  return (
    <section className="opt-home-skel__dossiers" aria-hidden>
      <div className="opt-home-skel__wrap">
        <Bone className="opt-home-skel__line opt-home-skel__line--title" />
        <div className="opt-home-skel__dossiers-grid">
          {Array.from({ length: 5 }, (_, i) => (
            <Bone key={i} className="opt-home-skel__dossier" />
          ))}
        </div>
      </div>
    </section>
  );
}

function RubriqueSkel() {
  return (
    <section className="opt-home-skel__rub" aria-hidden>
      <div className="opt-home-skel__rub-inner">
        <div className="opt-home-skel__rub-main">
          <div className="opt-home-skel__rub-head">
            <Bone className="opt-home-skel__line opt-home-skel__line--title" />
            <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
          </div>
          <div className="opt-home-skel__rub-body">
            <Bone className="opt-home-skel__rub-feat" />
            <div className="opt-home-skel__rub-grid">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="opt-home-skel__rub-card">
                  <Bone className="opt-home-skel__rub-thumb" />
                  <Bone className="opt-home-skel__line" />
                  <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="opt-home-skel__rub-side">
          <Bone className="opt-home-skel__line opt-home-skel__line--title" />
          <Bone className="opt-home-skel__rub-side-feat" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="opt-home-skel__pv">
              <Bone className="opt-home-skel__pv-thumb" />
              <div className="opt-home-skel__pv-body">
                <Bone className="opt-home-skel__line opt-home-skel__line--meta" />
                <Bone className="opt-home-skel__line" />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

export function HomeSkeleton() {
  return (
    <div className="opt-home-skel" aria-busy="true" aria-label="Chargement">
      <TopSkel />
      <KiosqueSkel />
      <DossiersSkel />
      <RubriqueSkel />
      <div className="opt-home-skel__newsletter" aria-hidden>
        <div className="opt-home-skel__wrap">
          <Bone className="opt-home-skel__newsletter-box" />
        </div>
      </div>
      <RubriqueSkel />
    </div>
  );
}
