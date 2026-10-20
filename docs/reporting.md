# Accomplishment Reporting & District 3820 Guidelines

## 1. Official Rotary Areas of Focus
Every project must be tagged with at least one of the official 7 Rotary Areas of Focus:
1. Peacebuilding and Conflict Prevention
2. Disease Prevention and Treatment
3. Water, Sanitation, and Hygiene
4. Maternal and Child Health
5. Basic Education and Literacy
6. Community Economic Development
7. Environment

*Important Rule*: Service categories (Youth Service, Club Service, Community Outreach) are categorized in a separate table and are **never** substituted for an official Area of Focus.

## 2. UN Sustainable Development Goals (SDGs)
Projects support 1-17 SDG alignments. The user interface distinguishes between alignment intent and verified outcome evidence.

## 3. District 3820 Template Status
- Official District 3820 forms were **not** provided in the repository.
- Therefore, the application implements a **configurable template engine** (`report_templates`).
- Generated reports are marked with `is_official_validated = false` by default. Reports must **never** be labeled "officially compliant" until the club validates the structure against the genuine District 3820 format.

## 4. Reproducible Snapshots
Whenever an accomplishment report is submitted for review, the application serializes an immutable JSON data snapshot into `report_submissions.data_snapshot`. Subsequent PDF or DOCX generation reads from this snapshot, guaranteeing historical reproducibility even if live project fields change.
