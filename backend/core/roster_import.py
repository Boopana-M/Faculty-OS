"""Small, dependency-free reader for the college name-list workbook format."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import BinaryIO
from zipfile import ZipFile
import xml.etree.ElementTree as ET
import csv
import re


SPREADSHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
WORD_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _shared_strings(workbook: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in workbook.namelist():
        return []
    root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.iter(f"{SPREADSHEET_NS}t")) for item in root]


def read_name_list(source: BinaryIO | bytes | Path) -> list[dict[str, str]]:
    """Return roll number, register number and student name from an .xlsx name list."""
    if isinstance(source, Path):
        source = source.open("rb")
    if isinstance(source, bytes):
        source = BytesIO(source)

    with ZipFile(source) as workbook:
        strings = _shared_strings(workbook)
        worksheet = next(
            (name for name in workbook.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")),
            None,
        )
        if not worksheet:
            raise ValueError("The workbook does not contain a worksheet.")

        root = ET.fromstring(workbook.read(worksheet))
        rows: list[dict[str, str]] = []
        for row in root.findall(f".//{SPREADSHEET_NS}sheetData/{SPREADSHEET_NS}row"):
            values: dict[str, str] = {}
            for cell in row.findall(f"{SPREADSHEET_NS}c"):
                ref = cell.get("r", "")
                column = "".join(char for char in ref if char.isalpha())
                value_node = cell.find(f"{SPREADSHEET_NS}v")
                value = value_node.text if value_node is not None else ""
                if cell.get("t") == "s" and value:
                    value = strings[int(value)]
                values[column] = value.strip()

            # The supplied workbook uses B=roll no, C=register no and D=student name.
            roll_no, register_no, name = values.get("B", ""), values.get("C", ""), values.get("D", "")
            if roll_no and name and roll_no.lower() != "roll no.":
                rows.append({"roll_no": roll_no, "student_id": register_no, "name": name})

    if not rows:
        raise ValueError("No student rows were found. Expected Roll No. in column B and Student Name in column D.")
    return rows


def _rows_from_text(text: str) -> list[dict[str, str]]:
    """Extract common college register rows from PDF/Word/plain-text exports."""
    rows: list[dict[str, str]] = []
    seen_rolls: set[str] = set()
    pattern = re.compile(
        r"\b(?P<roll>\d{2}[A-Z]{2}\d{3})\b(?:\s+(?P<register>\d{6,}))?\s+(?P<name>[A-Z][A-Z .'-]{2,})",
        re.IGNORECASE,
    )
    for line in text.splitlines():
        match = pattern.search(" ".join(line.split()))
        if not match or match.group("roll").upper() in seen_rolls:
            continue
        roll_no = match.group("roll").upper()
        name = match.group("name").strip(" .")
        if name.lower().startswith(("roll", "register", "student")):
            continue
        seen_rolls.add(roll_no)
        rows.append({"roll_no": roll_no, "student_id": match.group("register") or "", "name": name})
    return rows


def _read_docx(source: bytes) -> str:
    with ZipFile(BytesIO(source)) as document:
        root = ET.fromstring(document.read("word/document.xml"))
    return "\n".join("".join(node.text or "" for node in paragraph.iter(f"{WORD_NS}t")) for paragraph in root.iter(f"{WORD_NS}p"))


def _read_csv(source: bytes) -> list[dict[str, str]]:
    rows = list(csv.reader(source.decode("utf-8-sig", errors="ignore").splitlines()))
    result: list[dict[str, str]] = []
    for row in rows:
        joined = " ".join(row)
        parsed = _rows_from_text(joined)
        result.extend(parsed)
    return result


def read_roster_file(filename: str, content: bytes) -> list[dict[str, str]]:
    """Read an Excel, Word or PDF roster into the common student-row shape.

    .xlsx and .csv are handled without optional packages. PDF extraction uses pypdf,
    which is listed in requirements.txt. Legacy .xls and .doc are treated as text
    exports when possible; save them as .xlsx/.docx for the most reliable import.
    """
    suffix = Path(filename).suffix.lower()
    if suffix == ".xlsx":
        return read_name_list(content)
    if suffix == ".csv":
        rows = _read_csv(content)
    elif suffix == ".docx":
        rows = _rows_from_text(_read_docx(content))
    elif suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise ValueError("PDF import needs the pypdf package. Run pip install -r requirements.txt.") from exc
        reader = PdfReader(BytesIO(content))
        rows = _rows_from_text("\n".join(page.extract_text() or "" for page in reader.pages))
    elif suffix in {".xls", ".doc"}:
        # Legacy Office formats are binary. This fallback supports text-exported files;
        # users can re-save binary originals as .xlsx or .docx for structured parsing.
        rows = _rows_from_text(content.decode("latin-1", errors="ignore"))
    else:
        raise ValueError("Supported roster files are Excel (.xlsx, .xls, .csv), Word (.docx, .doc), and PDF (.pdf).")

    if not rows:
        raise ValueError("No student rows were found. Include a roll number and student name for each student.")
    return rows
