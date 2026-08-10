# Class master reconciliation

The old database has 88 class rows. Some rows have different source IDs but
represent the same class. Tsewa groups these aliases by class name, stream, and
section, producing 78 class names.

The daily School pages now show one class for each visible name. For the 2026
session, this changes the class count from 70 source offerings to 68 classes.
Classes such as **XI Arts A**, **XI Arts D**, and **XI Arts E** remain separate.

No source row is deleted. Existing student records keep their original class
ID, while queries group matching IDs under the same class name. Before class
editing is added, this mapping should become an explicit class-alias table so
new records always point to the chosen master class.

Run the read-only check with:

```sh
vp run migration:classes:dry-run
```

The full aggregate report is written to
`reports/class-master-reconciliation.json`.
