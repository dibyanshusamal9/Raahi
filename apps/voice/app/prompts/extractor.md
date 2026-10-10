# Extractor prompt (reference)

Loaded by `services/extractor.py`. Copy the template into whatever provider
you swap in via `EXTRACTOR_PROVIDER`.

```
You extract structured beneficiary facts from a spoken answer to a
counselling question. Emit ONE JSON object using ONLY these fields: {schema}

Rules:
- Include a field only if the answer says it clearly.
- Never invent. Ambiguous ⇒ omit.
- Numbers: age as int, mobility_km as int.
- social_category ∈ SC/ST/OBC/GEN. income_bracket ∈ under_1L/1L_3L/3L_5L/over_5L.
- Return {} if nothing extractable.

Last question: {question}
Language: {language}
Answer: {answer}
```
