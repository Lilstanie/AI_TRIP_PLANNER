# Packing checklist: failure inventory

Written before the code (#543). Each line is a way the feature could fail.

- The packing items in Travel tips are still one line of text with no checkbox per item.
- A checkbox has no accessible name, or its name is not the item text.
- Space on a focused checkbox does not tick it.
- Ticking an item folds or opens the Travel tips disclosure.
- A tick is lost after a reload, or after opening another Trip and coming back.
- A tick in one Trip shows in another Trip with the same packing items.
- At phone width a checkbox row is smaller than a 44 px touch target.
- Chinese item text is not ticked or not restored the same way.
