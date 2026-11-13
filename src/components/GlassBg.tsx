/** Blurred-wallpaper + frosted tint layers. Place as first child of a `.card`.
 *  ox/oy = the card's top-left inside the stage (design units). */
export default function GlassBg({ ox, oy }: { ox: number; oy: number }) {
  const vars = { ["--ox" as string]: ox, ["--oy" as string]: oy } as React.CSSProperties;
  return (
    <>
      <div className="glass-img" style={vars} />
      <div className="glass-tint" />
    </>
  );
}
