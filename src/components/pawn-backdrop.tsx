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
 */
export function PawnBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-[50vh] -z-10 hidden -translate-y-1/2 select-none justify-between 2xl:flex"
    >
      <Image
        src={whitePawn}
        alt=""
        priority={false}
        sizes="(min-width: 1536px) 22vw, 0px"
        className="h-auto w-[clamp(13rem,20vw,23rem)] -translate-x-[28%]"
      />
      <Image
        src={blackPawn}
        alt=""
        priority={false}
        sizes="(min-width: 1536px) 22vw, 0px"
        className="h-auto w-[clamp(13rem,20vw,23rem)] translate-x-[28%]"
      />
    </div>
  );
}
