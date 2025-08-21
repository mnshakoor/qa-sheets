# Quanta BI Prototype

Single page React app that gives you a Power like BI experience with Excel like transforms, a pivot builder, and Recharts based visuals. It also parses Tableau XML and a Power BI model JSON shape for schema only compatibility.

## Features
- Import CSV, XLSX, JSON. Schema only import from Tableau .twb or .tds or .xml and a Power BI model JSON shape.
- Excel like transforms in a step pipeline: filter, select, sort, dedupe, fill down or up, find and replace, trim, to number, to date, split, merge.
- Calculated fields using Excel like functions: IF, AND, OR, NOT, ISBLANK, ISNUMBER, ISTEXT, N, ABS, ROUND, FLOOR, CEILING, MIN, MAX, SQRT, LEN, LEFT, RIGHT, MID, UPPER, LOWER, PROPER, TRIM, CONCAT, CONCATENATE, TEXTJOIN, SUBSTITUTE, TODAY, NOW, DATE, YEAR, MONTH, DAY, DATEDIF, SUMIF, COUNTIF, AVERAGEIF, LOOKUP.
- Pivot builder with sum, avg, count, min, max.
- Charts: bar, line, pie.
- Export: CSV, Excel, PNG of chart, PDF of dashboard.
- Theme toggle and shareable URL state.

## Quick start
1. Install Node 18 or later.
2. In this folder run:
   ```bash
   npm install
   npm run dev
   ```
3. Open the printed local URL. Load `sample/sample.csv` or your own file.

## Notes
- Tableau and Power BI support in this build is schema only. No .pbix or .twbx extraction.
- Data stays in your browser while testing.
