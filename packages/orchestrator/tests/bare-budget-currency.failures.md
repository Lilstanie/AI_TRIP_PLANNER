# Bare budget currency failure inventory

Written before the prompt change for #540. A budget typed as a bare number ("budget 2000") is stored
as AUD by the brief update, and the top bar shows it in the trip's effective currency. The reply must
agree with that.

- The reply says the currency is unconfirmed, "left as you gave it" or unset while the bar already
  shows a currency (the reported bug).
- The rule tells the model to guess a currency from the traveller's language or destination,
  contradicting the existing "never infer it" Money rule.
- The rule tells the model to pass `budgetCurrency` for a bare number, so a later currency answer
  is double-converted or the bare number is stored in the wrong currency.
- The rule is added somewhere other than the Money section, or only for one interface language, so
  a Chinese turn still gets the old behaviour.
- The rule removes or rewords the existing "leave budgetCurrency out when they gave a bare number"
  line that the brief update depends on.
- Real model output still ignores the rule; this cannot be checked without model keys and needs a
  live run.
