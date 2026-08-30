import KeystaticApp from "./[[...params]]/keystatic";

export default function KeystaticLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
      `}</style>
      {children}
    </>
  );
}