#!/usr/bin/env python3
"""Convert a Markdown file to a styled PDF using Unicode-compatible fonts."""

import re
import sys
from fpdf import FPDF


class StyledPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=22)
        # Use DejaVu Unicode fonts
        fonts_dir = "C:/Windows/Fonts"
        self.add_font("DejaVu", "", f"{fonts_dir}/DejaVuSans.ttf")
        self.add_font("DejaVu", "B", f"{fonts_dir}/DejaVuSans-Bold.ttf")
        self.add_font("DejaVu", "I", f"{fonts_dir}/DejaVuSans-Oblique.ttf")

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 8, "VEX V5 Drivetrain Development Guide", align="R")
        self.ln(3)
        self.set_draw_color(180, 30, 30)
        self.set_line_width(0.4)
        self.line(10, 16, 200, 16)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("DejaVu", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def render_title_page(self, title):
        self.add_page()
        self.ln(50)
        self.set_font("DejaVu", "", 1)
        self.set_fill_color(180, 0, 0)
        self.cell(0, 2, "", fill=True)
        self.ln(8)
        self.set_font("DejaVu", "B", 28)
        self.set_text_color(180, 0, 0)
        self.multi_cell(0, 14, title, align="C")
        self.ln(6)
        self.set_font("DejaVu", "", 13)
        self.set_text_color(80, 80, 80)
        self.multi_cell(0, 7, "From chassis design to competition-ready code", align="C")
        self.ln(12)
        self.set_font("DejaVu", "I", 10)
        self.set_text_color(130, 130, 130)
        self.cell(0, 8, "A comprehensive guide for new VEX V5 builders", align="C")
        self.ln(8)

    def render_h1(self, text):
        self.ln(4)
        self.set_font("DejaVu", "B", 17)
        self.set_text_color(180, 0, 0)
        self.cell(0, 11, text)
        self.ln(3)
        self.set_draw_color(180, 0, 0)
        self.set_line_width(0.6)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def render_h2(self, text):
        self.ln(3)
        self.set_font("DejaVu", "B", 12)
        self.set_text_color(40, 40, 120)
        self.cell(0, 8, text)
        self.ln(5)

    def render_body(self, text):
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
        self.set_font("DejaVu", "", 10.5)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def render_bullet(self, text):
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
        self.set_font("DejaVu", "", 10.5)
        self.set_text_color(30, 30, 30)
        self.set_x(15)
        self.cell(4, 5.5, "-", align="L")
        self.set_x(20)
        self.multi_cell(0, 5.5, text)
        self.set_x(10)

    def render_numbered(self, num, text):
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
        self.set_font("DejaVu", "", 10.5)
        self.set_text_color(30, 30, 30)
        self.set_x(15)
        self.cell(8, 5.5, f"{num}.", align="R")
        self.set_x(25)
        self.multi_cell(0, 5.5, text)
        self.set_x(10)

    def render_code(self, code):
        self.ln(1)
        self.set_x(15)
        prev_x = self.get_x()
        self.set_fill_color(235, 235, 245)
        self.set_draw_color(180, 180, 200)
        self.set_line_width(0.2)
        lines = code.split("\n")
        h = len(lines) * 4.5 + 4
        w = 185
        self.cell(w, h, "", border=1, fill=True)
        self.ln(2)
        self.set_x(prev_x + 3)
        self.set_font("DejaVu", "", 8.5)
        self.set_text_color(20, 20, 60)
        for line in lines:
            self.set_x(prev_x + 3)
            self.cell(0, 4.5, line)
            self.ln(4.5)
        self.set_x(10)
        self.ln(4)

    def render_table(self, rows):
        num_cols = len(rows[0])
        col_w = 185 / num_cols
        widths = [col_w] * num_cols
        for ri, row in enumerate(rows):
            if ri == 0:
                self.set_font("DejaVu", "B", 9.5)
                self.set_fill_color(180, 0, 0)
                self.set_text_color(255, 255, 255)
            else:
                self.set_font("DejaVu", "", 9.5)
                self.set_text_color(30, 30, 30)
                self.set_fill_color(248, 248, 252)
            for ci, cell in enumerate(row):
                self.cell(widths[ci], 7, cell.strip(), border=1, fill=True, align="C")
            self.ln()
        self.ln(4)

    def render_bold_line(self, text):
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(40, 40, 40)
        self.cell(0, 7, text)
        self.ln(5)


def clean_text(text):
    """Make text safe for PDF rendering."""
    # Replace common special characters
    replacements = {
        "–": "-",   # en-dash
        "—": "-",   # em-dash
        "‘": "'",   # left single quote
        "’": "'",   # right single quote
        "“": '"',   # left double quote
        "”": '"',   # right double quote
        "…": "...", # ellipsis
        "°": " deg", # degree
        "×": "x",   # multiplication
        "→": "->",  # right arrow
        "←": "<-",  # left arrow
        "′": "'",   # prime
        "″": '"',   # double prime
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    # Strip remaining emoji/non-latin1 characters
    safe = []
    for ch in text:
        try:
            ch.encode("latin-1")
            safe.append(ch)
        except UnicodeEncodeError:
            safe.append("")
    return "".join(safe)


def convert(md_path, pdf_path):
    pdf = StyledPDF()
    pdf.alias_nb_pages()

    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    content = clean_text(content)
    lines = content.split("\n")
    i = 0
    in_code = False
    code_buf = []
    in_table = False
    table_rows = []

    while i < len(lines):
        line = lines[i]

        # Code blocks
        if line.strip().startswith("```"):
            if in_code:
                pdf.render_code("\n".join(code_buf))
                code_buf = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # Horizontal rule
        if line.strip() == "---":
            pdf.ln(2)
            pdf.set_draw_color(180, 0, 0)
            pdf.set_line_width(0.3)
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(4)
            i += 1
            continue

        # H1 - Title
        if re.match(r"^# [^#]", line):
            title = line.lstrip("# ").strip()
            pdf.render_title_page(title)
            i += 1
            continue

        # H2 - Chapter
        if re.match(r"^## [^#]", line):
            heading = line.lstrip("# ").strip()
            pdf.render_h1(heading)
            i += 1
            continue

        # H3 - Subheading
        if re.match(r"^### ", line):
            sub = line.lstrip("# ").strip()
            pdf.render_h2(sub)
            i += 1
            continue

        # Table rows
        if line.strip().startswith("|"):
            row = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(re.match(r"^[-:]+$", c.replace(" ", "")) for c in row if c):
                i += 1
                continue
            if not in_table:
                in_table = True
                table_rows = [row]
            else:
                table_rows.append(row)
            i += 1
            continue
        else:
            if in_table and table_rows:
                pdf.render_table(table_rows)
                in_table = False
                table_rows = []

        # Numbered list
        nm = re.match(r"^(\d+)\.\s+(.*)", line.strip())
        if nm:
            pdf.render_numbered(nm.group(1), nm.group(2))
            i += 1
            continue

        # Bullet list
        if line.strip().startswith("- "):
            pdf.render_bullet(line.strip()[2:])
            i += 1
            continue

        # Bold-only line
        if re.match(r"^\*\*.*\*\*$", line.strip()):
            pdf.render_bold_line(line.strip())
            i += 1
            continue

        # Empty line
        if line.strip() == "":
            pdf.ln(2)
            i += 1
            continue

        # Normal body
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", line.strip())
        text = re.sub(r"`(.*?)`", r"\1", text)
        pdf.render_body(text)
        i += 1

    # Flush remaining table
    if in_table and table_rows:
        pdf.render_table(table_rows)

    pdf.output(pdf_path)
    print(f"PDF saved to: {pdf_path}")


if __name__ == "__main__":
    md = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\prich\claudeclaw\v5-drivetrain-guide.md"
    pdf = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\prich\claudeclaw\v5-drivetrain-guide.pdf"
    convert(md, pdf)
