# Return flight fare label: failure inventory

Written before the fix (#646). The return flight row's price line showed the message key
"Included in the flight in", a cut-off sentence. Each line is a way the fix could fail.

- The return row's price line still reads "Included in the flight in", or any sentence ending in "in".
- The English line does not say the return is part of the outbound fare.
- The Chinese line stops reading 含在去程票价中.
- The outbound flight row loses its price.
- The opened return flight card still shows the cut-off sentence.
