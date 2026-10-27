"""Quick technical profile of a tabular file for the data-audit skill.

Usage:
    python3 profile.py data.csv [--target COL] [--group COL] [--id COL] [--sep ,]

Supports .csv/.tsv/.txt (any separator) and .xlsx/.xls. Prints facts only;
judging what is invalid needs the data contract.
"""

import argparse
from pathlib import Path

import pandas as pd

SENTINEL_NUMBERS = [-999, -99, -1, 99, 999, 9999]
SENTINEL_STRINGS = {"unknown", "na", "n/a", "none", "null", "missing", "?", "-", ""}


def load(path, sep):
    suffix = Path(path).suffix.lower()
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    return pd.read_csv(path, sep=sep, engine="python")


def section(title):
    print(f"\n=== {title} ===")


def profile(df):
    return pd.DataFrame(
        {
            "dtype": df.dtypes.astype(str),
            "missing_n": df.isna().sum(),
            "missing_pct": (100 * df.isna().mean()).round(1),
            "unique_n": df.nunique(),
        }
    )


def sentinel_candidates(df, skip=()):
    rows = []
    for col in df.columns.drop(list(skip)):
        s = df[col]
        if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s):
            for value in SENTINEL_NUMBERS:
                n = int((s == value).sum())
                if n:
                    rows.append((col, value, n))
            non_positive = int((s <= 0).sum())
            if non_positive and (s > 0).mean() > 0.95:
                rows.append((col, "<= 0 in mostly-positive column", non_positive))
        else:
            lowered = s.dropna().astype(str).str.strip().str.lower()
            for value, n in (
                lowered[lowered.isin(SENTINEL_STRINGS)].value_counts().items()
            ):
                rows.append((col, repr(value), int(n)))
    return pd.DataFrame(rows, columns=["column", "value", "count"])


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("path")
    parser.add_argument("--target", help="label column")
    parser.add_argument("--group", help="segment column to compare missingness across")
    parser.add_argument(
        "--id", dest="id_col", help="identifier column to check for uniqueness"
    )
    parser.add_argument(
        "--sep", default=None, help="CSV separator (default: auto-detect)"
    )
    args = parser.parse_args()

    df = load(args.path, args.sep)
    pd.set_option("display.width", 160)
    pd.set_option("display.max_columns", 50)

    section(f"Shape: {df.shape[0]} rows x {df.shape[1]} columns")
    print(profile(df).to_string())
    constant = [col for col in df.columns if df[col].nunique(dropna=False) == 1]
    if constant:
        print(
            "Constant columns (a group or policy may be missing entirely):",
            ", ".join(constant),
        )

    section("Duplicates")
    print("Exact duplicate rows:", int(df.duplicated().sum()))
    if args.id_col:
        print(
            f"Duplicate {args.id_col} values:", int(df[args.id_col].duplicated().sum())
        )

    section("Sentinel / invalid-value candidates")
    candidates = sentinel_candidates(df, skip=[args.id_col] if args.id_col else [])
    print(candidates.to_string(index=False) if len(candidates) else "None found")

    section("Numeric summary")
    numeric = df.select_dtypes("number")
    print(
        numeric.describe().T.to_string() if numeric.shape[1] else "No numeric columns"
    )

    if args.target:
        section(f"Target balance: {args.target}")
        print(
            df[args.target]
            .value_counts(dropna=False, normalize=True)
            .round(3)
            .to_string()
        )

    if args.group:
        section(f"Missing share by {args.group}")
        print(
            df.drop(columns=args.group)
            .isna()
            .groupby(df[args.group])
            .mean()
            .round(3)
            .T.to_string()
        )
        section(f"{args.group} shares: all rows vs complete rows only")
        shares = pd.DataFrame(
            {
                "all_rows": df[args.group].value_counts(normalize=True),
                "complete_rows": df.dropna()[args.group].value_counts(normalize=True),
            }
        ).fillna(0)
        print(shares.round(3).to_string())


if __name__ == "__main__":
    main()
