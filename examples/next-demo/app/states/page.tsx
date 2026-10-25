import {
  AsciiEmptyState, AsciiLoader, AsciiMaintenance, AsciiServerError, AsciiNotFound,
  EMPTY_VARIANTS, LOADER_VARIANTS,
} from "ascii-magic-art-react";

export default function StatesPage() {
  return (
    <>
      <h1>States</h1>
      <div className="grid">
        <div className="card"><AsciiNotFound size={6} title="Page not found" /></div>
        <div className="card"><AsciiServerError size={6} title="Something broke" /></div>
        <div className="card"><AsciiMaintenance size={6} title="Back soon" /></div>
        {LOADER_VARIANTS.map((v) => (
          <div className="card" key={v}><AsciiLoader variant={v} size={8} description={`variant="${v}"`} /></div>
        ))}
        {EMPTY_VARIANTS.map((v) => (
          <div className="card" key={v}><AsciiEmptyState variant={v} size={9} description={`variant="${v}"`} /></div>
        ))}
      </div>
    </>
  );
}
