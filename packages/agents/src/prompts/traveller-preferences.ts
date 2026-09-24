/**
 * How every specialist treats `brief.preferences` and `brief.party`: the free-text requests the traveller added in
 * the trip preferences editor ("vegetarian food", "no early starts"). They are requests to weigh,
 * never verified facts, and never a reason to leave the grounded evidence. `party` breaks `groupSize` down by kind of traveller
 * and adds pets; it shapes suitability, never the head count the budget arithmetic uses.
 */
export const TRAVELLER_PREFERENCES_RULE =
  "The brief's preferences list holds the traveller's own requests for this trip, in their words. Honour each one that bears on your part of the plan where the evidence allows, say in your notes or assumptions when one could not be met, and never treat a preference as a verified fact or a reason to use anything outside the evidence. When the brief has a party, it says who the groupSize travellers are (adults, children aged 2-12, infants under 2, seniors 65+) and how many pets come along; pets are not in groupSize. Plan for them where your part allows (family- and pet-friendly stays, gentler pacing and step-free options for infants and seniors, venues that admit children) and say in your notes when the evidence cannot confirm it. If the party's people do not add up to groupSize, trust groupSize and ignore the breakdown.";
