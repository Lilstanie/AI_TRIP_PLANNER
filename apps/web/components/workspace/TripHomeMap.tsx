"use client";
import { useState } from "react";
import type { TripPlan } from "@trip/shared";
import { useLocale } from "@/components/account/LocaleProvider";
import {
  mapProviderOptions,
  type DataMode,
  type DataModeProviders,
} from "@/lib/workspace/data-mode";
import { TripMapCanvas } from "../map/TripMapCanvas";
import { useTripPlaces } from "../map/useTripPlaces";
import { useUserLocation } from "../map/useUserLocation";

export function TripHomeMap({
  plan,
  mode,
  providers,
  focusedDay,
  focusRequest,
}: {
  plan: TripPlan;
  mode?: DataMode;
  providers?: DataModeProviders;
  focusedDay?: number;
  focusRequest?: number;
}) {
  const { locale } = useLocale();
  const provider = mapProviderOptions(mode, providers);
  const tripPlaces = useTripPlaces(plan, mode, locale, provider.forceOsm, provider.allowFallback);
  const userLocation = useUserLocation();
  const [selected, setSelected] = useState<string>();
  return (
    <section className="trip-home__map" data-day={focusedDay}>
      <TripMapCanvas
        destination={plan.brief.destination}
        viewKey={`${plan.tripId}|${plan.brief.destination}`}
        tripPlaces={tripPlaces}
        selectedActivity={selected}
        onSelectActivity={setSelected}
        routes={[]}
        focusedDay={focusedDay}
        focusRequest={focusRequest}
        showPhotos={mode === "live" && !!providers?.maps}
        userLocation={userLocation}
      />
    </section>
  );
}
