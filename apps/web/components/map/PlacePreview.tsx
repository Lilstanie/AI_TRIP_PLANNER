"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useState, type ReactNode } from "react";
import type { GooglePlace } from "@/lib/integrations/google";
import { CloseIcon, MapPinIcon } from "../ui/icons";

export function PlacePreview({
  place,
  showPhoto,
  meta,
  onClose,
  headingId,
  actions,
}: {
  place: GooglePlace;
  showPhoto: boolean;
  meta?: string;
  onClose?(): void;
  headingId?: string;

  actions?: ReactNode;
}) {
  const { t } = useLocale();
  const osm = place.id.startsWith("osm:");
  const photo = showPhoto || osm ? place.photos?.[0] : undefined;
  const [failed, setFailed] = useState<string>();
  const visible = photo && failed !== photo.name ? photo : undefined;
  const name = place.displayName?.text ?? place.formattedAddress ?? "Selected place";
  const authors = (visible?.authorAttributions ?? []).filter((author) => author.displayName);

  return (
    <article className="place-preview" aria-label={t("Selected place: {v0}", { v0: name })}>
      {(!osm || visible) && (
        <div className="place-preview__photo">
          <span className="place-preview__fallback" aria-hidden="true">
            <MapPinIcon />
          </span>
          {visible && (
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
      )}
      {onClose && (
        <button
          type="button"
          className="place-preview__close"
          aria-label={t("Close place details")}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      )}
      <div className="place-preview__body">
        {meta && <p className="place-preview__meta">{meta}</p>}
        <h3 id={headingId}>{name}</h3>
        {place.formattedAddress && place.formattedAddress !== name && (
          <p className="place-preview__address">{place.formattedAddress}</p>
        )}
        {osm && (
          <p className="place-preview__meta">
            OpenStreetMap{place.primaryType ? ` · ${place.primaryType.replace(/_/g, " ")}` : ""}
          </p>
        )}
        {osm && place.openingHours && <p>{place.openingHours}</p>}
        {osm && place.phone && <p>{place.phone}</p>}
        {osm && place.websiteUri && (
          <a href={place.websiteUri} target="_blank" rel="noopener noreferrer">
            {t("Website")}
          </a>
        )}
        {!osm && place.rating !== undefined && (
          <p className="place-preview__rating">
            {t("Google rating")}
            {place.rating.toFixed(1)} / 5
          </p>
        )}
        {authors.length > 0 && (
          <p className="place-preview__credit">
            {t("Photo:")}{" "}
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
        {visible?.license && (
          <p className="place-preview__credit">
            <a href={visible.licenseUri} target="_blank" rel="noopener noreferrer">
              {visible.license}
            </a>{" "}
            · Wikimedia Commons
          </p>
        )}
        {osm && place.osmUri && (
          <a
            className="place-preview__link"
            href={place.osmUri}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Open in OpenStreetMap")}
          </a>
        )}
        {place.googleMapsUri && (
          <a
            className="place-preview__link"
            href={place.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Open in Google Maps")}
          </a>
        )}
        {actions && <div className="place-preview__actions">{actions}</div>}
      </div>
    </article>
  );
}
