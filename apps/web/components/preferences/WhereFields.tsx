"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TripAddress } from "@trip/shared";
import type { Draft } from "@/lib/workspace";
import { destinationCities } from "@/lib/map/place-query";
import { addressText, emptyAddress, legacyAddress } from "@/lib/workspace/addresses";
import { CloseIcon, MapPinIcon, PlusIcon } from "../ui/icons";
import { Input } from "../ui/input";
import { useLocale } from "../account/LocaleProvider";

type Props = {
  value: Draft;
  onChange(next: Draft): void;
  errors: Record<string, string>;
  suggestPlaces: boolean;
};
const parts = ["suburb", "city", "state", "country"] as const;
const labels = {
  suburb: "Suburb (optional)",
  city: "City *",
  state: "State / province (optional)",
  country: "Country *",
};

function AddressFields({
  address,
  onChange,
  prefix,
  locationButton,
}: {
  address: TripAddress;
  onChange(next: TripAddress): void;
  prefix: string;
  locationButton?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="address-grid">
      {parts.map((key) => (
        <div className="address-field" key={key}>
          <label htmlFor={`${prefix}-${key}`}>{t(labels[key])}</label>
          <div
            className={key === "city" && locationButton ? "address-input-with-action" : undefined}
          >
            <Input
              className="field"
              id={`${prefix}-${key}`}
              value={address[key]}
              maxLength={120}
              required={key === "city" || key === "country"}
              autoComplete="off"
              data-autofocus={prefix === "destination-0" && key === "city" ? "" : undefined}
              placeholder={t(
                key === "city" ? "e.g. Sydney" : key === "country" ? "e.g. Australia" : "Optional",
              )}
              onChange={(event) => onChange({ ...address, [key]: event.target.value })}
            />
            {key === "city" && locationButton}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Manual structured inputs never call autocomplete or install an address database. */
export function WhereFields({ value, onChange, errors }: Props) {
  const { t, locale } = useLocale();
  const addresses = value.locations ?? {
    destinations: destinationCities(value.destination).map(legacyAddress),
    origin: legacyAddress(value.origin),
  };
  const destinations = addresses.destinations.length ? addresses.destinations : [emptyAddress()];
  const latest = useRef(value);
  latest.current = value;
  const mounted = useRef(true);
  const requestId = useRef(0);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const publish = (nextDestinations: TripAddress[], origin: TripAddress, current = value) =>
    onChange({
      ...current,
      destination: nextDestinations.map(addressText).filter(Boolean).join(" & "),
      origin: addressText(origin),
      locations: { destinations: nextDestinations, origin },
    });
  useEffect(() => {
    if (!value.locations) publish(destinations, addresses.origin);
    // Initialise legacy text for this editor only; subsequent edits are controlled by the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.locations]);
  const locate = () => {
    if (!navigator.geolocation) {
      setNotice("Location is unavailable. Enter your address manually.");
      return;
    }
    setLocating(true);
    setNotice("");
    const id = ++requestId.current;
    const active = () => mounted.current && requestId.current === id;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch("/api/location/reverse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: coords.latitude,
              longitude: coords.longitude,
              language: locale,
            }),
          });
          if (!response.ok) throw new Error("lookup unavailable");
          const { address } = (await response.json()) as { address: TripAddress };
          if (!active()) return;
          const current = latest.current;
          publish(current.locations?.destinations ?? destinations, address, current);
          setNotice("Location filled in. Check the city and country before saving.");
        } catch {
          if (active()) setNotice("Unable to find your address. Enter it manually.");
        } finally {
          if (active()) setLocating(false);
        }
      },
      (error) => {
        if (active()) {
          setLocating(false);
          setNotice(
            error.code === 1
              ? "Location permission denied. Enter your address manually."
              : "Location is unavailable. Enter your address manually.",
          );
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };
  const editOrigin = (origin: TripAddress) => {
    requestId.current++;
    setLocating(false);
    setNotice("");
    publish(destinations, origin);
  };
  return (
    <>
      <p className="muted address-guide">
        {t("City and country are required for every destination and your departure address.")}
      </p>
      {destinations.map((address, index) => (
        <fieldset className="address-block" key={index}>
          <legend>
            {t("Destination")} {index + 1}
          </legend>
          {destinations.length > 1 && (
            <button
              type="button"
              className="address-remove"
              aria-label={`${t("Remove destination")} ${index + 1}`}
              onClick={() =>
                publish(
                  destinations.filter((_, at) => at !== index),
                  addresses.origin,
                )
              }
            >
              <CloseIcon />
            </button>
          )}
          <AddressFields
            prefix={`destination-${index}`}
            address={address}
            onChange={(next) =>
              publish(
                destinations.map((item, at) => (at === index ? next : item)),
                addresses.origin,
              )
            }
          />
        </fieldset>
      ))}
      <button
        type="button"
        className="stop-add"
        disabled={destinations.length >= 12}
        onClick={() => publish([...destinations, emptyAddress()], addresses.origin)}
      >
        <PlusIcon />
        {t("Add destination")}
      </button>
      <fieldset className="address-block address-block--origin">
        <legend>{t("Departing from")}</legend>
        <AddressFields
          prefix="origin"
          address={addresses.origin}
          onChange={editOrigin}
          locationButton={
            <button type="button" className="address-locate" disabled={locating} onClick={locate}>
              <MapPinIcon />
              {t(locating ? "Locating…" : "Get current location")}
            </button>
          }
        />
        <small className="muted">
          {t(
            "Only when you click: your coordinates are sent to OpenStreetMap to fill this address.",
          )}{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap
          </a>
        </small>
        {notice && (
          <small role="status" className="muted">
            {t(notice)}
          </small>
        )}
      </fieldset>
      {(errors.destination || errors.origin || errors.locations) && (
        <small className="error-text fact-form__error" role="alert">
          {t(
            errors.locations
              ? "Enter a city and country for each destination and your departure address."
              : (errors.destination || errors.origin)!,
          )}
        </small>
      )}
    </>
  );
}
