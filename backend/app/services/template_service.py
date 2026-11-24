"""
Template renderer service for locked templates with number slots.
Pure formatting using Jinja2 with strict slot filling.
"""
from pathlib import Path
from typing import Any
from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_template(template_path: str, context: dict[str, Any]) -> str:
    """Render a locked Jinja2 template."""
    tmpl = env.get_template(template_path)
    return tmpl.render(**context)


class TemplateService:
    """Service for rendering locked bilingual templates."""

    def __init__(self, templates_dir: Path | None = None) -> None:
        self.dir = templates_dir or TEMPLATES_DIR
        self.env = Environment(
            loader=FileSystemLoader(self.dir),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render(self, template_path: str, context: dict[str, Any]) -> str:
        tmpl = self.env.get_template(template_path)
        return tmpl.render(**context)

    def render_grievance_letter(self, context: dict[str, Any], language: str = "hi") -> str:
        lang = "hi" if language.lower().startswith("hi") else "en"
        template_name = f"grievance/letter_{lang}.html"
        return self.render(template_name, context)

    def render_grievance_pdf_safe(self, context: dict[str, Any], language: str = "hi") -> tuple[bytes, str]:
        """
        Safely generates PDF if WeasyPrint is installed and system libraries (cairo/pango) are present.
        Falls back to UTF-8 encoded printable HTML on systems/containers without cairo.
        Returns: (payload_bytes, media_type)
        """
        html_str = self.render_grievance_letter(context, language)
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=html_str).write_pdf()
            return pdf_bytes, "application/pdf"
        except (ImportError, OSError, Exception):
            return html_str.encode("utf-8"), "text/html"


