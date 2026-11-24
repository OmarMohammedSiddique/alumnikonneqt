"""Compare human grades of the synth-v3 review sheet with the generated grades (issue #115).

    python ml/human_review_v3.py \
        --sheet ml/data/synth-v3/human_review_sheet.csv \
        --key ml/data/synth-v3/test_human_review_key.csv \
        --rankings ml/runs/<run>/test \
        --reviewer path/to/reviewer-a.csv [--reviewer path/to/reviewer-b.csv] \
        --out path/to/new-output-folder

What it does, in order:

1. Checks every reviewer file against the blank sheet: the same row ids, the profile text
   untouched, one reviewer id, every grade a whole number from 0 to 3. It refuses to go on if a
   single row of the first reviewer is blank or changed, so nobody sees agreement figures before
   grading is finished. A second reviewer may grade a subset of rows.
2. Agreement between each reviewer and the generated grades: exact, within one grade, Cohen's
   kappa (unweighted, linear and quadratic weights) and the full confusion matrix. With two
   reviewers, the same figures between them on the rows both graded. Differences are always
   human minus generated, or first reviewer minus second.
3. Rescoring on the reviewed queries. Each system's stored test ranking (the
   `*_rankings.json` files written by `score_locked_test_v3.py`) is cut down to the reviewed
   candidates of each Mentee, keeping the system's order (a condensed list). The metrics of
   `eval_v3` are then computed twice on exactly the same lists, once with the first reviewer's
   grades and once with the generated grades, beside a random order of the same lists. Systems
   are compared with paired bootstrap intervals, signed as in the locked test report
   (`scratch_v3_minus_<other>`).

Read the rescoring with two cautions, which the report repeats: each list holds only the 8
reviewed candidates, so `ndcg10` is nDCG over the whole list of 8; and up to 4 of the 8 were
chosen because their generated grades were the highest, so the lists are easier than the full
pool and say nothing about it on their own.

The rankings are reused, not recomputed: no model is run and no test data file other than
the key is opened (the stored rankings are earlier outputs, not test data). Reusing the test split with new labels is test reuse and must be reported as such.
The report records the path and SHA-256 of every input so a rerun with changed grades shows.
"""
import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import sys

ML_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_DIR))
import eval_v3  # noqa: E402

GRADES = (0, 1, 2, 3)
TEXT_FIELDS = ("mentee_headline", "mentee_bio", "mentee_skills", "mentee_industry",
               "mentor_headline", "mentor_bio", "mentor_skills", "mentor_industry")
GRADE_FIELD = "your_grade_0_to_3"
UNSURE_VALUES = {"": False, "false": False, "no": False, "0": False, "true": True, "yes": True, "1": True}
# Systems listed first are compared against those after them, matching score_locked_test_v3.
SYSTEM_ORDER = ("scratch_v3", "minilm", "bm25", "tfidf")
RESULTS_FILE, CONDENSED_FILE, SUMMARY_FILE = "human_review_results.json", "human_review_condensed.json", "human_review_summary.txt"
CAUTIONS = [
    "Test reuse: stored synth-v3 test rankings are rescored with human grades after the test result was read.",
    "Each condensed list holds only the reviewed candidates (8 per Mentee), so ndcg10 is nDCG over the whole list.",
    "Up to 4 of each Mentee's 8 candidates were chosen for their high generated grades, so the lists are easier "
    "than the full pool; compare systems with each other and with the random order, not with full-pool figures.",
]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_csv(path):
    try:
        with open(path, encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
    except UnicodeDecodeError:
        raise SystemExit(f"{path} is not UTF-8: export it again as 'CSV UTF-8' (Excel) or CSV from Numbers")
    # Spreadsheets sometimes add rows of empty cells at the end.
    return [row for row in rows if any((value or "").strip() for value in row.values() if isinstance(value, str))]


def load_reviewer(path, blank):
    """Validated grades from one reviewer file: {row_id: {"grade", "unsure", "note"}} and the id.

    `blank` maps row id -> the untouched sheet row. Every problem is collected and reported at once.
    """
    rows = read_csv(path)
    problems, grades, reviewer_ids, seen = [], {}, set(), set()
    for number, row in enumerate(rows, 1):
        row_id = (row.get("row_id") or "").strip()
        where = row_id or f"data row {number} (no row_id)"
        if row_id not in blank:
            problems.append(f"{where}: row_id is not on the blank sheet")
            continue
        if row_id in seen:
            problems.append(f"{where}: row_id appears twice")
            continue
        seen.add(row_id)
        changed = [field for field in TEXT_FIELDS if (row.get(field) or "").strip() != blank[row_id][field].strip()]
        if changed:
            problems.append(f"{where}: profile text changed in {', '.join(changed)}")
        raw = (row.get(GRADE_FIELD) or "").strip()
        try:
            number_value = float(raw)
            grade = int(number_value)
        except (ValueError, OverflowError):
            number_value, grade = None, None
        if grade not in GRADES or number_value != grade:
            problems.append(f"{where}: grade {raw!r} is not a whole number from 0 to 3")
            continue
        unsure = (row.get("unsure_true_false") or "").strip().lower()
        if unsure not in UNSURE_VALUES:
            problems.append(f"{where}: unsure_true_false {unsure!r} is not true or false")
            continue
        reviewer = (row.get("reviewer_id") or "").strip()
        if not reviewer:
            problems.append(f"{where}: reviewer_id is empty")
        reviewer_ids.add(reviewer)
        grades[row_id] = {"grade": grade, "unsure": UNSURE_VALUES[unsure], "note": (row.get("note") or "").strip()}
    reviewer_ids.discard("")
    if len(reviewer_ids) > 1:
        problems.append(f"more than one reviewer_id in one file: {sorted(reviewer_ids)}")
    if not rows:
        problems.append("the file has no rows")
    if problems:
        raise SystemExit(f"{path} cannot be used yet:\n  " + "\n  ".join(problems))
    return grades, next(iter(reviewer_ids))


def confusion(first, second):
    matrix = [[0] * len(GRADES) for _ in GRADES]
    for a, b in zip(first, second):
        matrix[a][b] += 1
    return matrix


def kappa(first, second, weighting=None):
    """Cohen's kappa over grades 0 to 3. `weighting` is None (unweighted), "linear" or "quadratic"."""
    if len(first) != len(second) or not first:
        raise ValueError("kappa needs two equal, non-empty lists")
    top = len(GRADES) - 1

    def weight(i, j):
        if weighting is None:
            return float(i != j)
        distance = abs(i - j) / top
        return distance if weighting == "linear" else distance ** 2

    n = len(first)
    observed = confusion(first, second)
    row_totals = [sum(row) for row in observed]
    column_totals = [sum(observed[i][j] for i in GRADES) for j in GRADES]
    disagreement = sum(weight(i, j) * observed[i][j] for i in GRADES for j in GRADES) / n
    expected = sum(weight(i, j) * row_totals[i] * column_totals[j] for i in GRADES for j in GRADES) / n ** 2
    if expected == 0:
        return None  # both raters used one and the same grade throughout: kappa is undefined
    return 1 - disagreement / expected


def agreement(first, second):
    """Agreement figures between two equal lists of grades; differences are first minus second."""
    n = len(first)
    return {
        "rows": n,
        "exact": sum(a == b for a, b in zip(first, second)) / n,
        "within_one": sum(abs(a - b) <= 1 for a, b in zip(first, second)) / n,
        "kappa": kappa(first, second),
        "kappa_linear": kappa(first, second, "linear"),
        "kappa_quadratic": kappa(first, second, "quadratic"),
        "mean_difference": sum(a - b for a, b in zip(first, second)) / n,
        "confusion_rows_first_columns_second": confusion(first, second),
        "first_counts": {str(g): first.count(g) for g in GRADES},
        "second_counts": {str(g): second.count(g) for g in GRADES},
    }


def condensed_rows(rankings, judged):
    """Per-Mentee metrics for one system on condensed lists.

    `rankings` is a system's stored test rows; `judged` maps mentee id -> {mentor id: grade}.
    Each ranking keeps only the judged Mentors, in the system's order.
    """
    by_mentee = {row["mentee_id"]: row["ranking"] for row in rankings}
    rows = []
    for mentee in sorted(judged):
        if mentee not in by_mentee:
            raise ValueError(f"no stored ranking for {mentee}")
        order = [mentor for mentor in by_mentee[mentee] if mentor in judged[mentee]]
        if set(order) != set(judged[mentee]):
            raise ValueError(f"the stored ranking for {mentee} does not contain every reviewed Mentor")
        grades = [judged[mentee][mentor] for mentor in order]
        rows.append({"mentee_id": mentee, **eval_v3.query_metrics(grades), "ranking": order, "ranked_grades": grades})
    return rows


def load_rankings(folder):
    systems, hashes = {}, {}
    for path in sorted(Path(folder).glob("*_rankings.json")):
        name = path.name.removesuffix("_rankings.json")
        systems[name] = json.loads(path.read_text(encoding="utf-8"))
        hashes[path.name] = sha256(path)
    if not systems:
        raise SystemExit(f"no *_rankings.json files in {folder}")
    return systems, hashes


def ordered(names):
    rank = {name: index for index, name in enumerate(SYSTEM_ORDER)}
    return sorted(names, key=lambda name: (rank.get(name, len(SYSTEM_ORDER)), name))


def rescore(systems, judged):
    rows = {name: condensed_rows(stored, judged) for name, stored in systems.items()}
    names = ordered(rows)
    paired = {f"{a}_minus_{b}": {metric: eval_v3.paired_difference(rows[a], rows[b], metric) for metric in eval_v3.METRICS}
              for position, a in enumerate(names) for b in names[position + 1:]}
    return {"summary": {name: eval_v3.summarise(rows[name]) for name in names},
            "random_order": eval_v3.random_baseline(judged), "paired": paired}, rows


def lock_commit(rankings_folder):
    results = Path(rankings_folder) / "test_results.json"
    if not results.exists():
        return None
    return json.loads(results.read_text(encoding="utf-8")).get("lock_commit")


def reviewer_entry(grades, generated):
    rows = sorted(grades)
    sure = [row for row in rows if not grades[row]["unsure"]]
    return {
        "rows_graded": len(rows),
        "unsure_rows": [row for row in rows if grades[row]["unsure"]],
        "notes": {row: grades[row]["note"] for row in rows if grades[row]["note"]},
        "vs_generated": agreement([grades[r]["grade"] for r in rows], [generated[r] for r in rows]),
        "vs_generated_sure_rows_only": agreement([grades[r]["grade"] for r in sure], [generated[r] for r in sure]) if sure else None,
    }


def analyse(sheet_path, key_path, rankings_folder, reviewer_paths):
    blank = {row["row_id"]: row for row in read_csv(sheet_path)}
    key = {row["row_id"]: row for row in read_csv(key_path)}
    if set(key) != set(blank):
        raise SystemExit("the key and the blank sheet list different rows")
    for path in [sheet_path, key_path, *reviewer_paths]:
        if not Path(path).is_file():
            raise SystemExit(f"{path} was not found")
    if len({sha256(path) for path in reviewer_paths}) != len(reviewer_paths):
        raise SystemExit("the same reviewer file was given twice")
    reviewers = [load_reviewer(path, blank) for path in reviewer_paths]
    ids = [reviewer_id for _, reviewer_id in reviewers]
    if len(set(ids)) != len(ids):
        raise SystemExit(f"two reviewer files share the reviewer_id {ids[0]!r}: give each reviewer their own pseudonym")
    first_grades, first_id = reviewers[0]
    if set(first_grades) != set(blank):
        missing = sorted(set(blank) - set(first_grades))
        raise SystemExit(f"the first reviewer must grade the whole sheet; missing rows: {', '.join(missing[:10])}")
    generated = {row_id: int(row["generated_grade"]) for row_id, row in key.items()}
    systems, ranking_hashes = load_rankings(rankings_folder)

    report = {
        "created_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cautions": CAUTIONS,
        "inputs": {
            "sheet": {"path": str(sheet_path), "sha256": sha256(sheet_path)},
            "key": {"path": str(key_path), "sha256": sha256(key_path)},
            "reviewers": [{"reviewer_id": reviewer_id, "file": Path(path).name, "sha256": sha256(path)}
                          for path, (_, reviewer_id) in zip(reviewer_paths, reviewers)],
            "rankings_folder": str(rankings_folder), "rankings": ranking_hashes,
            "lock_commit": lock_commit(rankings_folder),
        },
        "reviewers": {reviewer_id: reviewer_entry(grades, generated) for grades, reviewer_id in reviewers},
        "between_reviewers": None,
    }
    if len(reviewers) > 1:
        second_grades, second_id = reviewers[1]
        shared = sorted(set(first_grades) & set(second_grades))
        report["between_reviewers"] = {
            "first": first_id, "second": second_id,
            **agreement([first_grades[r]["grade"] for r in shared], [second_grades[r]["grade"] for r in shared]),
            "first_vs_generated_on_same_rows": agreement([first_grades[r]["grade"] for r in shared], [generated[r] for r in shared]),
            "second_vs_generated_on_same_rows": agreement([second_grades[r]["grade"] for r in shared], [generated[r] for r in shared]),
        }

    human, synthetic = {}, {}
    for row_id, row in key.items():
        human.setdefault(row["mentee_id"], {})[row["mentor_id"]] = first_grades[row_id]["grade"]
        synthetic.setdefault(row["mentee_id"], {})[row["mentor_id"]] = generated[row_id]
    human_report, human_rows = rescore(systems, human)
    synthetic_report, _ = rescore(systems, synthetic)
    report["rescoring"] = {
        "queries": len(human), "candidates_per_query": sorted({len(pool) for pool in human.values()}),
        "grades_from": first_id, "systems": ordered(systems),
        "human_grades": human_report, "generated_grades_same_lists": synthetic_report,
    }
    return report, human_rows


def number(value, width=0, sign=False):
    if value is None:
        return "undefined".rjust(width)
    return f"{value:{'+' if sign else ''}{width}.3f}"


def table(report):
    """A short plain-text summary of the report."""
    lines = []
    for reviewer_id, found in report["reviewers"].items():
        figures = found["vs_generated"]
        lines.append(f"{reviewer_id} vs generated ({figures['rows']} rows, {len(found['unsure_rows'])} unsure): "
                     f"exact {number(figures['exact'])}, within one {number(figures['within_one'])}, "
                     f"quadratic kappa {number(figures['kappa_quadratic'])}, "
                     f"mean difference (human minus generated) {number(figures['mean_difference'], sign=True)}")
    between = report["between_reviewers"]
    if between:
        lines.append(f"{between['first']} vs {between['second']} ({between['rows']} rows): exact {number(between['exact'])}, "
                     f"within one {number(between['within_one'])}, quadratic kappa {number(between['kappa_quadratic'])}")
    rescoring = report["rescoring"]
    lines.append(f"\nRescoring on {rescoring['queries']} queries, condensed to the reviewed candidates:")
    lines.append(f"{'system':12s} {'human nDCG@5':>13s} {'generated':>10s} {'human P@5':>10s} {'generated':>10s}")
    rows = [(name, rescoring["human_grades"]["summary"][name], rescoring["generated_grades_same_lists"]["summary"][name])
            for name in rescoring["systems"]]
    rows.append(("random order", rescoring["human_grades"]["random_order"], rescoring["generated_grades_same_lists"]["random_order"]))
    for name, human, synthetic in rows:
        lines.append(f"{name:12s} {number(human['ndcg5']['mean'], 13)} {number(synthetic['ndcg5']['mean'], 10)} "
                     f"{number(human['p5']['mean'], 10)} {number(synthetic['p5']['mean'], 10)}")
    lines.append("\nWith human grades (paired bootstrap, nDCG@5):")
    for pair, found in rescoring["human_grades"]["paired"].items():
        interval = found["ndcg5"]["ci95"]
        span = f"[{number(interval[0], sign=True)}, {number(interval[1], sign=True)}]" if interval else "no interval"
        lines.append(f"  {pair}: {number(found['ndcg5']['mean'], sign=True)} {span}, {found['ndcg5']['verdict']}")
    lines.append("")
    lines.extend(f"Caution: {caution}" for caution in report["cautions"])
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--sheet", required=True, help="the blank human_review_sheet.csv")
    parser.add_argument("--key", required=True, help="test_human_review_key.csv with the generated grades")
    parser.add_argument("--rankings", required=True, help="folder holding the stored *_rankings.json test files")
    parser.add_argument("--reviewer", action="append", required=True,
                        help="a graded copy of the sheet; the first must cover every row, a second may cover a subset")
    parser.add_argument("--out", required=True, help="new folder for the results, the condensed rankings and the summary")
    args = parser.parse_args(argv)
    if len(args.reviewer) > 2:
        raise SystemExit("at most two reviewers")
    out = Path(args.out)
    if out.resolve() == Path(args.rankings).resolve():
        raise SystemExit("--out must not be the rankings folder")
    if (out / RESULTS_FILE).exists():
        raise SystemExit(f"{out / RESULTS_FILE} already exists: choose a new --out folder")
    report, human_rows = analyse(args.sheet, args.key, args.rankings, args.reviewer)
    summary = table(report)
    results, condensed = json.dumps(report, indent=1) + "\n", json.dumps(human_rows) + "\n"
    out.mkdir(parents=True, exist_ok=True)
    (out / CONDENSED_FILE).write_text(condensed, encoding="utf-8")
    (out / SUMMARY_FILE).write_text(summary + "\n", encoding="utf-8")
    (out / RESULTS_FILE).write_text(results, encoding="utf-8")
    print(summary)


if __name__ == "__main__":
    main()
