# Attribution

This file is the source and licensing ledger for corpus content used by Ask the Ancients.

## Status Summary

- Most corpus inputs are from Project Gutenberg public-domain texts (US context).
- Two current inputs are curated local text packs (`mahavira`, `ramanuja`) and are not yet mapped to canonical public-domain editions in this file.
- Before broad OSS distribution, curated packs should be replaced with fully traceable public-domain primary texts or explicitly licensed with clear provenance.

## Source Manifest

| Philosopher | Work | Source | URL / Path | Licensing status | Notes |
|---|---|---|---|---|---|
| Marcus Aurelius | Meditations | Project Gutenberg #2680 | https://www.gutenberg.org/cache/epub/2680/pg2680.txt | PD-US (expected) | George Long translation
| Epictetus | Discourses | Project Gutenberg #10661 | https://www.gutenberg.org/cache/epub/10661/pg10661.txt | PD-US (expected) | Public-domain translation
| Epictetus | Enchiridion | Project Gutenberg #45109 | https://www.gutenberg.org/cache/epub/45109/pg45109.txt | PD-US (expected) | Higginson translation
| Seneca | On the Shortness of Life | Project Gutenberg #64576 | https://www.gutenberg.org/cache/epub/64576/pg64576.txt | PD-US (expected) | Minor Dialogues section extraction
| Seneca | On the Happy Life | Project Gutenberg #64576 | https://www.gutenberg.org/cache/epub/64576/pg64576.txt | PD-US (expected) | Minor Dialogues section extraction
| Seneca | On Peace of Mind | Project Gutenberg #64576 | https://www.gutenberg.org/cache/epub/64576/pg64576.txt | PD-US (expected) | Minor Dialogues section extraction
| Patanjali | Yoga Sutras | Project Gutenberg #2526 | https://www.gutenberg.org/cache/epub/2526/pg2526.txt | PD-US (expected) | Johnston translation
| The Buddha | Dhammapada | Project Gutenberg #2017 | https://www.gutenberg.org/cache/epub/2017/pg2017.txt | PD-US (expected) | Max Muller translation
| Adi Shankaracharya | Upanishads (selected) | Project Gutenberg #3283 | https://www.gutenberg.org/cache/epub/3283/pg3283.txt | PD-US (expected) | Paramananda translation used in pipeline
| Aristotle | Nicomachean Ethics | Project Gutenberg #8438 | https://www.gutenberg.org/cache/epub/8438/pg8438.txt | PD-US (expected) | Ross translation
| Spinoza | Ethics | Project Gutenberg #3800 | https://www.gutenberg.org/cache/epub/3800/pg3800.txt | PD-US (expected) | Elwes translation
| Mahavira | Uttaradhyayana-inspired curated set | Local curated pack | `scripts/mahavira-texts.ts` | TODO | Replace or document canonical public-domain source mapping
| Ramanuja | Vedartha Sangraha / Sri Bhasya curated set | Local curated pack | `scripts/ramanuja-texts.ts` | TODO | Replace or document canonical public-domain source mapping

## Project Gutenberg Notes

- Project Gutenberg texts include their own license/header metadata in distributed files.
- If redistributing raw Gutenberg text files, retain the Gutenberg header/license text that accompanies those files.
- This project stores transformed chunks for retrieval; maintain provenance links to original Gutenberg records in this file.

## Repo Licensing Consistency

- `README.md` currently states license status is pending.
- Top-level `LICENSE` file is missing.
- TODO: add a repository code license (`LICENSE`) before public release and align wording across `README.md`, this file, and GitHub metadata.

## Maintenance Checklist

When adding a philosopher/work:

1. Add a row to the manifest table above.
2. Include canonical source URL (or exact local source path with provenance docs).
3. Record licensing status (`PD-US`, `CC0`, etc.) and any caveats.
4. If source is curated/adapted, add explicit derivation notes and permission basis.
5. Verify `README.md` and ingestion scripts reflect the same source list.
