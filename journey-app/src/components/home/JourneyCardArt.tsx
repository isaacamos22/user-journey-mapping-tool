import Image from "next/image";
import {
  HOME_JOURNEY_CARD_ART,
  type HomeJourneyCardTheme,
} from "@/lib/home/homeJourneyCardSummary";

/** Full-bleed poster art with overscan so cover never gaps on 2:3 cards. */
export function JourneyCardArt({
  theme,
  coverImage,
}: {
  theme: HomeJourneyCardTheme;
  coverImage?: string | null;
}) {
  const src = coverImage?.trim() || HOME_JOURNEY_CARD_ART[theme];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg" aria-hidden>
      <div className="home-journey-card-art-frame absolute left-1/2 top-1/2 h-[132%] w-[132%]">
        <Image
          src={src}
          alt=""
          fill
          className="home-journey-card-art-media object-cover object-center"
          sizes="200px"
          priority={false}
        />
      </div>
      <div className="home-journey-card-art-scrim absolute inset-0" />
    </div>
  );
}