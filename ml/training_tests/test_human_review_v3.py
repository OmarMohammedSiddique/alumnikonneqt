"""Checks for the human review comparison (issue #115), on made-up sheets only."""
import contextlib
import csv
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

ML_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_DIR))
import human_review_v3 as review  # noqa: E402

FIELDS = ["row_id", *review.TEXT_FIELDS, "reviewer_id", review.GRADE_FIELD, "unsure_true_false", "note"]


def write_csv(path, rows, fields=FIELDS):
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


class KappaTests(unittest.TestCase):
    def test_perfect_agreement_is_one(self):
        self.assertAlmostEqual(review.kappa([0, 1, 2, 3], [0, 1, 2, 3], "quadratic"), 1.0)

    def test_linear_and_quadratic_weights_differ(self):
        # Full reversal, uniform grades: linear observed 2/3 over expected 5/12.
        self.assertAlmostEqual(review.kappa([0, 1, 2, 3], [3, 2, 1, 0], "linear"), -0.6)

    def test_full_reversal_with_uniform_grades_is_minus_one(self):
        # Observed weighted disagreement 5/9, expected 5/18 under quadratic weights.
        self.assertAlmostEqual(review.kappa([0, 1, 2, 3], [3, 2, 1, 0], "quadratic"), -1.0)

    def test_hand_computed_half(self):
        # Observed agreement 3/4, chance agreement 1/2, so kappa is 1/2 under every weighting
        # because only the grades 0 and 1 are used.
        for weighting in (None, "linear", "quadratic"):
            self.assertAlmostEqual(review.kappa([0, 0, 1, 1], [0, 1, 1, 1], weighting), 0.5)

    def test_single_shared_grade_is_undefined(self):
        self.assertIsNone(review.kappa([2, 2, 2], [2, 2, 2]))

    def test_agreement_figures(self):
        found = review.agreement([0, 1, 3, 2], [0, 2, 1, 2])
        self.assertEqual((found["exact"], found["within_one"]), (0.5, 0.75))
        self.assertAlmostEqual(found["mean_difference"], 0.25)
        self.assertEqual(found["confusion_rows_first_columns_second"][3][1], 1)


class FixtureTests(unittest.TestCase):
    """Two Mentees with three reviewed Mentors each, and two systems with stored rankings."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.folder = Path(temporary.name)
        self.blank_rows = []
        self.key_rows = []
        generated = {"Q1": {"A": 3, "B": 0, "C": 1}, "Q2": {"A": 0, "B": 2, "C": 3}}
        for query, (mentee, grades) in enumerate(generated.items(), 1):
            for candidate, (mentor, grade) in enumerate(grades.items(), 1):
                row_id = f"R{query:02d}-{candidate}"
                self.blank_rows.append({"row_id": row_id, **{field: f"{field} {row_id}" for field in review.TEXT_FIELDS},
                                        "reviewer_id": "", review.GRADE_FIELD: "", "unsure_true_false": "", "note": ""})
                self.key_rows.append({"row_id": row_id, "mentee_id": mentee, "mentor_id": f"{mentee}-{mentor}",
                                      "generated_grade": grade})
        write_csv(self.folder / "sheet.csv", self.blank_rows)
        write_csv(self.folder / "key.csv", self.key_rows, ["row_id", "mentee_id", "mentor_id", "generated_grade"])
        rankings = self.folder / "test"
        rankings.mkdir()
        # Stored rankings run over the whole pool, including Mentors that were never reviewed (X).
        good = [{"mentee_id": "Q1", "ranking": ["Q1-X", "Q1-A", "Q1-C", "Q1-B"]},
                {"mentee_id": "Q2", "ranking": ["Q2-C", "Q2-X", "Q2-B", "Q2-A"]}]
        poor = [{"mentee_id": "Q1", "ranking": ["Q1-B", "Q1-C", "Q1-A", "Q1-X"]},
                {"mentee_id": "Q2", "ranking": ["Q2-A", "Q2-B", "Q2-C", "Q2-X"]}]
        (rankings / "scratch_v3_rankings.json").write_text(json.dumps(good))
        (rankings / "minilm_rankings.json").write_text(json.dumps(poor))

    def graded(self, grades, reviewer="reviewer-a", rows=None, **changes):
        rows = [dict(row) for row in (rows or self.blank_rows)]
        for row, grade in zip(rows, grades):
            row.update({"reviewer_id": reviewer, review.GRADE_FIELD: str(grade), "unsure_true_false": "false"})
        for row_id, update in changes.items():
            next(row for row in rows if row["row_id"] == row_id.replace("_", "-")).update(update)
        return rows

    def run_analysis(self, *reviewer_rows):
        paths = []
        for number, rows in enumerate(reviewer_rows):
            path = self.folder / f"reviewer-{number}.csv"
            write_csv(path, rows)
            paths.append(path)
        return review.analyse(self.folder / "sheet.csv", self.folder / "key.csv", self.folder / "test", paths)

    def test_human_grades_equal_to_generated_give_perfect_agreement(self):
        report, _ = self.run_analysis(self.graded([3, 0, 1, 0, 2, 3]))
        found = report["reviewers"]["reviewer-a"]["vs_generated"]
        self.assertEqual((found["exact"], found["kappa_quadratic"]), (1.0, 1.0))
        human = report["rescoring"]["human_grades"]["summary"]
        synthetic = report["rescoring"]["generated_grades_same_lists"]["summary"]
        self.assertEqual(human, synthetic)
        # The good system puts the best reviewed Mentor first for both Mentees.
        self.assertAlmostEqual(human["scratch_v3"]["ndcg5"]["mean"], 1.0)
        self.assertLess(human["minilm"]["ndcg5"]["mean"], 1.0)

    def test_condensed_lists_keep_system_order_and_drop_unreviewed(self):
        _, rows = self.run_analysis(self.graded([3, 0, 1, 0, 2, 3]))
        q1 = next(row for row in rows["scratch_v3"] if row["mentee_id"] == "Q1")
        self.assertEqual(q1["ranking"], ["Q1-A", "Q1-C", "Q1-B"])
        self.assertEqual(q1["ranked_grades"], [3, 1, 0])

    def test_different_human_grades_change_the_rescoring(self):
        report, _ = self.run_analysis(self.graded([0, 3, 1, 0, 2, 3]))
        found = report["reviewers"]["reviewer-a"]["vs_generated"]
        self.assertAlmostEqual(found["exact"], 4 / 6)
        human = report["rescoring"]["human_grades"]["summary"]["scratch_v3"]["ndcg5"]["mean"]
        synthetic = report["rescoring"]["generated_grades_same_lists"]["summary"]["scratch_v3"]["ndcg5"]["mean"]
        self.assertLess(human, synthetic)

    def test_second_reviewer_on_a_subset(self):
        second = self.graded([3, 1, 1], reviewer="reviewer-b", rows=self.blank_rows[:3])
        report, _ = self.run_analysis(self.graded([3, 0, 1, 0, 2, 3]), second)
        between = report["between_reviewers"]
        self.assertEqual((between["rows"], between["exact"]), (3, 2 / 3))
        self.assertEqual(report["reviewers"]["reviewer-b"]["rows_graded"], 3)

    def test_unsure_rows_are_counted_and_reported_separately(self):
        rows = self.graded([3, 0, 1, 0, 2, 3], R01_2={"unsure_true_false": "TRUE", "note": "thin evidence"})
        report, _ = self.run_analysis(rows)
        found = report["reviewers"]["reviewer-a"]
        self.assertEqual((found["unsure_rows"], found["vs_generated_sure_rows_only"]["rows"]), (["R01-2"], 5))

    def assert_refused(self, rows, message):
        with self.assertRaises(SystemExit) as caught:
            self.run_analysis(rows)
        self.assertIn(message, str(caught.exception))

    def test_refuses_a_blank_grade(self):
        self.assert_refused(self.graded([3, 0, 1, 0, 2, 3], R02_3={review.GRADE_FIELD: ""}), "not a whole number")

    def test_refuses_out_of_range_and_fractional_grades(self):
        self.assert_refused(self.graded([3, 0, 4, 0, 2, 3]), "not a whole number")
        self.assert_refused(self.graded([3, 0, 1.5, 0, 2, 3]), "not a whole number")

    def test_refuses_edited_profile_text(self):
        self.assert_refused(self.graded([3, 0, 1, 0, 2, 3], R01_1={"mentor_bio": "edited"}), "profile text changed")

    def test_refuses_missing_rows_for_the_first_reviewer(self):
        self.assert_refused(self.graded([3, 0, 1, 0, 2], rows=self.blank_rows[:5]), "must grade the whole sheet")

    def test_refuses_two_reviewer_ids_in_one_file(self):
        self.assert_refused(self.graded([3, 0, 1, 0, 2, 3], R02_1={"reviewer_id": "someone-else"}), "more than one reviewer_id")

    def test_refuses_duplicate_and_unknown_rows(self):
        rows = self.graded([3, 0, 1, 0, 2, 3])
        self.assert_refused(rows + [dict(rows[0])], "appears twice")
        self.assert_refused(rows + [{**rows[0], "row_id": "R99-1"}], "not on the blank sheet")

    def argv(self, reviewer, out):
        return ["--sheet", str(self.folder / "sheet.csv"), "--key", str(self.folder / "key.csv"),
                "--rankings", str(self.folder / "test"), "--reviewer", str(reviewer), "--out", str(out)]

    def test_main_refuses_to_overwrite_results(self):
        out = self.folder / "out"
        out.mkdir()
        (out / review.RESULTS_FILE).write_text("{}")
        write_csv(self.folder / "a.csv", self.graded([3, 0, 1, 0, 2, 3]))
        with self.assertRaises(SystemExit) as caught:
            review.main(self.argv(self.folder / "a.csv", out))
        self.assertIn("already exists", str(caught.exception))

    def test_main_refuses_the_rankings_folder_as_output(self):
        write_csv(self.folder / "a.csv", self.graded([3, 0, 1, 0, 2, 3]))
        with self.assertRaises(SystemExit) as caught:
            review.main(self.argv(self.folder / "a.csv", self.folder / "test"))
        self.assertIn("must not be the rankings folder", str(caught.exception))

    def test_main_writes_all_files_and_records_inputs(self):
        write_csv(self.folder / "a.csv", self.graded([3, 0, 1, 0, 2, 3]))
        out = self.folder / "out"
        with contextlib.redirect_stdout(io.StringIO()):
            review.main(self.argv(self.folder / "a.csv", out))
        for name in (review.RESULTS_FILE, review.CONDENSED_FILE, review.SUMMARY_FILE):
            self.assertTrue((out / name).exists(), name)
        report = json.loads((out / review.RESULTS_FILE).read_text())
        self.assertEqual(report["inputs"]["key"]["sha256"], review.sha256(self.folder / "key.csv"))
        self.assertEqual(sorted(report["inputs"]["rankings"]), ["minilm_rankings.json", "scratch_v3_rankings.json"])

    def test_comparisons_are_signed_like_the_locked_test(self):
        report, _ = self.run_analysis(self.graded([3, 0, 1, 0, 2, 3]))
        self.assertEqual(list(report["rescoring"]["human_grades"]["paired"]), ["scratch_v3_minus_minilm"])
        self.assertEqual(report["rescoring"]["systems"], ["scratch_v3", "minilm"])
        self.assertIn("ndcg5", report["rescoring"]["human_grades"]["random_order"])

    def test_refuses_a_ranking_without_every_reviewed_mentor(self):
        broken = [{"mentee_id": "Q1", "ranking": ["Q1-A", "Q1-B"]}, {"mentee_id": "Q2", "ranking": ["Q2-A", "Q2-B", "Q2-C"]}]
        (self.folder / "test" / "minilm_rankings.json").write_text(json.dumps(broken))
        with self.assertRaises(ValueError):
            self.run_analysis(self.graded([3, 0, 1, 0, 2, 3]))

    def test_refuses_two_files_with_one_reviewer_id(self):
        second = self.graded([3, 1, 1], rows=self.blank_rows[:3])
        with self.assertRaises(SystemExit) as caught:
            self.run_analysis(self.graded([3, 0, 1, 0, 2, 3]), second)
        self.assertIn("share the reviewer_id", str(caught.exception))

    def test_refuses_the_same_file_twice(self):
        rows = self.graded([3, 0, 1, 0, 2, 3])
        with self.assertRaises(SystemExit) as caught:
            self.run_analysis(rows, rows)
        self.assertIn("given twice", str(caught.exception))

    def test_spreadsheet_quirks_are_accepted(self):
        rows = self.graded([3, 0, 1, 0, 2, 3], R01_1={review.GRADE_FIELD: "3.0"}, R01_2={review.GRADE_FIELD: " 0 "},
                           R01_3={"unsure_true_false": "TRUE"})
        path = self.folder / "quirks.csv"
        write_csv(path, rows)
        # A byte order mark at the start and an empty trailing row, as Excel can write.
        path.write_text("\ufeff" + path.read_text(encoding="utf-8") + ",,,,,,,,,,,,\n", encoding="utf-8")
        report, _ = review.analyse(self.folder / "sheet.csv", self.folder / "key.csv", self.folder / "test", [path])
        found = report["reviewers"]["reviewer-a"]
        self.assertEqual((found["vs_generated"]["exact"], found["unsure_rows"]), (1.0, ["R01-3"]))

    def test_infinite_and_non_utf8_input_are_refused_cleanly(self):
        self.assert_refused(self.graded([3, 0, 1, 0, 2, 3], R01_1={review.GRADE_FIELD: "inf"}), "not a whole number")
        rows = self.graded([3, 0, 1, 0, 2, 3], R01_1={"note": "caf\u00e9"})
        path = self.folder / "latin.csv"
        write_csv(path, rows)
        path.write_bytes(path.read_text(encoding="utf-8").encode("cp1252"))
        with self.assertRaises(SystemExit) as caught:
            review.analyse(self.folder / "sheet.csv", self.folder / "key.csv", self.folder / "test", [path])
        self.assertIn("CSV UTF-8", str(caught.exception))

    def test_notes_and_unsure_rows_are_kept(self):
        rows = self.graded([3, 0, 1, 0, 2, 3], R02_2={"unsure_true_false": "true", "note": "thin evidence"})
        report, _ = self.run_analysis(rows)
        found = report["reviewers"]["reviewer-a"]
        self.assertEqual((found["unsure_rows"], found["notes"]), (["R02-2"], {"R02-2": "thin evidence"}))

    def test_summary_survives_an_undefined_kappa(self):
        # Both reviewers give every shared row the same single grade: kappa between them is undefined.
        second = self.graded([1, 1, 1], reviewer="reviewer-b", rows=self.blank_rows[:3])
        report, _ = self.run_analysis(self.graded([1, 1, 1, 0, 2, 3]), second)
        self.assertIsNone(report["between_reviewers"]["kappa_quadratic"])
        self.assertIn("undefined", review.table(report))


if __name__ == "__main__":
    unittest.main()
