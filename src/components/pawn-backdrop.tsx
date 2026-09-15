import Image from "next/image";
import blackPawn from "../../design_assets/BlackPawn.png";
import whitePawn from "../../design_assets/WhitePawn.png";

/**
 * The two pawns flanking the page, one to a side, bleeding off the edges.
 *
 * Purely decorative, so it is hidden from assistive technology and takes no
 * pointer events. It only appears once the window is wide enough to hold them
 * clear of the content column — below that the reading width is the whole
 * screen and a pawn behind the text would just be in the way.
 *
 * Positioned on the page rather than in the viewport, so they hold their place
 * as the page scrolls instead of following the reader down it. The offset puts
 * them where they sit when the page is scrolled to the top.
 *
 * The strip clips its own contents. Each pawn is pushed 28% past the edge of
 * the window, and without the clip that overhang counted as page width: every
 * page on a wide screen scrolled sideways by about a hundred pixels, onto
 * nothing but the rest of a pawn.
 *
 * Each pawn glides in from its own side once, when the site first opens. The
 * backdrop sits in the root layout, so moving between pages does not replay
 * it. The glide animates a wrapper, because the images' own transforms hold
 * the bleed offset.
 */
export function PawnBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-[50vh] -z-10 hidden -translate-y-1/2 select-none justify-between overflow-hidden 2xl:flex"
    >
      <div className="pawn-glide-left">
        <Image
          src={whitePawn}
          alt=""
          priority={false}
          sizes="(min-width: 1536px) 22vw, 0px"
          className="h-auto w-[clamp(13rem,20vw,23rem)] -translate-x-[28%]"
        />
      </div>
      <div className="pawn-glide-right">
        <Image
          src={blackPawn}
          alt=""
          priority={false}
          sizes="(min-width: 1536px) 22vw, 0px"
          className="h-auto w-[clamp(13rem,20vw,23rem)] translate-x-[28%]"
        />
      </div>
    </div>
  );
}
