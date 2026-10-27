# CLAUDE.md

Övningsrepo för Python och datagranskning (Decision Science).

## Filer
- `main.py` – första Python-programmet (en `print`).
- `Data_Audit_Sandbox_EN_v2.ipynb` – undervisningsnotebook (engelska, Colab). Simulerad lånedata, KNN-modellval, läckagedemo och en "answer vault" med orakelutfall som bara finns i simuleringen. Avsnitt 9 bäddar in UCI Bank Marketing (CC BY 4.0) som gzip/base64 i en cell.
- `.claude/skills/data-audit/` – projektets skill för datagranskning.

## Kommandon
- Installera: `pip install -r requirements.txt` (sker automatiskt i molnsessioner via `.claude/hooks/session-start.sh`).
- Kör notebooken (röktest, ~6 s): `MPLBACKEND=Agg jupyter nbconvert --to notebook --execute Data_Audit_Sandbox_EN_v2.ipynb --output-dir <scratch-katalog>`
- Lint: `ruff check main.py Data_Audit_Sandbox_EN_v2.ipynb`

## Regler
- Notebooken skriver `audit_evidence.json` i sin arbetskatalog. Filen är gitignorerad och ska inte committas.
- Ändra inte notebookens pedagogiska innehåll (frågor, kontroller, `SEED`, siffror) utan att användaren ber om det. Kör den efteråt för att se att alla celler går igenom.
- Rör inte den inbäddade CSV-strängen i avsnitt 9 för hand.
- Notebookens egen stil är kompakt (flera satser per rad, korta namn). Följ den i notebooken; använd vanlig PEP 8 i nya `.py`-filer.
