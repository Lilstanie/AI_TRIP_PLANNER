"use client";
import { useState } from "react";
import type { GooglePlace } from "@/lib/integrations/google";
import { MapPinIcon } from "../ui/icons";

/**
 * The selected place, previewed over the map with its first Google photo.
 *
 * The photo is fetched only while the preview is shown and only in live data mode, because each
 * image is billed. Without a photo (mock mode, none on Google, an expired name, a failed load) the
 * slot keeps its size and shows a pin instead. Google requires the photo's author attribution
 * wherever the image appears.
 */
export function PlacePreview({ place, showPhoto }: { place: GooglePlace; showPhoto: boolean }) {
  const photo = showPhoto ? place.photos?.[0] : undefined;
  const [failed, setFailed] = useState<string>();
  const visible = photo && failed !== photo.name ? photo : undefined;
  const name = place.displayName?.text ?? place.formattedAddress ?? "Selected place";
  const authors = (visible?.authorAttributions ?? []).filter((author) => author.displayName);

  return (
    <article className="place-preview" aria-label={`Selected place: ${name}`}>
      <div className="place-preview__photo">
        <span className="place-preview__fallback" aria-hidden="true">
          <MapPinIcon />
        </span>
        {visible && (
          // Not next/image: its optimizer would fetch and cache Google's photo on our server,
          // and the provider's terms allow neither.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={visible.name}
            src={`/api/places/photo?name=${encodeURIComponent(visible.name)}&width=400`}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(visible.name)}
          />
        )}
      </div>
      <div className="place-preview__body">
        <h3>{name}</h3>
        {place.formattedAddress && place.formattedAddress !== name && (
          <p className="place-preview__address">{place.formattedAddress}</p>
        )}
        {authors.length > 0 && (
          <p className="place-preview__credit">
            Photo:{" "}
            {authors.map((author, index) => (
              <span key={`${author.displayName}-${index}`}>
                {index > 0 && ", "}
                {author.uri ? (
                  <a href={author.uri} target="_blank" rel="noopener noreferrer">
                    {author.displayName}
                  </a>
                ) : (
                  author.displayName
                )}
              </span>
            ))}
          </p>
        )}
        {place.googleMapsUri && (
          <a
            className="place-preview__link"
            href={place.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Google Maps
          </a>
        )}
      </div>
    </article>
  );
}
