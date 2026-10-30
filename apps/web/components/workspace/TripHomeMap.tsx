"use client";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
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
  selectedActivity,
  onSelectActivity,
  routes = [],
}: {
  plan: TripPlan;
  mode?: DataMode;
  providers?: DataModeProviders;
  focusedDay?: number;
  focusRequest?: number;
  selectedActivity?: string;
  onSelectActivity(id: string): void;
  routes?: RouteResult[];
}) {
  const { locale } = useLocale();
  const provider = mapProviderOptions(mode, providers);
  const tripPlaces = useTripPlaces(plan, mode, locale, provider.forceOsm, provider.allowFallback);
  const userLocation = useUserLocation();
  return (
    <section className="trip-home__map" data-day={focusedDay}>
      <TripMapCanvas
        destination={plan.brief.destination}
        viewKey={`${plan.tripId}|${plan.brief.destination}`}
        tripPlaces={tripPlaces}
        selectedActivity={selectedActivity}
        onSelectActivity={onSelectActivity}
        routes={routes}
        focusedDay={focusedDay}
        focusRequest={focusRequest}
        showPhotos={mode === "live" && !!providers?.maps}
        userLocation={userLocation}
      />
    </section>
  );
}
