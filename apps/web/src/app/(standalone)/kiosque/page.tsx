import { Suspense } from "react";
import { KiosqueClient } from "./kiosque-client";
import "./kiosque.css";

function KiosqueFallback() {
  return (
    <div className="opt-kq" style={{ background: "#0d203d", minHeight: "100vh" }}>
      <div className="opt-kq__loading" aria-busy="true">
        <div className="opt-kq__skel">
          <div className="opt-kq__skel-cover" />
          <div className="opt-kq__skel-lines">
            <div className="opt-kq__skel-line opt-kq__skel-line--sm" />
            <div className="opt-kq__skel-line opt-kq__skel-line--lg" />
            <div className="opt-kq__skel-line" />
            <div className="opt-kq__skel-line" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KiosquePage() {
  return (
    <Suspense fallback={<KiosqueFallback />}>
      <KiosqueClient />
    </Suspense>
  );
}
