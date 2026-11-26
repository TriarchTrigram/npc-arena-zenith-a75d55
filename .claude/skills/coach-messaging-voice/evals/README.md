# Voice cases for Coach in a messaging app

`cases.json` holds pass/fail prompt cases for iterating `../SKILL.md` by hand. They are fixtures, not a test suite and not a CI gate.

To run one: open the Coach chat of an app in the messaging pilot on WhatsApp (or a signed replay outside production), send the case's `message` after setting up its `context`, and check the reply against `must` and `mustNot`. Bubble counts are the messages that arrive on the phone, character counts are per bubble.
