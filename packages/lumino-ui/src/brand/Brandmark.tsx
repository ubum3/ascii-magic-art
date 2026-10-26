import type { SVGProps } from "react";
import { BRANDMARK } from "./brand.js";

export interface BrandmarkProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  /** Fill colour, or a url(#gradient) you define in `children`. Default currentColor. */
  fill?: string;
  /** Crop the viewBox to the mark's tight box, without the square's empty margin. Default false. */
  tight?: boolean;
}

/** The brandmark as an inline SVG, for CSS and glass layers. It is decoration (aria-hidden) unless you give it a title. */
export function Brandmark({ fill = "currentColor", tight = false, children, ...props }: BrandmarkProps) {
  const [w, h] = BRANDMARK.viewBox, [bx, by, bw, bh] = BRANDMARK.bounds;
  return (
    <svg viewBox={tight ? `${bx} ${by} ${bw} ${bh}` : `0 0 ${w} ${h}`} aria-hidden="true" focusable="false" {...props}>
      {children}
      {BRANDMARK.paths.map((d) => <path key={d} d={d} fill={fill} />)}
    </svg>
  );
}
