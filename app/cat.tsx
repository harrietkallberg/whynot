import Image from "next/image";

import type { Pose } from "@/lib/dashboard";

import manifest from "../public/cats/cats.json";

/**
 * A Goal's Cat, drawn in the Pose that says where the Goal has got to. The
 * Pose is the whole of the status display: there is no separate lock, badge or
 * counter beside it.
 *
 * The Cat itself is whichever one the Goal froze at creation (lib/cats.ts), so
 * a Goal keeps the Cat of the Day it was made under for good.
 */

/** The size every Cat is drawn at, straight from the manifest beside them. */
const [WIDTH, HEIGHT] = manifest.size;

/**
 * Doubled, because 28 by 24 is a postage stamp on a modern screen. The
 * stylesheet turns off smoothing so the pixels stay square.
 */
const SCALE = 2;

/**
 * What the Pose says, for anyone who cannot see it. The drawing carries the
 * Goal's state, so its description has to carry the same thing and not merely
 * say "cat".
 */
const POSE_MEANING: Record<Pose, string> = {
  asleep: "Cat asleep: this Goal's Window is still filling.",
  alert: "Cat alert: a Report is waiting to be read.",
  sitting: "Cat sitting: every Report has been read.",
};

export function Cat({ catId, pose }: { catId: number; pose: Pose }) {
  return (
    <Image
      className="cat"
      src={`/cats/${catId}-${pose}.png`}
      alt={POSE_MEANING[pose]}
      width={WIDTH * SCALE}
      height={HEIGHT * SCALE}
      /* Pixel art: resampling it into a smaller WebP is the one thing that
         would spoil it. It is under a kilobyte as it stands. */
      unoptimized
    />
  );
}
