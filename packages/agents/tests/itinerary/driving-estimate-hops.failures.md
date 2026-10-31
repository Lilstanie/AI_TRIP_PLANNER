# Driving estimates between stops: how it could fail

Written before the code for TP-197. With `MAPS_PROVIDER=osm` every leg between two stops is an OSRM
driving estimate. Each one was reported as "driving estimate cannot verify public transport timing",
so a six-day Tokyo trip had a conflict per hop, the planner swapped in the fallback plan, and the
trip asked the traveller to fix it.

1. A driving estimate between two stops is still a conflict: it must be accepted as the hop's time.
2. An accepted estimate hides a real clash: a hop whose estimate plus the 15-minute buffer does not
   fit between the stops must still be a conflict.
3. The traveller is not told the times are estimates: the plan must say once that travel times
   between stops are driving estimates and public transport was not checked.
4. The note appears with real transit times: a plan whose hops all have verified routes must not
   carry it.
5. Transport between cities starts accepting driving estimates: the transport agent keeps rejecting
   them, because an inter-city hop decides which train or flight to book.
