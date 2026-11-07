/* Logo original de Lexis (livre, plume, chevrons), retracé en vecteur.
   Source : design/logo/lexis-original.svg — repère 800 × 800. */
const SHAPES = [
  'M160 548 L215 520 L400 615 L600 515 L600 325 L640 348 L640 548 L400 672 Z',
  'M158 245 L196 265 L196 445 L400 545 L578 455 L578 500 L400 588 L158 465 Z',
  'M220 200 L262 220 L262 412 C305 405.5 370.5 467.5 395 515 L220 430 Z',
  'M283 158 C337.5 180.5 389 215.5 418 268 L418 505 L413 508 C393 453 337.5 407 283 390 Z',
  'M435 500 C423.5 408.5 515 378.5 578 343 L578 432 Z',
  'M443 378 C435.5 259.5 524.5 153.5 640 133 C644 166 637 201.5 628 232 L568 262 L615 258 C594 322.5 524.5 346.5 470 375 Z',
];
const VEIN = 'M448 374 C476 320 545 224 585 197 C571 226 511 316 473 372 Z';

function Shapes({ mark, ground }: { mark: string; ground: string }) {
  return (
    <>
      <g fill={mark}>
        {SHAPES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path fill={ground} d={VEIN} />
    </>
  );
}

/** Symbole seul. Couleurs via --mark (symbole) et --ground (nervure de la plume). */
export function Mark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="119 122 560 560" aria-hidden="true">
      <Shapes mark="var(--mark)" ground="var(--ground)" />
    </svg>
  );
}

/** Icône d'application, identique au logo original. */
export function AppIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 800 800" aria-label="Lexis" role="img">
      <rect width="800" height="800" rx="176" fill="#22513F" />
      <Shapes mark="#E6D5C3" ground="#22513F" />
    </svg>
  );
}
