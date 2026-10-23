# Reply language in model prompts: failure inventory

Written before the code (#492, second pull request). Each line is a way the change could fail.

- The coordinator still guesses the language: its prompt names the interface language instead of
  the turn's resolved reply language, so English typed in the Chinese interface gets Chinese.
- A Chinese turn's specialist drafts (guide, dining, itinerary text, stay reasons) stay English
  because the language never reaches the generator.
- The supervisor writes English objectives in a Chinese turn, so the Think panel mixes languages.
- The rule tells the model to translate candidate names, so exact-name grounding rejects every
  Chinese draft and the specialist falls back.
- The rule changes amounts, ids, dates or codes.
- A caller with no reply language (Agent Lab, older tests) gets a changed prompt.
- A custom generator passed by a test or the Agent Lab breaks because the input gained a required
  field.
